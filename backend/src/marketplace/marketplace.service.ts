import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { MockMarketplaceConnector } from './mock-marketplace.connector';
import { MercadoLivreConnector } from './mercadolivre.connector';
import { ProductMapperService } from './product-mapper.service';
import {
  MarketplaceConnector,
  SyncResult,
} from './marketplace-connector.interface';
import {
  CreateChannelDto,
  CreateChannelAccountDto,
  UpdateChannelAccountDto,
  PublishProductDto,
  MapCategoryDto,
  CompleteOAuthDto,
  ValidateProductDto,
} from './dto/marketplace.dto';
import {
  ChannelType,
  ChannelAccountStatus,
  ChannelProductStatus,
  ChannelSyncOperation,
  ChannelSyncStatus,
} from '@prisma/client';
import { HubValidatorService } from './hub-validator.service';
import { ChannelAttributeMappingService } from './channel-attribute-mapping.service';
import { PricingService } from '../pricing/pricing.service';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly mockConnector: MockMarketplaceConnector,
    private readonly mlConnector: MercadoLivreConnector,
    private readonly productMapper: ProductMapperService,
    private readonly hubValidator: HubValidatorService,
    private readonly attributeMappingService: ChannelAttributeMappingService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Resolve o conector adequado para a conta/canal
   */
  private getConnector(channelType?: ChannelType): MarketplaceConnector {
    if (channelType === ChannelType.MERCADO_LIVRE) {
      return this.mlConnector;
    }
    return this.mockConnector;
  }

  // ============================================================
  // 1. CANAIS (Channels)
  // ============================================================

  async listChannels() {
    return this.prisma.channel.findMany({
      include: {
        _count: {
          select: {
            accounts: true,
            categories: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createChannel(dto: CreateChannelDto, userId?: string) {
    const channel = await this.prisma.channel.create({
      data: {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        icon: dto.icon,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.auditLog.log({
      action: 'CHANNEL_CREATED',
      entity: 'Channel',
      entityId: channel.id,
      userId,
      metadata: { name: channel.name, type: channel.type },
    });

    return channel;
  }

  async getChannel(id: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      include: {
        accounts: {
          include: {
            _count: { select: { channelProducts: true, syncLogs: true } },
          },
        },
        categories: {
          include: { category: true },
        },
      },
    });

    if (!channel)
      throw new NotFoundException(`Canal com ID "${id}" não encontrado.`);
    return channel;
  }

  // ============================================================
  // 2. CONTAS DE CANAL (ChannelAccounts) & OAUTH MERCADO LIVRE
  // ============================================================

  async listAccounts(channelId?: string) {
    const accounts = await this.prisma.channelAccount.findMany({
      where: channelId ? { channelId } : undefined,
      include: {
        channel: true,
        _count: {
          select: {
            channelProducts: true,
            syncLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Sanitiza credenciais e tokens nunca expondo para o cliente
    return accounts.map((acc) => this.sanitizeAccount(acc));
  }

  async createAccount(dto: CreateChannelAccountDto, userId?: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: dto.channelId },
    });
    if (!channel)
      throw new NotFoundException(`Canal ${dto.channelId} não encontrado.`);

    const account = await this.prisma.channelAccount.create({
      data: {
        channelId: dto.channelId,
        name: dto.name,
        externalAccountId: dto.externalAccountId,
        configuration: dto.configuration || {},
        status: ChannelAccountStatus.PENDING,
      },
      include: { channel: true },
    });

    await this.auditLog.log({
      action: 'CHANNEL_ACCOUNT_CREATED',
      entity: 'ChannelAccount',
      entityId: account.id,
      userId,
      metadata: { name: account.name, channel: channel.name },
    });

    return this.sanitizeAccount(account);
  }

  async updateAccount(
    id: string,
    dto: UpdateChannelAccountDto,
    userId?: string,
  ) {
    const existing = await this.prisma.channelAccount.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Conta ${id} não encontrada.`);

    const account = await this.prisma.channelAccount.update({
      where: { id },
      data: {
        name: dto.name,
        status: dto.status,
        configuration: dto.configuration
          ? (dto.configuration as any)
          : undefined,
      },
      include: { channel: true },
    });

    await this.auditLog.log({
      action: 'CHANNEL_ACCOUNT_UPDATED',
      entity: 'ChannelAccount',
      entityId: account.id,
      userId,
      metadata: { name: account.name, status: account.status },
    });

    return this.sanitizeAccount(account);
  }

  /**
   * Gera URL de autorização OAuth para o Mercado Livre
   */
  getMercadoLivreAuthUrl(channelAccountId?: string) {
    const state = channelAccountId
      ? JSON.stringify({ accountId: channelAccountId })
      : undefined;
    return {
      url: this.mlConnector.getAuthorizationUrl(state),
    };
  }

  /**
   * Conclui autorização OAuth do Mercado Livre trocando code por tokens criptografados
   */
  async completeMercadoLivreOAuth(dto: CompleteOAuthDto, userId?: string) {
    let account = null;

    if (dto.channelAccountId) {
      account = await this.prisma.channelAccount.findUnique({
        where: { id: dto.channelAccountId },
        include: { channel: true },
      });
    }

    // Se conta não informada, busca ou cria o canal MERCADO_LIVRE
    if (!account) {
      let mlChannel = await this.prisma.channel.findFirst({
        where: { type: ChannelType.MERCADO_LIVRE },
      });

      if (!mlChannel) {
        mlChannel = await this.prisma.channel.create({
          data: {
            name: 'Mercado Livre',
            type: ChannelType.MERCADO_LIVRE,
            description: 'Canal oficial Mercado Livre',
            isActive: true,
          },
        });
      }

      account = await this.prisma.channelAccount.create({
        data: {
          channelId: mlChannel.id,
          name: dto.accountName || 'Mercado Livre Oficial',
          status: ChannelAccountStatus.PENDING,
        },
        include: { channel: true },
      });
    }

    try {
      const tokenResult = await this.mlConnector.exchangeCodeForTokens(
        dto.code,
      );

      const updated = await this.prisma.channelAccount.update({
        where: { id: account.id },
        data: {
          externalAccountId: tokenResult.userId,
          configuration: tokenResult.encryptedConfig,
          status: ChannelAccountStatus.ACTIVE,
          lastSyncAt: new Date(),
          errorMessage: null,
        },
        include: { channel: true },
      });

      await this.auditLog.log({
        action: 'MARKETPLACE_ACCOUNT_CONNECTED',
        entity: 'ChannelAccount',
        entityId: updated.id,
        userId,
        metadata: {
          name: updated.name,
          externalAccountId: updated.externalAccountId,
        },
      });

      await this.logSync({
        channelAccountId: updated.id,
        operation: ChannelSyncOperation.TEST_CONNECTION,
        status: ChannelSyncStatus.SUCCESS,
        message:
          'OAuth concluído com sucesso e credenciais armazenadas de forma segura.',
      });

      return this.sanitizeAccount(updated);
    } catch (err: any) {
      await this.prisma.channelAccount.update({
        where: { id: account.id },
        data: {
          status: ChannelAccountStatus.ERROR,
          errorMessage: err.message,
        },
      });

      await this.logSync({
        channelAccountId: account.id,
        operation: ChannelSyncOperation.TEST_CONNECTION,
        status: ChannelSyncStatus.ERROR,
        message: `Falha na autorização OAuth: ${err.message}`,
      });

      throw new BadRequestException(
        `Falha ao autorizar no Mercado Livre: ${err.message}`,
      );
    }
  }

  /**
   * Desconecta e revoga credenciais locais de uma conta
   */
  async disconnectAccount(accountId: string, userId?: string) {
    const account = await this.prisma.channelAccount.findUnique({
      where: { id: accountId },
      include: { channel: true },
    });
    if (!account)
      throw new NotFoundException(`Conta ${accountId} não encontrada.`);

    const connector = this.getConnector(account.channel?.type);
    if (connector.disconnect) {
      await connector.disconnect((account.configuration as any) || {});
    }

    const updated = await this.prisma.channelAccount.update({
      where: { id: accountId },
      data: {
        status: ChannelAccountStatus.DISCONNECTED,
        configuration: {},
        errorMessage: null,
      },
      include: { channel: true },
    });

    await this.auditLog.log({
      action: 'MARKETPLACE_ACCOUNT_DISCONNECTED',
      entity: 'ChannelAccount',
      entityId: account.id,
      userId,
      metadata: { name: account.name },
    });

    return this.sanitizeAccount(updated);
  }

  /**
   * Testa a conectividade da conta de canal com a API externa
   */
  async testConnection(accountId: string) {
    const account = await this.prisma.channelAccount.findUnique({
      where: { id: accountId },
      include: { channel: true },
    });
    if (!account)
      throw new NotFoundException(`Conta ${accountId} não encontrada.`);

    const connector = this.getConnector(account.channel?.type);

    const start = Date.now();
    const result: SyncResult = await connector.testConnection(
      (account.configuration as Record<string, any>) || {},
    );
    const durationMs = Date.now() - start;

    const newStatus = result.success
      ? ChannelAccountStatus.ACTIVE
      : ChannelAccountStatus.ERROR;

    await this.prisma.channelAccount.update({
      where: { id: accountId },
      data: {
        status: newStatus,
        lastSyncAt: new Date(),
        errorMessage: result.success ? null : result.message,
      },
    });

    await this.logSync({
      channelAccountId: accountId,
      operation: ChannelSyncOperation.TEST_CONNECTION,
      status: result.success
        ? ChannelSyncStatus.SUCCESS
        : ChannelSyncStatus.ERROR,
      message: result.message,
      durationMs,
    });

    await this.auditLog.log({
      action: 'MARKETPLACE_CONNECTION_TESTED',
      entity: 'ChannelAccount',
      entityId: accountId,
      metadata: { success: result.success },
    });

    return result;
  }

  // ============================================================
  // 3. PUBLICAÇÃO, VALIDAÇÃO E SINCRONIZAÇÃO DE PRODUTOS
  // ============================================================

  async listChannelProducts(channelAccountId?: string) {
    return this.prisma.channelProduct.findMany({
      where: channelAccountId ? { channelAccountId } : undefined,
      include: {
        product: {
          include: {
            variants: true,
            media: true,
          },
        },
        channelAccount: {
          include: { channel: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Validação pré-publicação explícita
   */
  async validateProductForChannel(dto: ValidateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        attributeValues: { include: { attributeDefinition: true } },
        media: true,
        inventories: true,
        categories: { include: { category: true } },
      },
    });
    if (!product)
      throw new NotFoundException(`Produto ${dto.productId} não encontrado.`);

    const account = await this.prisma.channelAccount.findUnique({
      where: { id: dto.channelAccountId },
      include: { channel: true },
    });
    if (!account)
      throw new NotFoundException(
        `Conta ${dto.channelAccountId} não encontrada.`,
      );

    let externalCategoryId: string | undefined;
    if (product.categories.length > 0) {
      const primaryCatId = product.categories[0].categoryId;
      const catMapping = await this.prisma.channelCategory.findUnique({
        where: {
          channelId_categoryId: {
            channelId: account.channelId,
            categoryId: primaryCatId,
          },
        },
      });
      if (catMapping) {
        externalCategoryId = catMapping.externalCategoryId;
      }
    }

    let resolvedPrice: number | undefined;
    if (dto.priceOverride !== undefined && dto.priceOverride !== null) {
      resolvedPrice = Number(dto.priceOverride);
    } else {
      const effectiveDec = await this.pricingService.getEffectivePrice(
        product.id,
        account.channelId,
      );
      if (effectiveDec) {
        resolvedPrice = Number(effectiveDec);
      } else {
        resolvedPrice = Number(product.basePrice || 0);
      }
    }

    const availableStock = product.inventories.reduce(
      (sum: number, inv: any) =>
        sum + Math.max(0, (inv.quantity || 0) - (inv.reservedQuantity || 0)),
      0,
    );

    const validation = this.hubValidator.validateForPublication(product, {
      channelType: account.channel.type,
      externalCategoryId,
      resolvedPrice,
      availableStock,
    });

    const stringErrors = validation.errors.map((e) => e.message);

    return {
      productId: product.id,
      productName: product.name,
      channelName: account.name,
      externalCategoryId,
      resolvedPrice,
      availableStock,
      isValid: validation.isValid,
      errors: stringErrors,
      structuredErrors: validation.errors,
      warnings: validation.warnings,
      info: validation.info,
    };
  }

  /**
   * Publicação com proteção contra duplicidade (idempotência)
   */
  async publishProduct(dto: PublishProductDto, userId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        attributeValues: { include: { attributeDefinition: true } },
        media: true,
        inventories: true,
        categories: { include: { category: true } },
      },
    });
    if (!product)
      throw new NotFoundException(`Produto ${dto.productId} não encontrado.`);

    const account = await this.prisma.channelAccount.findUnique({
      where: { id: dto.channelAccountId },
      include: { channel: true },
    });
    if (!account)
      throw new NotFoundException(
        `Conta ${dto.channelAccountId} não encontrada.`,
      );

    // P1: Verifica disponibilidade comercial no canal (ProductChannel)
    const productChannel = await this.prisma.productChannel.findUnique({
      where: {
        productId_channelId: {
          productId: dto.productId,
          channelId: account.channelId,
        },
      },
    });
    if (!productChannel || !productChannel.isEnabled) {
      throw new BadRequestException(
        `O produto "${product.name}" não está habilitado para o canal "${account.channel.name}". Ative a disponibilidade comercial do produto antes de publicar.`,
      );
    }

    // 1. Mapeamento de Categoria
    let externalCategoryId: string | undefined;
    if (product.categories.length > 0) {
      const primaryCatId = product.categories[0].categoryId;
      const catMapping = await this.prisma.channelCategory.findUnique({
        where: {
          channelId_categoryId: {
            channelId: account.channelId,
            categoryId: primaryCatId,
          },
        },
      });
      if (catMapping) {
        externalCategoryId = catMapping.externalCategoryId;
      }
    }

    // 2. Resolução de Preço Efetivo (F12) e Estoque Disponível (F7)
    let resolvedPrice: number | undefined;
    if (dto.priceOverride !== undefined && dto.priceOverride !== null) {
      resolvedPrice = Number(dto.priceOverride);
    } else {
      const effectiveDec = await this.pricingService.getEffectivePrice(
        product.id,
        account.channelId,
      );
      if (effectiveDec) {
        resolvedPrice = Number(effectiveDec);
      } else {
        resolvedPrice = Number(product.basePrice || 0);
      }
    }

    const availableStock = product.inventories.reduce(
      (sum: number, inv: any) =>
        sum + Math.max(0, (inv.quantity || 0) - (inv.reservedQuantity || 0)),
      0,
    );

    // 3. Validação agnóstica via HubValidatorService
    const validation = this.hubValidator.validateForPublication(product, {
      channelType: account.channel.type,
      externalCategoryId,
      resolvedPrice,
      availableStock,
    });
    if (!validation.isValid) {
      const errMsgs = validation.errors.map((e) => e.message).join(' ');
      throw new BadRequestException(
        `Produto não pode ser publicado no ${account.channel.name}: ${errMsgs}`,
      );
    }

    // 4. Resolve atributos mapeados dinâmicos
    const customAttributes = await this.attributeMappingService.resolveMappedAttributes(
      account.channelId,
      product,
      externalCategoryId,
    );

    // 5. Verificação de IDEMPOTÊNCIA: Se já foi publicado e tem externalProductId, sincroniza em vez de duplicar
    const existingChannelProduct = await this.prisma.channelProduct.findUnique({
      where: {
        productId_channelAccountId: {
          productId: dto.productId,
          channelAccountId: dto.channelAccountId,
        },
      },
    });

    const connector = this.getConnector(account.channel.type);
    const payload = this.productMapper.mapToExternalPayload(product, {
      priceOverride: dto.priceOverride,
      resolvedEffectivePrice: resolvedPrice,
      availableStock,
      externalCategoryId,
      customAttributes,
    });

    if (
      existingChannelProduct &&
      existingChannelProduct.externalProductId &&
      existingChannelProduct.status === ChannelProductStatus.PUBLISHED
    ) {
      this.logger.log(
        `Produto ${dto.productId} já possui anúncio ${existingChannelProduct.externalProductId}. Executando update (idempotência).`,
      );
      const updateResult = await connector.updateProduct(
        existingChannelProduct.externalProductId,
        payload,
        (account.configuration as any) || {},
      );

      await this.prisma.channelProduct.update({
        where: { id: existingChannelProduct.id },
        data: {
          lastSyncAt: new Date(),
          priceOverride:
            dto.priceOverride !== undefined ? dto.priceOverride : undefined,
          lastError: updateResult.success ? null : updateResult.message,
        },
      });

      await this.logSync({
        channelAccountId: dto.channelAccountId,
        channelProductId: existingChannelProduct.id,
        operation: ChannelSyncOperation.UPDATE,
        status: updateResult.success
          ? ChannelSyncStatus.SUCCESS
          : ChannelSyncStatus.ERROR,
        message: `Idempotência garantida: anúncio existente atualizado em vez de duplicado. ${updateResult.message}`,
        externalCode: existingChannelProduct.externalProductId,
      });

      await this.auditLog.log({
        action: 'MARKETPLACE_PRODUCT_UPDATED',
        entity: 'ChannelProduct',
        entityId: existingChannelProduct.id,
        userId,
        metadata: {
          externalProductId: existingChannelProduct.externalProductId,
        },
      });

      return {
        channelProduct: existingChannelProduct,
        result: updateResult,
      };
    }

    // 4. Registro em PENDING
    const channelProduct = await this.prisma.channelProduct.upsert({
      where: {
        productId_channelAccountId: {
          productId: dto.productId,
          channelAccountId: dto.channelAccountId,
        },
      },
      create: {
        productId: dto.productId,
        channelAccountId: dto.channelAccountId,
        priceOverride:
          dto.priceOverride !== undefined ? dto.priceOverride : null,
        status: ChannelProductStatus.PENDING,
        syncPayload: payload as any,
      },
      update: {
        priceOverride:
          dto.priceOverride !== undefined ? dto.priceOverride : undefined,
        status: ChannelProductStatus.PENDING,
        syncPayload: payload as any,
      },
    });

    // 5. Chamada ao conector
    const start = Date.now();
    const result = await connector.publishProduct(
      payload,
      (account.configuration as Record<string, any>) || {},
    );
    const durationMs = Date.now() - start;

    // 6. Atualização do ChannelProduct com retorno
    const updated = await this.prisma.channelProduct.update({
      where: { id: channelProduct.id },
      data: {
        status: result.success
          ? ChannelProductStatus.PUBLISHED
          : ChannelProductStatus.ERROR,
        externalProductId: result.externalProductId || null,
        externalUrl: result.externalUrl || null,
        externalSku: result.externalSku || payload.sku,
        lastSyncAt: new Date(),
        lastError: result.success ? null : result.message,
      },
      include: {
        product: true,
        channelAccount: { include: { channel: true } },
      },
    });

    // 7. Registro de logs seguros
    await this.logSync({
      channelAccountId: dto.channelAccountId,
      channelProductId: channelProduct.id,
      operation: ChannelSyncOperation.PUBLISH,
      status: result.success
        ? ChannelSyncStatus.SUCCESS
        : ChannelSyncStatus.ERROR,
      message: result.message,
      externalCode: result.externalProductId,
      durationMs,
      details: result.rawResponse
        ? this.sanitizeData(result.rawResponse)
        : undefined,
    });

    await this.auditLog.log({
      action: result.success
        ? 'MARKETPLACE_PRODUCT_PUBLISHED'
        : 'MARKETPLACE_SYNC_FAILED',
      entity: 'ChannelProduct',
      entityId: updated.id,
      userId,
      metadata: {
        productId: dto.productId,
        channelAccount: account.name,
        success: result.success,
        externalId: result.externalProductId,
      },
    });

    return {
      channelProduct: updated,
      result,
    };
  }

  async syncPrice(channelProductId: string) {
    const cp = await this.prisma.channelProduct.findUnique({
      where: { id: channelProductId },
      include: {
        product: true,
        channelAccount: { include: { channel: true } },
      },
    });
    if (!cp)
      throw new NotFoundException(
        `Produto de canal ${channelProductId} não encontrado.`,
      );
    if (!cp.externalProductId) {
      throw new BadRequestException(
        'Produto ainda não possui identificador externo para sincronização de preço.',
      );
    }

    let price: number;
    if (cp.priceOverride !== null) {
      price = Number(cp.priceOverride);
    } else {
      const effectiveDec = await this.pricingService.getEffectivePrice(
        cp.productId,
        cp.channelAccount.channelId,
      );
      if (effectiveDec) {
        price = Number(effectiveDec);
      } else {
        price = Number(cp.product.basePrice || 0);
      }
    }

    const connector = this.getConnector(cp.channelAccount.channel.type);

    const start = Date.now();
    const result = await connector.updatePrice(
      cp.externalProductId,
      price,
      (cp.channelAccount.configuration as Record<string, any>) || {},
    );
    const durationMs = Date.now() - start;

    await this.prisma.channelProduct.update({
      where: { id: channelProductId },
      data: {
        lastSyncAt: new Date(),
        lastError: result.success ? null : result.message,
      },
    });

    await this.logSync({
      channelAccountId: cp.channelAccountId,
      channelProductId: cp.id,
      operation: ChannelSyncOperation.PRICE,
      status: result.success
        ? ChannelSyncStatus.SUCCESS
        : ChannelSyncStatus.ERROR,
      message: result.message,
      durationMs,
      details: result.rawResponse,
    });

    await this.auditLog.log({
      action: result.success
        ? 'MARKETPLACE_PRICE_SYNCED'
        : 'MARKETPLACE_SYNC_FAILED',
      entity: 'ChannelProduct',
      entityId: cp.id,
      metadata: { price, externalProductId: cp.externalProductId },
    });

    return result;
  }

  async syncStock(channelProductId: string) {
    const cp = await this.prisma.channelProduct.findUnique({
      where: { id: channelProductId },
      include: {
        product: {
          include: { inventories: true },
        },
        channelAccount: { include: { channel: true } },
      },
    });
    if (!cp)
      throw new NotFoundException(
        `Produto de canal ${channelProductId} não encontrado.`,
      );
    if (!cp.externalProductId) {
      throw new BadRequestException(
        'Produto ainda não possui identificador externo para sincronização de estoque.',
      );
    }

    let stock = 0;
    if (cp.product.inventories && cp.product.inventories.length > 0) {
      stock = cp.product.inventories.reduce(
        (acc, inv) => acc + Math.max(0, inv.quantity - inv.reservedQuantity),
        0,
      );
    } else {
      stock = 15;
    }

    const connector = this.getConnector(cp.channelAccount.channel.type);

    const start = Date.now();
    const result = await connector.updateStock(
      cp.externalProductId,
      stock,
      (cp.channelAccount.configuration as Record<string, any>) || {},
    );
    const durationMs = Date.now() - start;

    await this.prisma.channelProduct.update({
      where: { id: channelProductId },
      data: {
        lastSyncAt: new Date(),
        lastError: result.success ? null : result.message,
      },
    });

    await this.logSync({
      channelAccountId: cp.channelAccountId,
      channelProductId: cp.id,
      operation: ChannelSyncOperation.STOCK,
      status: result.success
        ? ChannelSyncStatus.SUCCESS
        : ChannelSyncStatus.ERROR,
      message: result.message,
      durationMs,
      details: result.rawResponse,
    });

    await this.auditLog.log({
      action: result.success
        ? 'MARKETPLACE_STOCK_SYNCED'
        : 'MARKETPLACE_SYNC_FAILED',
      entity: 'ChannelProduct',
      entityId: cp.id,
      metadata: { stock, externalProductId: cp.externalProductId },
    });

    return result;
  }

  async syncProductDetails(channelProductId: string) {
    const cp = await this.prisma.channelProduct.findUnique({
      where: { id: channelProductId },
      include: {
        channelAccount: { include: { channel: true } },
      },
    });
    if (!cp)
      throw new NotFoundException(
        `Produto de canal ${channelProductId} não encontrado.`,
      );
    if (!cp.externalProductId) {
      throw new BadRequestException('Produto não possui ID externo.');
    }

    const connector = this.getConnector(cp.channelAccount.channel.type);
    const result = await connector.syncProduct(
      cp.externalProductId,
      (cp.channelAccount.configuration as Record<string, any>) || {},
    );

    await this.prisma.channelProduct.update({
      where: { id: channelProductId },
      data: {
        lastSyncAt: new Date(),
        lastError: result.success ? null : result.message,
      },
    });

    await this.logSync({
      channelAccountId: cp.channelAccountId,
      channelProductId: cp.id,
      operation: ChannelSyncOperation.SYNC,
      status: result.success
        ? ChannelSyncStatus.SUCCESS
        : ChannelSyncStatus.ERROR,
      message: result.message,
      details: result.rawResponse,
    });

    return result;
  }

  async unpublishProduct(channelProductId: string, userId?: string) {
    const cp = await this.prisma.channelProduct.findUnique({
      where: { id: channelProductId },
      include: {
        channelAccount: { include: { channel: true } },
      },
    });
    if (!cp)
      throw new NotFoundException(
        `Produto de canal ${channelProductId} não encontrado.`,
      );

    const connector = this.getConnector(cp.channelAccount.channel.type);

    const start = Date.now();
    let result: { success: boolean; message?: string } = {
      success: true,
      message: 'Despublicado localmente',
    };

    if (cp.externalProductId) {
      result = await connector.unpublishProduct(
        cp.externalProductId,
        (cp.channelAccount.configuration as Record<string, any>) || {},
      );
    }
    const durationMs = Date.now() - start;

    const updated = await this.prisma.channelProduct.update({
      where: { id: channelProductId },
      data: {
        status: ChannelProductStatus.UNPUBLISHED,
        lastSyncAt: new Date(),
      },
    });

    await this.logSync({
      channelAccountId: cp.channelAccountId,
      channelProductId: cp.id,
      operation: ChannelSyncOperation.UNPUBLISH,
      status: result.success
        ? ChannelSyncStatus.SUCCESS
        : ChannelSyncStatus.ERROR,
      message: result.message,
      durationMs,
    });

    await this.auditLog.log({
      action: 'MARKETPLACE_PRODUCT_UNPUBLISHED',
      entity: 'ChannelProduct',
      entityId: cp.id,
      userId,
      metadata: {
        productId: cp.productId,
        channelAccountId: cp.channelAccountId,
      },
    });

    return updated;
  }

  // ============================================================
  // 4. CATEGORIAS DE CANAL (Mapeamentos)
  // ============================================================

  async listCategoryMappings(channelId?: string) {
    return this.prisma.channelCategory.findMany({
      where: channelId ? { channelId } : undefined,
      include: {
        channel: true,
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async mapCategory(dto: MapCategoryDto) {
    return this.prisma.channelCategory.upsert({
      where: {
        channelId_categoryId: {
          channelId: dto.channelId,
          categoryId: dto.categoryId,
        },
      },
      create: {
        channelId: dto.channelId,
        categoryId: dto.categoryId,
        externalCategoryId: dto.externalCategoryId,
        externalCategoryName: dto.externalCategoryName,
      },
      update: {
        externalCategoryId: dto.externalCategoryId,
        externalCategoryName: dto.externalCategoryName,
      },
      include: {
        channel: true,
        category: true,
      },
    });
  }

  // ============================================================
  // 5. LOGS DE SINCRONIZAÇÃO E SEGURANÇA
  // ============================================================

  async listSyncLogs(channelAccountId?: string, limit = 50) {
    const logs = await this.prisma.channelSyncLog.findMany({
      where: channelAccountId ? { channelAccountId } : undefined,
      include: {
        channelAccount: {
          include: { channel: true },
        },
        channelProduct: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });

    // Sanitiza logs garantindo que nada sensível seja retornado
    return logs.map((l) => ({
      ...l,
      details: this.sanitizeData(l.details),
    }));
  }

  private async logSync(data: {
    channelAccountId: string;
    channelProductId?: string;
    operation: ChannelSyncOperation;
    status: ChannelSyncStatus;
    message?: string;
    details?: any;
    externalCode?: string;
    durationMs?: number;
  }) {
    try {
      await this.prisma.channelSyncLog.create({
        data: {
          channelAccountId: data.channelAccountId,
          channelProductId: data.channelProductId,
          operation: data.operation,
          status: data.status,
          message: data.message,
          details: this.sanitizeData(data.details),
          externalCode: data.externalCode,
          durationMs: data.durationMs,
        },
      });
    } catch (err: any) {
      this.logger.error(`Falha ao registrar ChannelSyncLog: ${err?.message}`);
    }
  }

  // ============================================================
  // 6. DASHBOARD METRICS
  // ============================================================

  async getDashboardMetrics() {
    const [
      totalChannels,
      activeAccounts,
      publishedProducts,
      totalLogs,
      recentLogs,
    ] = await Promise.all([
      this.prisma.channel.count({ where: { isActive: true } }),
      this.prisma.channelAccount.count({
        where: { status: ChannelAccountStatus.ACTIVE },
      }),
      this.prisma.channelProduct.count({
        where: { status: ChannelProductStatus.PUBLISHED },
      }),
      this.prisma.channelSyncLog.count(),
      this.prisma.channelSyncLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          channelAccount: { include: { channel: true } },
          channelProduct: { include: { product: true } },
        },
      }),
    ]);

    return {
      totalChannels,
      activeAccounts,
      publishedProducts,
      totalLogs,
      recentLogs: recentLogs.map((l) => ({
        ...l,
        details: this.sanitizeData(l.details),
      })),
    };
  }

  // ============================================================
  // UTILITÁRIOS DE SEGURANÇA E HIGIENIZAÇÃO DE DADOS
  // ============================================================

  private sanitizeAccount(account: any): any {
    if (!account) return account;
    const sanitized = { ...account };
    if (sanitized.configuration) {
      const cfg = { ...(sanitized.configuration as Record<string, any>) };
      delete cfg.encAccessToken;
      delete cfg.encRefreshToken;
      delete cfg.accessToken;
      delete cfg.refreshToken;
      delete cfg.clientSecret;
      sanitized.configuration = cfg;
    }
    return sanitized;
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;
    const sensitiveRegex = /(token|secret|password|authorization|cookie|key)/i;

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (sensitiveRegex.test(k)) {
        clean[k] = '[REDACTED]';
      } else if (v && typeof v === 'object') {
        clean[k] = this.sanitizeData(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }
}
