import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { MarketplaceConnector } from './marketplace-connector.interface';
import { MockMarketplaceConnector } from './mock-marketplace.connector';
import { MercadoLivreConnector } from './mercadolivre.connector';
import { ChannelType, ChannelProductStatus, Prisma } from '@prisma/client';

export interface DiscrepancyReport {
  channelProductId: string;
  productId: string;
  channelName: string;
  externalProductId: string;
  discrepancies: {
    price?: {
      localEffectivePrice: number;
      remotePrice: number;
      delta: number;
    };
    stock?: {
      localAvailableStock: number;
      remoteStock: number;
      delta: number;
    };
    status?: {
      localStatus: string;
      remoteStatus: string;
    };
  };
  hasDiscrepancy: boolean;
}

@Injectable()
export class MarketplaceReconciliationService {
  private readonly logger = new Logger(MarketplaceReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly mockConnector: MockMarketplaceConnector,
    private readonly mlConnector: MercadoLivreConnector,
  ) {}

  private getConnector(channelType?: ChannelType): MarketplaceConnector {
    if (channelType === ChannelType.MERCADO_LIVRE) {
      return this.mlConnector;
    }
    return this.mockConnector;
  }

  /**
   * Reconcilia um produto anunciado com seu estado real no marketplace externo
   */
  async reconcileProduct(channelProductId: string): Promise<DiscrepancyReport> {
    const cp = await this.prisma.channelProduct.findUnique({
      where: { id: channelProductId },
      include: {
        product: {
          include: {
            inventories: true,
          },
        },
        channelAccount: {
          include: { channel: true },
        },
      },
    });

    if (!cp) {
      throw new NotFoundException(`ChannelProduct "${channelProductId}" não encontrado.`);
    }

    if (!cp.externalProductId) {
      throw new BadRequestException(
        `ChannelProduct "${channelProductId}" não possui externalProductId cadastrado.`,
      );
    }

    // 1. Calcula preço efetivo local (F12)
    const effectivePriceDec = await this.pricingService.getEffectivePrice(
      cp.productId,
      cp.channelAccount.channelId,
    );
    const localEffectivePrice = effectivePriceDec
      ? Number(effectivePriceDec)
      : Number(cp.priceOverride || cp.product.basePrice || 0);

    // 2. Calcula estoque disponível local (F7)
    const localAvailableStock = cp.product.inventories.reduce(
      (sum, inv) => sum + Math.max(0, inv.quantity - inv.reservedQuantity),
      0,
    );

    // 3. Consulta estado real no marketplace externo
    const connector = this.getConnector(cp.channelAccount.channel.type);
    const remoteResult = await connector.syncProduct(
      cp.externalProductId,
      (cp.channelAccount.configuration as any) || {},
    );

    const report: DiscrepancyReport = {
      channelProductId: cp.id,
      productId: cp.productId,
      channelName: cp.channelAccount.channel.name,
      externalProductId: cp.externalProductId,
      discrepancies: {},
      hasDiscrepancy: false,
    };

    if (remoteResult.success && remoteResult.rawResponse) {
      const remoteData = remoteResult.rawResponse;
      const remotePrice = Number(remoteData.price || 0);
      const remoteStock = Number(remoteData.available_quantity || 0);
      const remoteStatus = String(remoteData.status || '').toUpperCase();

      // Checa discrepância de preço (> R$ 0.05)
      if (Math.abs(localEffectivePrice - remotePrice) > 0.05) {
        report.discrepancies.price = {
          localEffectivePrice,
          remotePrice,
          delta: remotePrice - localEffectivePrice,
        };
        report.hasDiscrepancy = true;
      }

      // Checa discrepância de estoque
      if (localAvailableStock !== remoteStock) {
        report.discrepancies.stock = {
          localAvailableStock,
          remoteStock,
          delta: remoteStock - localAvailableStock,
        };
        report.hasDiscrepancy = true;
      }

      // Checa discrepância de status (ex: pausado remotamente mas ativo localmente)
      if (
        (remoteStatus === 'PAUSED' && cp.status === ChannelProductStatus.PUBLISHED) ||
        (remoteStatus === 'ACTIVE' && cp.status === ChannelProductStatus.PAUSED)
      ) {
        report.discrepancies.status = {
          localStatus: cp.status,
          remoteStatus,
        };
        report.hasDiscrepancy = true;
      }

      // F13B: Persiste estado observado no ChannelProduct para observabilidade
      await this.prisma.channelProduct.update({
        where: { id: cp.id },
        data: {
          lastObservedPrice: new Prisma.Decimal(remotePrice.toFixed(2)),
          lastObservedStock: remoteStock,
          lastObservedStatus: remoteStatus,
          lastObservedAt: new Date(),
        },
      });
    }

    return report;
  }

  /**
   * Reconciliação em lote por conta de canal
   */
  async reconcileAccount(channelAccountId: string): Promise<DiscrepancyReport[]> {
    const products = await this.prisma.channelProduct.findMany({
      where: {
        channelAccountId,
        status: { in: [ChannelProductStatus.PUBLISHED, ChannelProductStatus.PAUSED] },
        externalProductId: { not: null },
      },
    });

    const results: DiscrepancyReport[] = [];
    for (const p of products) {
      try {
        const report = await this.reconcileProduct(p.id);
        results.push(report);
      } catch (err: any) {
        this.logger.warn(`Erro ao reconciliar anúncio ${p.id}: ${err.message}`);
      }
    }

    return results;
  }
}
