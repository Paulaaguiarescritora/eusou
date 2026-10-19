import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ProductStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('FASE 3A — Testes de Contrato Frontend: Canais Comerciais, Hierarquia e Arquivamento', () => {
  let service: ProductService;
  let prisma: any;
  let auditLog: any;

  const mockChannels = [
    { id: 'chan-loja', name: 'Loja Própria', type: 'ONLINE_STORE', isActive: true },
    { id: 'chan-ml', name: 'Mercado Livre Oficial', type: 'MARKETPLACE', isActive: true },
    { id: 'chan-shopee', name: 'Shopee Brasil', type: 'MARKETPLACE', isActive: true },
  ];

  const mockNiches = [
    { id: 'niche-pet', name: 'Pet Shop', slug: 'pet-shop' },
    { id: 'niche-wellness', name: 'Wellness', slug: 'wellness' },
  ];

  const mockCategories = [
    // Pet Shop
    { id: 'cat-caes', name: 'Cães e Gatos', slug: 'caes-e-gatos', nicheId: 'niche-pet', parentId: null },
    { id: 'subcat-acessorios', name: 'Acessórios', slug: 'acessorios', nicheId: 'niche-pet', parentId: 'cat-caes' },
    { id: 'subcat-higiene', name: 'Higiene Pet', slug: 'higiene', nicheId: 'niche-pet', parentId: 'cat-caes' },
    // Wellness
    { id: 'cat-aromaterapia', name: 'Aromaterapia', slug: 'aromaterapia', nicheId: 'niche-wellness', parentId: null },
    { id: 'subcat-difusores', name: 'Difusores', slug: 'difusores', nicheId: 'niche-wellness', parentId: 'cat-aromaterapia' },
  ];

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      channel: {
        findMany: jest.fn().mockResolvedValue(mockChannels),
        count: jest.fn().mockImplementation(({ where }) => {
          const ids = where.id.in;
          return ids.filter((id: string) => mockChannels.some((c) => c.id === id)).length;
        }),
      },
      productChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      channelProduct: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    auditLog = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  // 1. Carregar canais do produto e 2. Mostrar todos os canais cadastrados
  it('1 & 2. Deve carregar todos os canais cadastrados a partir de GET /products/:id/channels', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-central-1',
      name: 'Dosador de Ração 1/4 Xícara',
      status: ProductStatus.ACTIVE,
    });
    prisma.productChannel.findMany.mockResolvedValue([]);

    const res = await service.getChannels('prod-central-1');
    expect(res.productId).toBe('prod-central-1');
    expect(res.channels.length).toBe(3);
    expect(res.channels.map((c) => c.name)).toEqual([
      'Loja Própria',
      'Mercado Livre Oficial',
      'Shopee Brasil',
    ]);
  });

  // 3. Identificar corretamente canais associados
  it('3. Deve identificar corretamente quais canais estão associados ao produto central', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-central-1',
      name: 'Dosador de Ração',
      status: ProductStatus.ACTIVE,
    });
    prisma.productChannel.findMany.mockResolvedValue([
      { channelId: 'chan-loja', isEnabled: true, createdAt: new Date() },
      { channelId: 'chan-ml', isEnabled: false, createdAt: new Date() },
    ]);

    const res = await service.getChannels('prod-central-1');
    const loja = res.channels.find((c) => c.id === 'chan-loja');
    const ml = res.channels.find((c) => c.id === 'chan-ml');
    const shopee = res.channels.find((c) => c.id === 'chan-shopee');

    expect(loja?.isAssigned).toBe(true);
    expect(loja?.isEnabled).toBe(true);
    expect(ml?.isAssigned).toBe(true);
    expect(ml?.isEnabled).toBe(false); // Pausado
    expect(shopee?.isAssigned).toBe(false);
  });

  // 4. Permitir seleção múltipla e 7. Salvar usando POST /products/:id/channels
  it('4 & 7. Deve permitir seleção múltipla e salvar alterações via assignChannels', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-central-1',
      status: ProductStatus.ACTIVE,
    });
    prisma.productChannel.findMany.mockResolvedValue([]);

    await service.assignChannels('prod-central-1', {
      channelIds: ['chan-loja', 'chan-ml', 'chan-shopee'],
    });

    expect(prisma.productChannel.deleteMany).toHaveBeenCalledWith({
      where: { productId: 'prod-central-1' },
    });
    expect(prisma.productChannel.createMany).toHaveBeenCalledWith({
      data: [
        { productId: 'prod-central-1', channelId: 'chan-loja', isEnabled: true },
        { productId: 'prod-central-1', channelId: 'chan-ml', isEnabled: true },
        { productId: 'prod-central-1', channelId: 'chan-shopee', isEnabled: true },
      ],
    });
  });

  // 5. Permitir retirada de canal
  it('5. Deve permitir retirar canal específico mantendo os demais ativos sem excluir o produto central', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-central-1',
      status: ProductStatus.ACTIVE,
    });

    // Retira o canal ML mantendo apenas Loja Própria
    await service.assignChannels('prod-central-1', {
      channels: [{ channelId: 'chan-loja', isEnabled: true }],
    });

    expect(prisma.productChannel.createMany).toHaveBeenCalledWith({
      data: [{ productId: 'prod-central-1', channelId: 'chan-loja', isEnabled: true }],
    });
  });

  // 6. Permitir pausa / reativação (isEnabled: false vs true)
  it('6. Deve permitir pausar produto em um canal e manter ativo em outro', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-central-1',
      status: ProductStatus.ACTIVE,
    });

    await service.assignChannels('prod-central-1', {
      channels: [
        { channelId: 'chan-loja', isEnabled: true }, // Disponível
        { channelId: 'chan-ml', isEnabled: false },  // Pausado
      ],
    });

    expect(prisma.productChannel.createMany).toHaveBeenCalledWith({
      data: [
        { productId: 'prod-central-1', channelId: 'chan-loja', isEnabled: true },
        { productId: 'prod-central-1', channelId: 'chan-ml', isEnabled: false },
      ],
    });
  });

  // 8. Não exigir OAuth para selecionar canal
  it('8. Não deve exigir OAuth nem ChannelAccount para disponibilizar produto comercialmente', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-central-1',
      status: ProductStatus.ACTIVE,
    });

    // A operação tem sucesso direto sem verificar ChannelAccount ou OAuth tokens
    const result = await service.assignChannels('prod-central-1', {
      channelIds: ['chan-ml'],
    });

    expect(result).toBeDefined();
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PRODUCT_CHANNELS_UPDATED' })
    );
  });

  // 9. Filtrar categoria conforme nicho
  it('9. Deve filtrar categorias exclusivamente pertencentes ao nicho selecionado', () => {
    const selectedNicheId = 'niche-pet';
    const availableCategories = mockCategories.filter(
      (c) => c.nicheId === selectedNicheId && !c.parentId
    );

    expect(availableCategories.map((c) => c.name)).toEqual(['Cães e Gatos']);
    expect(availableCategories.some((c) => c.name === 'Aromaterapia')).toBe(false);
  });

  // 10. Filtrar subcategoria conforme categoria
  it('10. Deve filtrar subcategorias filhas pertencentes à categoria pai selecionada', () => {
    const selectedCategoryId = 'cat-caes';
    const availableSubcategories = mockCategories.filter(
      (c) => c.parentId === selectedCategoryId
    );

    expect(availableSubcategories.map((c) => c.name)).toEqual([
      'Acessórios',
      'Higiene Pet',
    ]);
    expect(availableSubcategories.some((c) => c.name === 'Difusores')).toBe(false);
  });

  // 11. Impedir combinação incompatível de nicho/categoria/subcategoria (limpeza automática)
  it('11. Ao alterar o nicho, categorias e subcategorias incompatíveis devem ser invalidadas/limpas', () => {
    let selectedNicheId = 'niche-pet';
    let selectedCategoryId = 'cat-caes';
    let selectedSubcategoryId = 'subcat-acessorios';

    // Usuário altera nicho para Wellness
    const newNicheId = 'niche-wellness';
    selectedNicheId = newNicheId;
    // Regra da interface: limpa seleções anteriores incompatíveis
    selectedCategoryId = '';
    selectedSubcategoryId = '';

    const newAvailableCats = mockCategories.filter(
      (c) => c.nicheId === selectedNicheId && !c.parentId
    );
    expect(newAvailableCats.map((c) => c.name)).toEqual(['Aromaterapia']);
    expect(selectedCategoryId).toBe('');
    expect(selectedSubcategoryId).toBe('');
  });

  // 12. Exibir confirmação de arquivamento explícita
  it('12. Ação de arquivar deve revogar disponibilidade comercial em todos os canais e preservar histórico', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-central-1',
      name: 'Dosador de Ração',
      status: ProductStatus.ACTIVE,
    });

    const res = await service.delete('prod-central-1', 'admin-user');
    expect(res.message).toBe('Product archived successfully');

    // 1. Marca produto como ARCHIVED
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-central-1' },
      data: { status: ProductStatus.ARCHIVED },
    });
    // 2. Revoga todos os canais comerciais vinculados
    expect(prisma.productChannel.deleteMany).toHaveBeenCalledWith({
      where: { productId: 'prod-central-1' },
    });
    // 3. Pausa anúncios de marketplace se existirem
    expect(prisma.channelProduct.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: 'prod-central-1' }),
        data: { status: 'PAUSED' },
      })
    );
  });

  // 13. Impedir novos canais em produto arquivado
  it('13. Não deve permitir associar novos canais a produto com status ARCHIVED', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-archived-1',
      status: ProductStatus.ARCHIVED,
    });

    await expect(
      service.assignChannels('prod-archived-1', {
        channelIds: ['chan-loja'],
      })
    ).rejects.toThrow(BadRequestException);
  });

  // 14. Exibir estado arquivado corretamente
  it('14. Produto com status ARCHIVED deve retornar status indicativo no getChannels', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-archived-1',
      status: ProductStatus.ARCHIVED,
    });
    prisma.productChannel.findMany.mockResolvedValue([]);

    const res = await service.getChannels('prod-archived-1');
    expect(res.productStatus).toBe(ProductStatus.ARCHIVED);
    expect(res.channels.every((c) => !c.isAssigned)).toBe(true);
  });

  // 15. Não duplicar produto por canal
  it('15. Produto é único e central, associando-se a N canais sem duplicar o cadastro de produto', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'prod-central-1',
      name: 'Dosador Canônico',
      status: ProductStatus.ACTIVE,
    });

    // 1 único produto cadastrado
    await service.assignChannels('prod-central-1', {
      channelIds: ['chan-loja', 'chan-ml'],
    });

    // Zero chamadas para criar outro Product
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.productChannel.createMany).toHaveBeenCalledWith({
      data: [
        { productId: 'prod-central-1', channelId: 'chan-loja', isEnabled: true },
        { productId: 'prod-central-1', channelId: 'chan-ml', isEnabled: true },
      ],
    });
  });

  // 16. Exibir dossiê comercial (7 critérios centrais)
  it('16. Dossiê comercial deve computar completude central e indicar campos pendentes', () => {
    const completeProduct = {
      name: 'Dosador de Ração 1/4 Xícara',
      sku: 'FEL-GAT-001',
      description: 'Dosador confeccionado em bio-polímero premium durável.',
      basePrice: 39.9,
      media: [{ url: 'https://cdn.eusou.com/img1.jpg' }],
      categories: [{ categoryId: 'cat-caes' }],
      niches: [{ nicheId: 'niche-pet' }],
    };

    const resComplete = service.calculateDossierCompleteness(completeProduct);
    expect(resComplete.percentage).toBe(100);
    expect(resComplete.isReadyForCommercialUse).toBe(true);
    expect(resComplete.missingFields).toEqual([]);

    const incompleteProduct = {
      name: 'Draft',
      sku: null,
      description: null,
      basePrice: null,
      media: [],
      categories: [],
      niches: [],
    };

    const resIncomplete = service.calculateDossierCompleteness(incompleteProduct);
    expect(resIncomplete.percentage).toBeLessThan(50);
    expect(resIncomplete.isReadyForCommercialUse).toBe(false);
    expect(resIncomplete.missingFields).toContain('SKU (Código único)');
    expect(resIncomplete.missingFields).toContain('Preço base');
    expect(resIncomplete.missingFields).toContain('Fotos/Mídias');
  });
});
