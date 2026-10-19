import { Test, TestingModule } from '@nestjs/testing';
import { VariantService } from '../variant.service';
import { InventoryService } from '../../inventory/inventory.service';
import { OrderService } from '../../order/order.service';
import { ProductService } from '../../product/product.service';
import { ProductionService } from '../../production/production.service';
import { CostResolverService } from '../../pricing/services/cost-resolver.service';
import { PricingService } from '../../pricing/pricing.service';
import { PrismaService } from '../../prisma.service';
import { AuditLogService } from '../../audit-log.service';
import { AffiliateService } from '../../affiliate/affiliate.service';
import { BadRequestException } from '@nestjs/common';
import {
  OrderStatus,
  StockMovementType,
  MaterialCategory,
  MaterialUnit,
  MaterialType,
  Prisma,
} from '@prisma/client';

describe('EU SOU — Variantes: Controle Conceitual de Estoque por Cor (F2B × F7 × F12)', () => {
  let prisma: PrismaService;
  let variantService: VariantService;
  let inventoryService: InventoryService;
  let orderService: OrderService;
  let productService: ProductService;
  let productionService: ProductionService;
  let costResolver: CostResolverService;

  let testChannelId: string;
  let testProductId: string;
  let variantRosaId: string;
  let variantAzulId: string;
  let noVariantProductId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        AuditLogService,
        VariantService,
        InventoryService,
        OrderService,
        ProductService,
        ProductionService,
        CostResolverService,
        {
          provide: PricingService,
          useValue: {
            calculatePrices: jest.fn(),
          },
        },
        {
          provide: AffiliateService,
          useValue: {
            handleOrderCreated: jest.fn(),
            handleOrderStatusChanged: jest.fn(),
          },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    variantService = module.get<VariantService>(VariantService);
    inventoryService = module.get<InventoryService>(InventoryService);
    orderService = module.get<OrderService>(OrderService);
    productService = module.get<ProductService>(ProductService);
    productionService = module.get<ProductionService>(ProductionService);
    costResolver = module.get<CostResolverService>(CostResolverService);

    // Canal de Teste (Loja Própria)
    let channel = await prisma.channel.findFirst({
      where: { type: 'OWN_STORE' },
    });
    if (!channel) {
      channel = await prisma.channel.create({
        data: {
          name: 'Loja Própria Teste',
          type: 'OWN_STORE',
          isActive: true,
        },
      });
    }
    testChannelId = channel.id;

    // Produto Base com Variantes (Porta Chaves Gatinho)
    const product = await prisma.product.create({
      data: {
        name: 'Porta Chaves Gatinho Felinodelia Teste',
        slug: `porta-chaves-gatinho-test-${Date.now()}`,
        sku: `FEL-GAT-TEST-${Date.now()}`,
        status: 'ACTIVE',
        costSource: 'COST_FROM_F7',
        wholesalePrice: new Prisma.Decimal('19.90'),
        productChannels: {
          create: {
            channelId: testChannelId,
            isEnabled: true,
          },
        },
        productChannelPrices: {
          create: {
            channelId: testChannelId,
            mode: 'MANUAL',
            costBasis: new Prisma.Decimal('2.12'),
            manualPrice: new Prisma.Decimal('39.90'),
            calculatedPrice: new Prisma.Decimal('39.90'),
            effectivePrice: new Prisma.Decimal('39.90'),
            netProfit: new Prisma.Decimal('10.00'),
            netMargin: new Prisma.Decimal('0.25'),
          },
        },
      },
    });
    testProductId = product.id;

    // Variante 1: Rosa (FEL-GAT-TEST-ROS)
    const varRosa = await prisma.productVariant.create({
      data: {
        productId: testProductId,
        name: 'Rosa',
        sku: `FEL-GAT-TEST-ROS-${Date.now()}`,
        isActive: true,
      },
    });
    variantRosaId = varRosa.id;

    // Variante 2: Azul (FEL-GAT-TEST-AZU)
    const varAzul = await prisma.productVariant.create({
      data: {
        productId: testProductId,
        name: 'Azul',
        sku: `FEL-GAT-TEST-AZU-${Date.now()}`,
        isActive: true,
      },
    });
    variantAzulId = varAzul.id;

    // Produto sem variantes (para validar compatibilidade)
    const noVarProd = await prisma.product.create({
      data: {
        name: 'Produto Sem Variante Teste',
        slug: `prod-sem-variante-test-${Date.now()}`,
        sku: `PROD-SEM-VAR-${Date.now()}`,
        status: 'ACTIVE',
        productChannels: {
          create: {
            channelId: testChannelId,
            isEnabled: true,
          },
        },
        productChannelPrices: {
          create: {
            channelId: testChannelId,
            mode: 'MANUAL',
            costBasis: new Prisma.Decimal('2.12'),
            manualPrice: new Prisma.Decimal('29.90'),
            calculatedPrice: new Prisma.Decimal('29.90'),
            effectivePrice: new Prisma.Decimal('29.90'),
            netProfit: new Prisma.Decimal('8.00'),
            netMargin: new Prisma.Decimal('0.26'),
          },
        },
      },
    });
    noVariantProductId = noVarProd.id;
  });

  afterAll(async () => {
    // Cleanup dos dados de teste
    try {
      await prisma.stockMovement.deleteMany({
        where: { productId: { in: [testProductId, noVariantProductId] } },
      });
      await prisma.orderItem.deleteMany({
        where: { productId: { in: [testProductId, noVariantProductId] } },
      });
      await prisma.inventory.deleteMany({
        where: { productId: { in: [testProductId, noVariantProductId] } },
      });
      await prisma.productVariant.deleteMany({
        where: { productId: testProductId },
      });
      await prisma.productChannelPrice.deleteMany({
        where: { productId: { in: [testProductId, noVariantProductId] } },
      });
      await prisma.productChannel.deleteMany({
        where: { productId: { in: [testProductId, noVariantProductId] } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: [testProductId, noVariantProductId] } },
      });
    } catch {
      // Ignorar erros na desmontagem
    }
  });

  // 1. Produto com variantes possui estoque independente por variante
  it('1. Produto com variantes possui estoque independente por variante', async () => {
    await inventoryService.adjustStock({
      productId: testProductId,
      variantId: variantRosaId,
      quantity: 12,
      mode: 'SET',
      reason: 'Estoque inicial Rosa',
    });

    await inventoryService.adjustStock({
      productId: testProductId,
      variantId: variantAzulId,
      quantity: 1,
      mode: 'SET',
      reason: 'Estoque inicial Azul',
    });

    const invRosa = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantRosaId },
    });
    const invAzul = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantAzulId },
    });

    expect(invRosa).toBeDefined();
    expect(invAzul).toBeDefined();
    expect(invRosa?.id).not.toBe(invAzul?.id);
    expect(invRosa?.variantId).toBe(variantRosaId);
    expect(invAzul?.variantId).toBe(variantAzulId);
  });

  // 2. Rosa pode ter estoque diferente de Azul (ex: 12 Rosa, 1 Azul)
  it('2. Rosa pode ter estoque diferente de Azul (ex: 12 Rosa, 1 Azul)', async () => {
    const variants = await variantService.findAll(testProductId);
    const rosa = variants.find((v) => v.id === variantRosaId);
    const azul = variants.find((v) => v.id === variantAzulId);

    expect(rosa?.availableStock).toBe(12);
    expect(azul?.availableStock).toBe(1);
    expect(rosa?.availableStock).not.toBe(azul?.availableStock);
  });

  // 3. Venda de Azul reduz somente estoque Azul (Azul vai de 1 para 0; Rosa permanece 12)
  it('3. Venda de Azul reduz somente estoque Azul (Azul vai de 1 para 0; Rosa permanece 12)', async () => {
    // Cria pedido com 1 unidade de Azul
    const order = await orderService.create({
      customerName: 'Cliente Teste Azul',
      customerEmail: 'cliente.azul@teste.com',
      customerPhone: '11999999999',
      street: 'Rua A',
      number: '123',
      neighborhood: 'Bairro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      items: [{ productId: testProductId, variantId: variantAzulId, quantity: 1 }],
      channelId: testChannelId,
    });

    expect(order.status).toBe(OrderStatus.PENDING);

    // Confirmação do pedido (pagamento em 24h)
    await orderService.updateStatus(order.id, { status: OrderStatus.CONFIRMED });

    const invRosa = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantRosaId },
    });
    const invAzul = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantAzulId },
    });

    expect(invAzul?.quantity).toBe(0);
    expect(invAzul?.reservedQuantity).toBe(0);
    expect(invRosa?.quantity).toBe(12);
    expect(invRosa?.reservedQuantity).toBe(0);
  });

  // 4. Venda de Rosa reduz somente estoque Rosa
  it('4. Venda de Rosa reduz somente estoque Rosa', async () => {
    // Cria pedido com 2 unidades de Rosa
    const orderRosa = await orderService.create({
      customerName: 'Cliente Teste Rosa',
      customerEmail: 'cliente.rosa@teste.com',
      customerPhone: '11999999998',
      street: 'Rua B',
      number: '456',
      neighborhood: 'Bairro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      items: [{ productId: testProductId, variantId: variantRosaId, quantity: 2 }],
      channelId: testChannelId,
    });

    await orderService.updateStatus(orderRosa.id, { status: OrderStatus.CONFIRMED });

    const invRosa = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantRosaId },
    });
    const invAzul = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantAzulId },
    });

    expect(invRosa?.quantity).toBe(10); // 12 - 2 = 10
    expect(invAzul?.quantity).toBe(0); // Permanece 0
  });

  // 5. Reserva de Azul não interfere em Rosa
  it('5. Reserva de Azul não interfere em Rosa', async () => {
    // Adiciona 5 unidades a Azul
    await inventoryService.adjustStock({
      productId: testProductId,
      variantId: variantAzulId,
      quantity: 5,
      mode: 'SET',
      reason: 'Reposição Azul',
    });

    // Pedido de 2 unidades de Azul (PENDING reserva imediatamente)
    const orderAzul = await orderService.create({
      customerName: 'Cliente Reserva Azul',
      customerEmail: 'reserva.azul@teste.com',
      customerPhone: '11999999997',
      street: 'Rua C',
      number: '789',
      neighborhood: 'Bairro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      items: [{ productId: testProductId, variantId: variantAzulId, quantity: 2 }],
      channelId: testChannelId,
    });

    const invAzul = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantAzulId },
    });
    const invRosa = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantRosaId },
    });

    expect(invAzul?.quantity).toBe(5);
    expect(invAzul?.reservedQuantity).toBe(2);
    expect(invRosa?.quantity).toBe(10);
    expect(invRosa?.reservedQuantity).toBe(0); // Rosa intocada

    // Limpa a reserva do pedido de teste 5 cancelando-o
    await orderService.updateStatus(orderAzul.id, { status: OrderStatus.CANCELLED });
  });

  // 6. Expiração de pedido (24h) libera estoque da MESMA variante (Azul volta para 1)
  it('6. Expiração de pedido (24h) libera estoque da MESMA variante', async () => {
    // Configura estoque de Azul para 1 unidade física
    await inventoryService.adjustStock({
      productId: testProductId,
      variantId: variantAzulId,
      quantity: 1,
      mode: 'SET',
      reason: 'Teste Expiração',
    });

    // Cria pedido que reserva a única unidade de Azul
    const expOrder = await orderService.create({
      customerName: 'Cliente Expiracao',
      customerEmail: 'expira@teste.com',
      customerPhone: '11999999996',
      street: 'Rua D',
      number: '10',
      neighborhood: 'Bairro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      items: [{ productId: testProductId, variantId: variantAzulId, quantity: 1 }],
      channelId: testChannelId,
    });

    // Simula expiração alterando paymentDeadline para o passado
    await prisma.order.update({
      where: { id: expOrder.id },
      data: { paymentDeadline: new Date(Date.now() - 3600 * 1000) },
    });

    // Executa rotina de expiração P0
    const res = await orderService.expireUnpaidOrders();
    expect(res.orderIds).toContain(expOrder.id);

    const invAzul = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantAzulId },
    });
    const invRosa = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantRosaId },
    });

    expect(invAzul?.quantity).toBe(1);
    expect(invAzul?.reservedQuantity).toBe(0); // Devolvido para Azul
    expect(invRosa?.quantity).toBe(10); // Rosa intocada
    expect(invRosa?.reservedQuantity).toBe(0);
  });

  // 7. Estoque da variante não cria produto novo
  it('7. Estoque da variante não cria produto novo', async () => {
    const productsCountBefore = await prisma.product.count();

    await inventoryService.adjustStock({
      productId: testProductId,
      variantId: variantRosaId,
      quantity: 15,
      mode: 'SET',
      reason: 'Ajuste adicional',
    });

    const productsCountAfter = await prisma.product.count();
    expect(productsCountAfter).toBe(productsCountBefore);
  });

  // 8. Edição da variante mantém o mesmo ID
  it('8. Edição da variante mantém o mesmo ID', async () => {
    const updated = await variantService.update(testProductId, variantRosaId, {
      name: 'Rosa Claro Bebê',
      stock: 14,
    });

    expect(updated.id).toBe(variantRosaId);
    expect(updated.name).toBe('Rosa Claro Bebê');
    expect(updated.availableStock).toBe(14);
  });

  // 9. Arquivamento preserva histórico
  it('9. Arquivamento preserva histórico', async () => {
    const archived = await variantService.archive(testProductId, variantRosaId);
    expect(archived.isActive).toBe(false);

    // Registros de inventário e movimentações continuam existindo
    const inv = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantRosaId },
    });
    const movements = await prisma.stockMovement.findMany({
      where: { productId: testProductId, variantId: variantRosaId },
    });

    expect(inv).toBeDefined();
    expect(movements.length).toBeGreaterThan(0);
  });

  // 10. F12 continua funcionando sem alteração
  it('10. F12 continua funcionando sem alteração', async () => {
    const product = await productService.findById(testProductId);
    expect(product).toBeDefined();
    expect(product.wholesalePrice).toBeDefined();

    // Variante herda os canais comerciais e preço configurado no F12
    const prices = await prisma.productChannelPrice.findMany({
      where: { productId: testProductId, channelId: testChannelId },
    });
    expect(prices.length).toBeGreaterThan(0);
    expect(Number(prices[0].effectivePrice)).toBe(39.9);
  });

  // 11. Produto sem variantes continua funcionando normalmente
  it('11. Produto sem variantes continua funcionando normalmente', async () => {
    await inventoryService.adjustStock({
      productId: noVariantProductId,
      variantId: undefined,
      quantity: 20,
      mode: 'SET',
      reason: 'Estoque base produto simples',
    });

    const orderSimple = await orderService.create({
      customerName: 'Cliente Simples',
      customerEmail: 'simples@teste.com',
      customerPhone: '11999999995',
      street: 'Rua E',
      number: '20',
      neighborhood: 'Bairro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      items: [{ productId: noVariantProductId, quantity: 3 }],
      channelId: testChannelId,
    });

    await orderService.updateStatus(orderSimple.id, { status: OrderStatus.CONFIRMED });

    const invSimple = await prisma.inventory.findFirst({
      where: { productId: noVariantProductId, variantId: null },
    });

    expect(invSimple?.quantity).toBe(17); // 20 - 3 = 17
    expect(invSimple?.reservedQuantity).toBe(0);
  });

  // 12. Produto com variantes não utiliza estoque genérico incorretamente
  it('12. Produto com variantes não utiliza estoque genérico incorretamente', async () => {
    // Reativa a variante Rosa para teste
    await prisma.productVariant.update({
      where: { id: variantRosaId },
      data: { isActive: true },
    });

    // Configura estoque genérico do produto (variantId: null) para 5
    await inventoryService.adjustStock({
      productId: testProductId,
      variantId: undefined,
      quantity: 5,
      mode: 'SET',
      reason: 'Estoque genérico',
    });

    // Configura estoque específico da variante Rosa para 12
    await inventoryService.adjustStock({
      productId: testProductId,
      variantId: variantRosaId,
      quantity: 12,
      mode: 'SET',
      reason: 'Estoque específico Rosa',
    });

    // Compra 2 unidades da variante Rosa
    const orderRosa = await orderService.create({
      customerName: 'Comprador Rosa Exclusivo',
      customerEmail: 'rosa.exclusivo@teste.com',
      customerPhone: '11999999993',
      street: 'Rua G',
      number: '40',
      neighborhood: 'Bairro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01001-000',
      items: [{ productId: testProductId, variantId: variantRosaId, quantity: 2 }],
      channelId: testChannelId,
    });

    await orderService.updateStatus(orderRosa.id, { status: OrderStatus.CONFIRMED });

    const invRosa = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: variantRosaId },
    });
    const invGeneric = await prisma.inventory.findFirst({
      where: { productId: testProductId, variantId: null },
    });

    // Apenas a variante Rosa foi consumida
    expect(invRosa?.quantity).toBe(10);
    // O estoque genérico permaneceu rigorosamente intocado em 5
    expect(invGeneric?.quantity).toBe(5);

    // Se a variante estiver esgotada, a compra da variante não pode "vazar" para o saldo genérico
    await inventoryService.adjustStock({
      productId: testProductId,
      variantId: variantRosaId,
      quantity: 0,
      mode: 'SET',
      reason: 'Esgotar Rosa',
    });

    await expect(
      orderService.create({
        customerName: 'Tentativa Vazar Estoque Generico',
        customerEmail: 'vazar@teste.com',
        customerPhone: '11999999992',
        street: 'Rua H',
        number: '50',
        neighborhood: 'Bairro',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01001-000',
        items: [{ productId: testProductId, variantId: variantRosaId, quantity: 1 }],
        channelId: testChannelId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 13. O custo do filamento continua sendo calculado por grama a partir do preço/kg cadastrado no F7
  it('13. O custo do filamento continua sendo calculado por grama a partir do preço/kg cadastrado no F7', async () => {
    // Cadastra Filamento por KG (R$ 90/kg)
    const filament = await prisma.material.create({
      data: {
        name: `PLA Rosa Teste Kg ${Date.now()}`,
        category: MaterialCategory.PRODUCTION,
        type: MaterialType.PLA,
        unit: MaterialUnit.KILOGRAM,
        costPerUnit: 90.0, // R$ 90/kg
        currentQuantity: 10,
      },
    });

    // Perfil consumindo 12.64 gramas
    const profile = await prisma.productionProfile.create({
      data: {
        productId: testProductId,
        variantId: variantRosaId,
        productionTimeMinutes: 56,
        productionTimeSeconds: 15,
        materials: {
          create: [
            {
              materialId: filament.id,
              quantity: new Prisma.Decimal('12.64'),
              unit: MaterialUnit.GRAM,
            },
          ],
        },
      },
    });

    const costResult = await productionService.calculateEstimatedCost(profile.id, 1);

    // 12.64g * (R$ 90 / 1000g) = R$ 1.1376
    expect(costResult.filamentCost).toBeCloseTo(1.1376, 2);

    // Cleanup material e profile criados
    await prisma.productionMaterial.deleteMany({ where: { productionProfileId: profile.id } });
    await prisma.productionProfile.delete({ where: { id: profile.id } });
    await prisma.material.delete({ where: { id: filament.id } });
  });

  // 14. Variante com material customizado (Azul com filamento mais caro) calcula custo F7 diferenciado
  it('14. Variante com material customizado (Azul) troca apenas o filamento no F7 e calcula custo específico', async () => {
    const matRosa = await prisma.material.create({
      data: {
        name: `PLA Rosa Base ${Date.now()}`,
        category: MaterialCategory.PRODUCTION,
        type: MaterialType.PLA,
        unit: MaterialUnit.GRAM,
        costPerUnit: 0.090,
        currentQuantity: 1000,
      },
    });

    const matAzul = await prisma.material.create({
      data: {
        name: `PLA Lite Azul Especial ${Date.now()}`,
        category: MaterialCategory.PRODUCTION,
        type: MaterialType.PLA,
        unit: MaterialUnit.GRAM,
        costPerUnit: 0.116,
        currentQuantity: 1000,
      },
    });

    let baseProfileId: string | null = null;
    try {
      const baseProfile = await prisma.productionProfile.create({
        data: {
          productId: testProductId,
          variantId: null,
          productionTimeMinutes: 56,
          productionTimeSeconds: 3360,
          materialWeightGrams: new Prisma.Decimal('12.64'),
          isActive: true,
          materials: {
            create: [
              {
                materialId: matRosa.id,
                quantity: new Prisma.Decimal('12.64'),
                unit: MaterialUnit.GRAM,
              },
            ],
          },
        },
      });
      baseProfileId = baseProfile.id;

      // Associar material especial à variante Azul
      await variantService.update(testProductId, variantAzulId, {
        materialId: matAzul.id,
      });

      const azulEnriched = await variantService.findById(testProductId, variantAzulId);
      const rosaEnriched = await variantService.findById(testProductId, variantRosaId);

      // Azul possui material customizado
      expect(azulEnriched.isMaterialCustom).toBe(true);
      expect(azulEnriched.materialId).toBe(matAzul.id);
      expect(azulEnriched.materialCostPerUnit).toBeCloseTo(0.116, 3);
      expect(azulEnriched.price).toBeNull(); // Preço de venda NÃO é custo de filamento

      // Rosa herda o material base do produto
      expect(rosaEnriched.isMaterialCustom).toBe(false);
      expect(rosaEnriched.materialId).toBe(matRosa.id);
      expect(rosaEnriched.materialCostPerUnit).toBeCloseTo(0.090, 3);

      // Custo de produção F7 de Azul é superior ao de Rosa exatamente pela diferença de filamento
      // Delta: 12.64g * (0.116 - 0.090) = ~0.329
      expect(Number(azulEnriched.productionCost)).toBeGreaterThan(Number(rosaEnriched.productionCost));
      const costDelta = Number(azulEnriched.productionCost) - Number(rosaEnriched.productionCost);
      expect(costDelta).toBeCloseTo(0.329, 2);
    } finally {
      await prisma.productionMaterial.deleteMany({ where: { productionProfile: { productId: testProductId } } });
      await prisma.productionProfile.deleteMany({ where: { productId: testProductId } });
      await prisma.material.delete({ where: { id: matAzul.id } }).catch(() => {});
      await prisma.material.delete({ where: { id: matRosa.id } }).catch(() => {});
    }
  });

  // 15. Ao reverter material para herdado ([Herdado do produto]), variante desativa perfil próprio e volta ao F7 base
  it('15. Ao reverter material para nulo, variante volta a herdar custo de produção F7 do produto', async () => {
    const matBase = await prisma.material.create({
      data: {
        name: `PLA Base Reversao ${Date.now()}`,
        category: MaterialCategory.PRODUCTION,
        type: MaterialType.PLA,
        unit: MaterialUnit.GRAM,
        costPerUnit: 0.090,
        currentQuantity: 1000,
      },
    });

    try {
      await prisma.productionProfile.create({
        data: {
          productId: testProductId,
          variantId: null,
          productionTimeMinutes: 56,
          productionTimeSeconds: 3360,
          materialWeightGrams: new Prisma.Decimal('12.64'),
          isActive: true,
          materials: {
            create: [
              {
                materialId: matBase.id,
                quantity: new Prisma.Decimal('12.64'),
                unit: MaterialUnit.GRAM,
              },
            ],
          },
        },
      });

      // Reverter variante Azul informando materialId: null (simulando "[Herdado do produto]")
      await variantService.update(testProductId, variantAzulId, {
        materialId: null,
      });

      const azulReverted = await variantService.findById(testProductId, variantAzulId);

      // Deve voltar a herdar
      expect(azulReverted.isMaterialCustom).toBe(false);
      expect(azulReverted.materialId).toBe(matBase.id);
      expect(azulReverted.materialCostPerUnit).toBeCloseTo(0.090, 3);
      expect(Number(azulReverted.productionCost)).toBeGreaterThan(1.0);
    } finally {
      await prisma.productionMaterial.deleteMany({ where: { productionProfile: { productId: testProductId } } });
      await prisma.productionProfile.deleteMany({ where: { productId: testProductId } });
      await prisma.material.delete({ where: { id: matBase.id } }).catch(() => {});
    }
  });
});

