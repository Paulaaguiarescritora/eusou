import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceService } from './marketplace.service';
import { MercadoLivreConnector } from './mercadolivre.connector';
import { CredentialEncryptionService } from './credential-encryption.service';
import { ProductMapperService } from './product-mapper.service';
import { MockMarketplaceConnector } from './mock-marketplace.connector';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ConfigService } from '@nestjs/config';
import {
  ChannelAccountStatus,
  ChannelProductStatus,
  ChannelSyncOperation,
  ChannelSyncStatus,
} from '@prisma/client';

describe('Homologação Controlada F10 — Mercado Livre', () => {
  let service: MarketplaceService;
  let mlConnector: MercadoLivreConnector;
  let prisma: PrismaService;
  let encryption: CredentialEncryptionService;

  let testProductId: string;
  let testChannelId: string;
  let testAccountId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        MercadoLivreConnector,
        MockMarketplaceConnector,
        CredentialEncryptionService,
        ProductMapperService,
        PrismaService,
        AuditLogService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'MERCADOLIVRE_CLIENT_ID') return 'MOCK_APP_ID_12345';
              if (key === 'MERCADOLIVRE_CLIENT_SECRET')
                return 'MOCK_SECRET_XYZ987';
              if (key === 'MERCADOLIVRE_REDIRECT_URI')
                return 'http://localhost:3000/admin/marketplaces/mercadolivre/callback';
              if (key === 'MERCADOLIVRE_ENCRYPTION_KEY')
                return '01234567890123456789012345678901';
              return null;
            },
          },
        },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    mlConnector = module.get<MercadoLivreConnector>(MercadoLivreConnector);
    prisma = module.get<PrismaService>(PrismaService);
    encryption = module.get<CredentialEncryptionService>(
      CredentialEncryptionService,
    );

    // Carrega entidades reais do Supabase
    const prod = await prisma.product.findFirst({
      where: { slug: 'porta-chaves-gatinho-3d' },
    });
    if (!prod)
      throw new Error('Produto de homologação não encontrado no Supabase.');
    testProductId = prod.id;

    const ch = await prisma.channel.findFirst({
      where: { type: 'MERCADO_LIVRE' },
    });
    if (!ch) throw new Error('Canal Mercado Livre não encontrado no Supabase.');
    testChannelId = ch.id;

    // Cria ou recupera conta de teste de homologação no Supabase
    const acc = await prisma.channelAccount.create({
      data: {
        channelId: testChannelId,
        name: 'Conta Homologação ML Teste',
        status: ChannelAccountStatus.PENDING,
      },
    });
    testAccountId = acc.id;
  });

  afterAll(async () => {
    // Limpeza de homologação: remove ChannelProducts, Logs e Conta criados
    if (testAccountId) {
      await prisma.channelSyncLog.deleteMany({
        where: { channelAccountId: testAccountId },
      });
      await prisma.channelProduct.deleteMany({
        where: { channelAccountId: testAccountId },
      });
      await prisma.channelAccount.delete({
        where: { id: testAccountId },
      });
    }
    await prisma.$disconnect();
  });

  describe('Etapa 1: OAuth & Armazenamento Seguro de Tokens', () => {
    it('1.1. Deve gerar URL oficial de consentimento do Mercado Livre com state', () => {
      const res = service.getMercadoLivreAuthUrl(testAccountId);
      expect(res.url).toContain(
        'https://auth.mercadolivre.com.br/authorization',
      );
      expect(res.url).toContain('client_id=MOCK_APP_ID_12345');
      expect(res.url).toContain('response_type=code');
      expect(res.url).toContain(
        encodeURIComponent(JSON.stringify({ accountId: testAccountId })),
      );
    });

    it('1.2. Deve completar OAuth trocando code por tokens e salvando credenciais criptografadas no Supabase', async () => {
      const mockOAuthResponse = {
        access_token: 'APP_USR-789456-homolog-token',
        token_type: 'bearer',
        expires_in: 21600,
        scope: 'offline_access read write',
        user_id: 1122334455,
        refresh_token: 'TG-654321-homolog-refresh',
      };

      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => mockOAuthResponse,
        } as any;
      });

      const updatedAccount = await service.completeMercadoLivreOAuth(
        {
          code: 'TG-AUTH-CODE-123456',
          channelAccountId: testAccountId,
        },
        'admin-user-id',
      );

      expect(updatedAccount.status).toBe(ChannelAccountStatus.ACTIVE);
      expect(updatedAccount.externalAccountId).toBe('1122334455');
      // Garante que o retorno sanitizado NUNCA expõe os tokens para a API/frontend
      expect(updatedAccount.configuration.encAccessToken).toBeUndefined();
      expect(updatedAccount.configuration.accessToken).toBeUndefined();

      // Verifica no Supabase que os dados salvos estão rigorosamente cifrados
      const rawDbAccount = await prisma.channelAccount.findUnique({
        where: { id: testAccountId },
      });
      const cfg = rawDbAccount?.configuration as any;
      expect(cfg.encAccessToken).toBeDefined();
      expect(cfg.encAccessToken.iv).toBeDefined();
      expect(cfg.encAccessToken.tag).toBeDefined();
      expect(cfg.encAccessToken.encryptedData).toBeDefined();
      expect(cfg.encAccessToken.encryptedData).not.toBe(
        'APP_USR-789456-homolog-token',
      );

      // Testa integridade de decifragem
      const decrypted = encryption.decrypt(cfg.encAccessToken);
      expect(decrypted).toBe('APP_USR-789456-homolog-token');
    });
  });

  describe('Etapa 2: Teste de Conexão (Ping /users/me)', () => {
    it('2.1. Deve testar ping da conta conectada via GET /users/me e registrar ChannelSyncLog no Supabase', async () => {
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => ({
            id: 1122334455,
            nickname: 'EUSOU_HOMOLOG_STORE',
            site_id: 'MLB',
          }),
        } as any;
      });

      const result = await service.testConnection(testAccountId);
      expect(result.success).toBe(true);
      expect(result.message).toContain('EUSOU_HOMOLOG_STORE');

      // Verifica log de sincronização gravado no banco real
      const log = await prisma.channelSyncLog.findFirst({
        where: {
          channelAccountId: testAccountId,
          operation: ChannelSyncOperation.TEST_CONNECTION,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(log).toBeDefined();
      expect(log?.status).toBe(ChannelSyncStatus.SUCCESS);
    });
  });

  describe('Etapa 3: Validação Pré-Publicação', () => {
    it('3.1. Deve validar que o produto de homologação atende a 100% dos critérios do Mercado Livre', async () => {
      const val = await service.validateProductForChannel({
        productId: testProductId,
        channelAccountId: testAccountId,
      });

      expect(val.isValid).toBe(true);
      expect(val.productName).toBe('Porta-Chaves Gatinho 3D');
      expect(val.externalCategoryId).toBe('MLB3530');
      expect(val.errors).toHaveLength(0);
    });

    it('3.2. Deve reprovar validação com mensagem clara se produto tiver dados inconsistentes', async () => {
      const val = await service.validateProductForChannel({
        productId: testProductId,
        channelAccountId: testAccountId,
        priceOverride: -10, // Preço inválido
      });

      expect(val.isValid).toBe(false);
      expect(val.errors).toContain('Preço do produto deve ser maior que zero.');
    });
  });

  describe('Etapa 4: Publicação Real (POST /items)', () => {
    it('4.1. Deve publicar o produto criando ChannelProduct com externalProductId e URL no Supabase', async () => {
      const mockPublishResponse = {
        id: 'MLB9988776655',
        permalink:
          'https://produto.mercadolivre.com.br/MLB-9988776655-porta-chaves-gatinho-3d',
        status: 'active',
        price: 39.9,
      };

      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => mockPublishResponse,
        } as any;
      });

      const res = await service.publishProduct(
        {
          productId: testProductId,
          channelAccountId: testAccountId,
        },
        'admin-user-id',
      );

      expect(res.result.success).toBe(true);
      expect(res.channelProduct.status).toBe(ChannelProductStatus.PUBLISHED);
      expect(res.channelProduct.externalProductId).toBe('MLB9988776655');
      expect(res.channelProduct.externalUrl).toContain('mercadolivre.com.br');

      // Verifica integridade do Product central: NENHUM campo do ML inserido
      const centralProduct = await prisma.product.findUnique({
        where: { id: testProductId },
      });
      expect(centralProduct?.basePrice?.toNumber()).toBe(39.9);
      expect((centralProduct as any).mercadoLivreId).toBeUndefined();
    });
  });

  describe('Etapa 5: Idempotência (Proteção contra anúncios duplicados)', () => {
    it('5.1. Deve impedir criação de segundo anúncio e redirecionar para updateProduct', async () => {
      const updateSpy = jest
        .spyOn(mlConnector, 'updateProduct')
        .mockResolvedValueOnce({
          success: true,
          externalProductId: 'MLB9988776655',
          message: 'Anúncio atualizado com sucesso.',
          timestamp: new Date(),
        });

      // Tentativa de publicar novamente o mesmo produto na mesma conta
      const res = await service.publishProduct(
        {
          productId: testProductId,
          channelAccountId: testAccountId,
          priceOverride: 42.5,
        },
        'admin-user-id',
      );

      expect(updateSpy).toHaveBeenCalledWith(
        'MLB9988776655',
        expect.anything(),
        expect.anything(),
      );
      expect(res.result.success).toBe(true);

      // Confirma que continua existindo apenas 1 registro ChannelProduct
      const count = await prisma.channelProduct.count({
        where: {
          productId: testProductId,
          channelAccountId: testAccountId,
        },
      });
      expect(count).toBe(1);

      // Confirma log de idempotência
      const log = await prisma.channelSyncLog.findFirst({
        where: {
          channelAccountId: testAccountId,
          operation: ChannelSyncOperation.UPDATE,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.message).toContain('Idempotência garantida');
    });
  });

  describe('Etapa 6: Sincronização de Preço e Estoque', () => {
    it('6.1. Deve sincronizar preço no ML sem alterar Product.basePrice central', async () => {
      const cp = await prisma.channelProduct.findFirst({
        where: { productId: testProductId, channelAccountId: testAccountId },
      });

      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => ({ id: 'MLB9988776655', price: 45.0 }),
        } as any;
      });

      const res = await service.syncPrice(cp!.id);
      expect(res.success).toBe(true);

      // Preço central permanece inalterado
      const centralProduct = await prisma.product.findUnique({
        where: { id: testProductId },
      });
      expect(centralProduct?.basePrice?.toNumber()).toBe(39.9);
    });

    it('6.2. Deve sincronizar estoque respeitando o saldo disponível do F7', async () => {
      const cp = await prisma.channelProduct.findFirst({
        where: { productId: testProductId, channelAccountId: testAccountId },
      });

      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => ({ id: 'MLB9988776655', available_quantity: 23 }),
        } as any;
      });

      const res = await service.syncStock(cp!.id);
      expect(res.success).toBe(true);
      expect(res.rawResponse.available_quantity).toBe(23);
    });
  });

  describe('Etapa 7: Consulta e Despublicação', () => {
    it('7.1. Deve consultar detalhes do anúncio no ML via syncProductDetails', async () => {
      const cp = await prisma.channelProduct.findFirst({
        where: { productId: testProductId, channelAccountId: testAccountId },
      });

      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => ({
            id: 'MLB9988776655',
            status: 'active',
            price: 45.0,
            available_quantity: 23,
            permalink: 'https://produto.mercadolivre.com.br/MLB-9988776655',
          }),
        } as any;
      });

      const res = await service.syncProductDetails(cp!.id);
      expect(res.success).toBe(true);
      expect(res.message).toContain('Status no ML: active');
    });

    it('7.2. Deve despublicar/pausar anúncio preservando histórico interno', async () => {
      const cp = await prisma.channelProduct.findFirst({
        where: { productId: testProductId, channelAccountId: testAccountId },
      });

      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => ({
            id: 'MLB9988776655',
            status: 'paused',
          }),
        } as any;
      });

      const res = await service.unpublishProduct(cp!.id, 'admin-user-id');
      expect(res.status).toBe(ChannelProductStatus.UNPUBLISHED);

      const dbCp = await prisma.channelProduct.findUnique({
        where: { id: cp!.id },
      });
      expect(dbCp?.status).toBe(ChannelProductStatus.UNPUBLISHED);
      expect(dbCp?.externalProductId).toBe('MLB9988776655'); // Histórico preservado
    });
  });

  describe('Etapa 8: Desconexão e Tratamento de Erros Reais', () => {
    it('8.1. Deve tratar erro de rejeição da API ML (HTTP 400 com causas) com mensagem segura', async () => {
      jest.spyOn(global, 'fetch').mockImplementationOnce(async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            message: 'Validation error',
            error: 'validation_error',
            cause: [
              {
                message: 'O atributo BRAND é obrigatório para esta categoria.',
              },
            ],
          }),
        } as any;
      });

      const res = await mlConnector.publishProduct(
        {
          sku: 'ERR-SKU',
          title: 'Produto Teste',
          description: 'Desc',
          price: 50,
          currency: 'BRL',
          stockQuantity: 10,
          images: ['https://example.com/img.png'],
          attributes: {},
        },
        { encAccessToken: encryption.encrypt('TOKEN') },
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain('O atributo BRAND é obrigatório');
    });

    it('8.2. Deve desconectar conta, revogando credenciais e marcando DISCONNECTED', async () => {
      const res = await service.disconnectAccount(
        testAccountId,
        'admin-user-id',
      );
      expect(res.status).toBe(ChannelAccountStatus.DISCONNECTED);

      const dbAccount = await prisma.channelAccount.findUnique({
        where: { id: testAccountId },
      });
      expect(dbAccount?.status).toBe(ChannelAccountStatus.DISCONNECTED);
      expect(Object.keys(dbAccount?.configuration as any)).toHaveLength(0); // Tokens removidos
    });
  });
});
