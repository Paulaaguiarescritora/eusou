import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PublicStoreService } from '../public-store/public-store.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { AffiliateService } from '../affiliate/affiliate.service';
import { InventoryService } from '../inventory/inventory.service';
import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

describe('Disponibilidade e Validação de Estoque por Variante na Loja Pública', () => {
  let orderService: OrderService;
  let publicStoreService: PublicStoreService;
  let prisma: any;
  let mockInventoryService: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      productVariant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      inventory: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      catalog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      collection: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      channel: {
        findFirst: jest.fn().mockResolvedValue({ id: 'channel-own', type: 'OWN_STORE', isActive: true }),
      },
      productChannel: {
        findUnique: jest.fn().mockResolvedValue({ isEnabled: true }),
      },
      productChannelPrice: {
        findFirst: jest.fn().mockResolvedValue({ effectivePrice: '29.90', mode: 'AUTOMATIC' }),
      },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      stockMovement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    mockInventoryService = {
      reserveStockForOrder: jest.fn().mockResolvedValue(undefined),
      releaseStockForOrder: jest.fn().mockResolvedValue(undefined),
      handleOrderConfirmed: jest.fn().mockResolvedValue(undefined),
      handleOrderCancelled: jest.fn().mockResolvedValue(undefined),
    };

    const mockAuditLog = { log: jest.fn() };
    const mockAffiliateService = {
      handleOrderCreated: jest.fn().mockResolvedValue(undefined),
      handleOrderStatusChanged: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        PublicStoreService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: AffiliateService, useValue: mockAffiliateService },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
    publicStoreService = module.get<PublicStoreService>(PublicStoreService);
  });

  // ---------------------------------------------------------------------------
  // 1. VARIANTE SEM ESTOQUE NÃO PODE SER COMPRADA
  // ---------------------------------------------------------------------------
  describe('1. Variante sem estoque não pode ser comprada', () => {
    it('deve marcar variante sem estoque como indisponível no carrinho sem permitir prosseguir', async () => {
      // Bolinha de Purga - Variante Branca com estoque 0
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-bolinha',
        name: 'Bolinha de Purga',
        status: 'ACTIVE',
        variants: [
          { id: 'var-branca', name: 'Branca', sku: 'FEL-BOL-001-bc', isActive: true },
        ],
      });

      prisma.inventory.findFirst.mockResolvedValue({
        productId: 'prod-bolinha',
        variantId: 'var-branca',
        quantity: 0,
        reservedQuantity: 0,
      });

      const result = await publicStoreService.validateCart([
        { productId: 'prod-bolinha', variantId: 'var-branca', quantity: 1 },
      ]);

      expect(result.isValid).toBe(false);
      expect(result.items[0].inStock).toBe(false);
      expect(result.items[0].availableStock).toBe(0);
      expect(result.items[0].error).toBe('Esta variante está esgotada.');
    });

    it('deve rejeitar checkout com erro amigável quando variante estiver com estoque zerado', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-bolinha',
        name: 'Bolinha de Purga',
        sku: 'FEL-BOL-001',
        status: 'ACTIVE',
      });

      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'var-branca',
        name: 'Branca',
        sku: 'FEL-BOL-001-bc',
        productId: 'prod-bolinha',
        isActive: true,
      });

      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-branca', name: 'Branca', sku: 'FEL-BOL-001-bc', isActive: true },
      ]);

      prisma.inventory.findFirst.mockResolvedValue({
        productId: 'prod-bolinha',
        variantId: 'var-branca',
        quantity: 0,
        reservedQuantity: 0,
      });

      await expect(
        orderService.create({
          customerName: 'Cliente Teste',
          customerEmail: 'cliente@teste.com',
          customerPhone: '11999999999',
          street: 'Rua A',
          number: '10',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01000-000',
          items: [{ productId: 'prod-bolinha', variantId: 'var-branca', quantity: 1 }],
        }),
      ).rejects.toThrow(new BadRequestException('Esta variante está esgotada: "Bolinha de Purga - Branca".'));

      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(mockInventoryService.reserveStockForOrder).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. VARIANTE COM ESTOQUE PODE SER COMPRADA
  // ---------------------------------------------------------------------------
  describe('2. Variante com estoque pode ser comprada', () => {
    it('deve aprovar carrinho quando quantidade solicitada estiver dentro do estoque disponível', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-gatinho',
        name: 'Porta Chaves Gatinho',
        status: 'ACTIVE',
        variants: [
          { id: 'var-vermelho', name: 'Vermelho', sku: 'FEL-GAT-001-VER', isActive: true },
        ],
      });

      prisma.inventory.findFirst.mockResolvedValue({
        productId: 'prod-gatinho',
        variantId: 'var-vermelho',
        quantity: 5,
        reservedQuantity: 1, // Disponível: 4
      });

      const result = await publicStoreService.validateCart([
        { productId: 'prod-gatinho', variantId: 'var-vermelho', quantity: 2 },
      ]);

      expect(result.isValid).toBe(true);
      expect(result.items[0].inStock).toBe(true);
      expect(result.items[0].availableStock).toBe(4);
      expect(result.items[0].error).toBeNull();
    });

    it('deve permitir criação do pedido e reserva de estoque para variante com estoque suficiente', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-gatinho',
        name: 'Porta Chaves Gatinho',
        sku: 'FEL-GAT-001',
        status: 'ACTIVE',
      });

      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'var-vermelho',
        name: 'Vermelho',
        sku: 'FEL-GAT-001-VER',
        productId: 'prod-gatinho',
        isActive: true,
      });

      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-vermelho', name: 'Vermelho', sku: 'FEL-GAT-001-VER', isActive: true },
      ]);

      prisma.inventory.findFirst.mockResolvedValue({
        productId: 'prod-gatinho',
        variantId: 'var-vermelho',
        quantity: 5,
        reservedQuantity: 0,
      });

      prisma.order.create.mockResolvedValue({
        id: 'order-variant-ok',
        customerName: 'Cliente Feliz',
        status: OrderStatus.PENDING,
        total: '59.80',
        items: [{ id: 'item-v1', productId: 'prod-gatinho', variantId: 'var-vermelho', quantity: 2 }],
      });

      const order = await orderService.create({
        customerName: 'Cliente Feliz',
        customerEmail: 'feliz@teste.com',
        customerPhone: '11999999999',
        street: 'Rua das Flores',
        number: '123',
        neighborhood: 'Jardins',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01000-000',
        items: [{ productId: 'prod-gatinho', variantId: 'var-vermelho', quantity: 2 }],
      });

      expect(order.id).toBe('order-variant-ok');
      expect(prisma.order.create).toHaveBeenCalled();
      expect(mockInventoryService.reserveStockForOrder).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. NENHUMA QUANTIDADE DE ESTOQUE SEJA EXIBIDA NA INTERFACE PÚBLICA
  // ---------------------------------------------------------------------------
  describe('3. Regra comercial: nenhuma quantidade de estoque deve ser revelada ao cliente público', () => {
    it('mensagens de erro do carrinho não devem expor números de saldo em estoque', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-bolinha',
        name: 'Bolinha de Purga',
        status: 'ACTIVE',
        variants: [
          { id: 'var-azul', name: 'Azul', sku: 'FEL-BOL-001-az', isActive: true },
        ],
      });

      prisma.inventory.findFirst.mockResolvedValue({
        productId: 'prod-bolinha',
        variantId: 'var-azul',
        quantity: 3,
        reservedQuantity: 0,
      });

      const result = await publicStoreService.validateCart([
        { productId: 'prod-bolinha', variantId: 'var-azul', quantity: 5 },
      ]);

      expect(result.isValid).toBe(false);
      // Mensagem genérica e comercialmente segura (sem vazar 3 ou 5)
      expect(result.items[0].error).toBe('Quantidade solicitada indisponível em estoque.');
      expect(result.items[0].error).not.toMatch(/Disponível|Solicitado|\b\d+\b/);
    });

    it('mensagens de erro do checkout não devem expor números de saldo em estoque', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-bolinha',
        name: 'Bolinha de Purga',
        sku: 'FEL-BOL-001',
        status: 'ACTIVE',
      });

      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'var-azul',
        name: 'Azul',
        sku: 'FEL-BOL-001-az',
        productId: 'prod-bolinha',
        isActive: true,
      });

      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-azul', name: 'Azul', sku: 'FEL-BOL-001-az', isActive: true },
      ]);

      prisma.inventory.findFirst.mockResolvedValue({
        productId: 'prod-bolinha',
        variantId: 'var-azul',
        quantity: 3,
        reservedQuantity: 0,
      });

      await expect(
        orderService.create({
          customerName: 'Cliente Teste',
          customerEmail: 'cliente@teste.com',
          customerPhone: '11999999999',
          street: 'Rua A',
          number: '10',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01000-000',
          items: [{ productId: 'prod-bolinha', variantId: 'var-azul', quantity: 5 }],
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Quantidade solicitada indisponível em estoque para a variante "Bolinha de Purga - Azul".',
        ),
      );
    });

    it('getHomeData e formatação pública não devem vazar tabela de inventário bruto nem estoques do armazém', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-bolinha',
          name: 'Bolinha de Purga',
          status: 'ACTIVE',
          variants: [
            {
              id: 'var-azul',
              name: 'Azul',
              sku: 'FEL-BOL-001-az',
              isActive: true,
              inventories: [{ id: 'inv-1', quantity: 30, reservedQuantity: 5 }],
            },
          ],
          inventories: [{ id: 'inv-parent', quantity: 100, reservedQuantity: 20 }],
          productChannelPrices: [],
          media: [],
        },
      ]);

      const homeData = await publicStoreService.getHomeData();
      const featured = homeData.featuredProducts[0];

      // O objeto público expõe status booleanos de disponibilidade
      expect(featured.inStock).toBe(true);
      expect(featured.isOutOfStock).toBe(false);

      // Não vaza registros brutos do banco de dados (tabela de inventário com estoque físico e reservado)
      expect(featured).not.toHaveProperty('inventories');
      expect(featured.variants[0]).not.toHaveProperty('inventories');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. CHECKOUT SEMPRE FAZ VALIDAÇÃO FINAL NO BACKEND
  // ---------------------------------------------------------------------------
  describe('4. Checkout sempre faz validação final no backend', () => {
    it('deve rejeitar compra de produto com variantes se nenhum variantId for informado', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-com-var',
        name: 'Porta Chaves Gatinho',
        sku: 'FEL-GAT-001',
        status: 'ACTIVE',
      });

      prisma.productVariant.findMany.mockResolvedValue([
        { id: 'var-azul', name: 'Azul', sku: 'FEL-GAT-001-AZ', isActive: true },
        { id: 'var-rosa', name: 'Rosa', sku: 'FEL-GAT-001-ROS', isActive: true },
      ]);

      await expect(
        orderService.create({
          customerName: 'Cliente Incorreto',
          customerEmail: 'incorreto@teste.com',
          customerPhone: '11999999999',
          street: 'Rua C',
          number: '30',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01000-000',
          items: [{ productId: 'prod-com-var', variantId: null, quantity: 1 }],
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'O produto "Porta Chaves Gatinho" possui variantes. É obrigatório selecionar uma variante válida.',
        ),
      );

      expect(prisma.order.create).not.toHaveBeenCalled();
    });

    it('produto sem variantes continua validando estoque pelo registro próprio (variantId: null)', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-sem-var',
        name: 'Produto Simples Sem Variante',
        sku: 'SMP-001',
        status: 'ACTIVE',
        variants: [],
      });

      prisma.productVariant.findMany.mockResolvedValue([]);

      // 10 disponíveis
      prisma.inventory.findFirst.mockResolvedValue({
        productId: 'prod-sem-var',
        variantId: null,
        quantity: 10,
        reservedQuantity: 0,
      });

      prisma.order.create.mockResolvedValue({
        id: 'order-simples-1',
        customerName: 'Cliente Simples',
        status: OrderStatus.PENDING,
        total: '59.80',
        items: [{ id: 'item-1', productId: 'prod-sem-var', variantId: null, quantity: 2 }],
      });

      const created = await orderService.create({
        customerName: 'Cliente Simples',
        customerEmail: 'simples@teste.com',
        customerPhone: '11999999999',
        street: 'Rua B',
        number: '20',
        neighborhood: 'Bairro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01000-000',
        items: [{ productId: 'prod-sem-var', variantId: null, quantity: 2 }],
      });

      expect(created.id).toBe('order-simples-1');
      expect(mockInventoryService.reserveStockForOrder).toHaveBeenCalled();
    });

    it('produto sem variantes com estoque insuficiente deve ser rejeitado no checkout sem vazar números', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-sem-var',
        name: 'Produto Simples Sem Variante',
        sku: 'SMP-001',
        status: 'ACTIVE',
        variants: [],
      });

      prisma.productVariant.findMany.mockResolvedValue([]);

      // Apenas 1 disponível
      prisma.inventory.findFirst.mockResolvedValue({
        productId: 'prod-sem-var',
        variantId: null,
        quantity: 1,
        reservedQuantity: 0,
      });

      await expect(
        orderService.create({
          customerName: 'Cliente Simples',
          customerEmail: 'simples@teste.com',
          customerPhone: '11999999999',
          street: 'Rua B',
          number: '20',
          neighborhood: 'Bairro',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '01000-000',
          items: [{ productId: 'prod-sem-var', variantId: null, quantity: 5 }],
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Quantidade solicitada indisponível em estoque para o produto "Produto Simples Sem Variante".',
        ),
      );
    });
  });
});
