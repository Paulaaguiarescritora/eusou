import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ProductStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ProductService - Commercial Channels & Dossier (Phase 2)', () => {
  let service: ProductService;
  let prisma: any;
  let auditLog: any;

  const mockChannels = [
    { id: 'chan-loja', name: 'Loja Própria', type: 'ONLINE_STORE', isActive: true },
    { id: 'chan-ml', name: 'Mercado Livre', type: 'MARKETPLACE', isActive: true },
    { id: 'chan-shopee', name: 'Shopee', type: 'MARKETPLACE', isActive: true },
    { id: 'chan-b2b', name: 'B2B / Corporativo', type: 'DIRECT_SALE', isActive: false },
  ];

  let mockProductChannels: any[] = [];
  let mockProducts: any[] = [];
  let mockChannelProducts: any[] = [];

  beforeEach(async () => {
    mockProductChannels = [];
    mockProducts = [
      {
        id: 'prod-1',
        name: 'Camisa Algodão Egípcio EuSou',
        slug: 'camisa-algodao-egipcio-eusou',
        sku: 'CAM-EGI-001',
        status: ProductStatus.ACTIVE,
        basePrice: 149.9,
        shortDescription: 'Camisa confeccionada em algodão nobre.',
        description: 'Camisa premium com acabamento refinado para uso versátil.',
        media: [{ id: 'med-1', url: 'https://cdn.eusou.com/foto1.jpg' }],
        categories: [{ categoryId: 'cat-1' }],
        niches: [{ nicheId: 'niche-1' }],
        productChannels: [],
      },
      {
        id: 'prod-archived',
        name: 'Produto Descontinuado',
        slug: 'produto-descontinuado',
        sku: 'PROD-DESC-99',
        status: ProductStatus.ARCHIVED,
        basePrice: 50.0,
        media: [],
        categories: [],
        niches: [],
        productChannels: [],
      },
      {
        id: 'prod-incomplete',
        name: 'Draft Incompleto',
        slug: 'draft-incompleto',
        sku: null,
        status: ProductStatus.DRAFT,
        basePrice: null,
        shortDescription: null,
        description: null,
        media: [],
        categories: [],
        niches: [],
        productChannels: [],
      },
    ];

    mockChannelProducts = [
      {
        id: 'cp-1',
        productId: 'prod-1',
        channelId: 'chan-ml',
        status: 'PUBLISHED',
      },
    ];

    prisma = {
      product: {
        findUnique: jest.fn(async ({ where }) => {
          return mockProducts.find((p) => p.id === where.id) || null;
        }),
        update: jest.fn(async ({ where, data }) => {
          const idx = mockProducts.findIndex((p) => p.id === where.id);
          if (idx === -1) return null;
          mockProducts[idx] = { ...mockProducts[idx], ...data };
          return mockProducts[idx];
        }),
      },
      channel: {
        findMany: jest.fn(async () => [...mockChannels]),
        count: jest.fn(async ({ where }) => {
          if (where?.id?.in) {
            return mockChannels.filter((c) => where.id.in.includes(c.id)).length;
          }
          return mockChannels.length;
        }),
      },
      productChannel: {
        findMany: jest.fn(async ({ where }) => {
          return mockProductChannels.filter((pc) => pc.productId === where.productId);
        }),
        deleteMany: jest.fn(async ({ where }) => {
          const before = mockProductChannels.length;
          mockProductChannels = mockProductChannels.filter((pc) => pc.productId !== where.productId);
          return { count: before - mockProductChannels.length };
        }),
        createMany: jest.fn(async ({ data }) => {
          mockProductChannels.push(...data);
          return { count: data.length };
        }),
      },
      channelProduct: {
        updateMany: jest.fn(async ({ where, data }) => {
          let count = 0;
          mockChannelProducts.forEach((cp) => {
            if (cp.productId === where.productId && where.status.in.includes(cp.status)) {
              cp.status = data.status;
              count++;
            }
          });
          return { count };
        }),
      },
      $transaction: jest.fn(async (callback) => {
        return callback(prisma);
      }),
    };

    auditLog = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('getChannels', () => {
    it('1. Deve listar todos os canais comerciais do sistema com isAssigned=false para produto sem canais associados', async () => {
      const result = await service.getChannels('prod-1');

      expect(result.productId).toBe('prod-1');
      expect(result.productName).toBe('Camisa Algodão Egípcio EuSou');
      expect(result.channels).toHaveLength(4);
      result.channels.forEach((c) => {
        expect(c.isAssigned).toBe(false);
        expect(c.isEnabled).toBe(false);
      });
    });

    it('2. Deve indicar canais associados e habilitados/desabilitados corretamente', async () => {
      mockProductChannels = [
        {
          id: 'pc-1',
          productId: 'prod-1',
          channelId: 'chan-loja',
          isEnabled: true,
          createdAt: new Date(),
        },
        {
          id: 'pc-2',
          productId: 'prod-1',
          channelId: 'chan-ml',
          isEnabled: false,
          createdAt: new Date(),
        },
      ];

      const result = await service.getChannels('prod-1');
      const loja = result.channels.find((c) => c.id === 'chan-loja');
      const ml = result.channels.find((c) => c.id === 'chan-ml');
      const shopee = result.channels.find((c) => c.id === 'chan-shopee');

      expect(loja?.isAssigned).toBe(true);
      expect(loja?.isEnabled).toBe(true);
      expect(ml?.isAssigned).toBe(true);
      expect(ml?.isEnabled).toBe(false);
      expect(shopee?.isAssigned).toBe(false);
      expect(shopee?.isEnabled).toBe(false);
    });

    it('3. Deve lançar NotFoundException se o produto não existir', async () => {
      await expect(service.getChannels('prod-inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignChannels', () => {
    it('4. Deve associar múltiplos canais via seleção múltipla usando channelIds (Fase 2)', async () => {
      const result = await service.assignChannels(
        'prod-1',
        { channelIds: ['chan-loja', 'chan-shopee'] },
        'admin-user',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockProductChannels).toHaveLength(2);
      expect(mockProductChannels.map((x) => x.channelId)).toEqual([
        'chan-loja',
        'chan-shopee',
      ]);

      const loja = result.channels.find((c) => c.id === 'chan-loja');
      const shopee = result.channels.find((c) => c.id === 'chan-shopee');
      expect(loja?.isAssigned).toBe(true);
      expect(loja?.isEnabled).toBe(true);
      expect(shopee?.isAssigned).toBe(true);
      expect(shopee?.isEnabled).toBe(true);

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRODUCT_CHANNELS_UPDATED',
          entity: 'Product',
          entityId: 'prod-1',
          userId: 'admin-user',
        }),
      );
    });

    it('5. Deve permitir associar com status isEnabled granular e desativar/remover canais', async () => {
      // Começa com Loja e Shopee
      mockProductChannels = [
        { productId: 'prod-1', channelId: 'chan-loja', isEnabled: true },
        { productId: 'prod-1', channelId: 'chan-shopee', isEnabled: true },
      ];

      // Atualiza: retira Shopee, mantém Loja ativa e inclui ML desabilitado (pausado)
      const result = await service.assignChannels(
        'prod-1',
        {
          channels: [
            { channelId: 'chan-loja', isEnabled: true },
            { channelId: 'chan-ml', isEnabled: false },
          ],
        },
        'admin-user',
      );

      const loja = result.channels.find((c) => c.id === 'chan-loja');
      const ml = result.channels.find((c) => c.id === 'chan-ml');
      const shopee = result.channels.find((c) => c.id === 'chan-shopee');

      expect(loja?.isAssigned).toBe(true);
      expect(loja?.isEnabled).toBe(true);
      expect(ml?.isAssigned).toBe(true);
      expect(ml?.isEnabled).toBe(false);
      expect(shopee?.isAssigned).toBe(false);
    });

    it('6. Deve lançar NotFoundException se algum canal informado não existir', async () => {
      await expect(
        service.assignChannels('prod-1', {
          channelIds: ['chan-loja', 'chan-fantasma'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('7. Deve impedir vincular canais ativos a produtos arquivados (regra de segurança)', async () => {
      await expect(
        service.assignChannels('prod-archived', {
          channelIds: ['chan-loja'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete / archive & cascata de canais comerciais', () => {
    it('8. Exclusão deve arquivar produto e REVOGAR a disponibilidade de todos os canais comerciais', async () => {
      mockProductChannels = [
        { productId: 'prod-1', channelId: 'chan-loja', isEnabled: true },
        { productId: 'prod-1', channelId: 'chan-ml', isEnabled: true },
      ];

      const res = await service.delete('prod-1', 'admin-user');
      expect(res.message).toBe('Product archived successfully');

      // Produto arquivado
      const prod = mockProducts.find((p) => p.id === 'prod-1');
      expect(prod.status).toBe(ProductStatus.ARCHIVED);

      // Associações comerciais revogadas
      expect(mockProductChannels).toHaveLength(0);

      // Anúncios técnicos pausados
      const mlTech = mockChannelProducts.find((cp) => cp.id === 'cp-1');
      expect(mlTech.status).toBe('PAUSED');

      // Auditoria registrada
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRODUCT_ARCHIVED',
          entity: 'Product',
          entityId: 'prod-1',
        }),
      );
    });
  });

  describe('calculateDossierCompleteness', () => {
    it('9. Deve calcular 100% de completude quando todos os 7 critérios do dossiê estiverem preenchidos', () => {
      const prod = mockProducts.find((p) => p.id === 'prod-1');
      const dossier = service.calculateDossierCompleteness(prod);

      expect(dossier.percentage).toBe(100);
      expect(dossier.isReadyForCommercialUse).toBe(true);
      expect(dossier.missingFields).toEqual([]);
    });

    it('10. Deve identificar campos faltantes e indicar quando produto não está pronto para uso comercial', () => {
      const prodIncomplete = mockProducts.find((p) => p.id === 'prod-incomplete');
      const dossier = service.calculateDossierCompleteness(prodIncomplete);

      expect(dossier.percentage).toBe(14); // Apenas Nome preenchido (1 / 7 = 14%)
      expect(dossier.isReadyForCommercialUse).toBe(false);
      expect(dossier.missingFields).toEqual([
        'SKU (Código único)',
        'Descrição comercial',
        'Preço base',
        'Fotos/Mídias',
        'Categoria',
        'Nicho',
      ]);
    });
  });
});
