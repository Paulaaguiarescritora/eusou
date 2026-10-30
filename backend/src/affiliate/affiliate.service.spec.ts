import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateService } from './affiliate.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ConflictException } from '@nestjs/common';
import { AffiliateStatus, ConversionStatus } from '@prisma/client';
import { CreateAffiliateDto, UpdateAffiliateDto } from './dto/affiliate.dto';
import { validate } from 'class-validator';

describe('AffiliateService', () => {
  let service: AffiliateService;
  let prisma: any;
  let auditLog: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      role: { findUnique: jest.fn(), create: jest.fn() },
      userRole: { create: jest.fn() },
      affiliate: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      affiliateLink: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      affiliateClick: {
        create: jest.fn(),
        count: jest.fn(),
      },
      affiliateConversion: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      commissionRule: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      collection: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
    };

    auditLog = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
  });

  describe('create affiliate', () => {
    it('should create an affiliate and default referral link', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        affiliate: null,
        roles: [],
      });
      prisma.affiliate.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 2, name: 'AFFILIATE' });

      const createdAffiliate = {
        id: 'aff-1',
        userId: 'user-1',
        code: 'MARIA27',
        displayName: 'Maria Santos',
        status: AffiliateStatus.ACTIVE,
      };
      prisma.affiliate.create.mockResolvedValue(createdAffiliate);
      prisma.affiliateLink.create.mockResolvedValue({ id: 'link-1' });

      const result = await service.create(
        { userId: 'user-1', code: 'MARIA27', displayName: 'Maria Santos' },
        'admin-1',
      );

      expect(result.code).toBe('MARIA27');
      expect(prisma.affiliate.create).toHaveBeenCalled();
      expect(prisma.affiliateLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            affiliateId: 'aff-1',
            code: 'MARIA27',
          }),
        }),
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AFFILIATE_CREATED' }),
      );
    });

    it('should throw ConflictException if user already has affiliate profile', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        affiliate: { id: 'existing' },
        roles: [],
      });

      await expect(
        service.create({
          userId: 'user-1',
          code: 'MARIA27',
          displayName: 'Maria',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('click tracking & attribution', () => {
    it('should record a click for an active affiliate link', async () => {
      prisma.affiliateLink.findUnique.mockResolvedValue({
        id: 'link-1',
        affiliateId: 'aff-1',
        isActive: true,
        affiliate: { status: AffiliateStatus.ACTIVE },
      });
      prisma.affiliateClick.create.mockResolvedValue({ id: 'click-1' });

      await service.recordClick('MARIA27', 'prod-1', 'sess-123');
      expect(prisma.affiliateClick.create).toHaveBeenCalledWith({
        data: {
          affiliateId: 'aff-1',
          affiliateLinkId: 'link-1',
          productId: 'prod-1',
          sessionId: 'sess-123',
        },
      });
    });

    it('should not record a click if affiliate is suspended or inactive', async () => {
      prisma.affiliateLink.findUnique.mockResolvedValue({
        id: 'link-1',
        affiliateId: 'aff-1',
        isActive: true,
        affiliate: { status: AffiliateStatus.SUSPENDED },
      });

      const res = await service.recordClick('MARIA27');
      expect(res).toBeNull();
      expect(prisma.affiliateClick.create).not.toHaveBeenCalled();
    });
  });

  describe('commission priority calculation', () => {
    it('should prioritize Product+Affiliate rule over Global rule', async () => {
      const rules = [
        {
          id: 'rule-prod-aff',
          affiliateId: 'aff-1',
          productId: 'prod-1',
          percentage: 25,
          priority: 50,
          isActive: true,
        },
        {
          id: 'rule-aff',
          affiliateId: 'aff-1',
          productId: null,
          percentage: 15,
          priority: 20,
          isActive: true,
        },
        {
          id: 'rule-global',
          affiliateId: null,
          productId: null,
          percentage: 10,
          priority: 10,
          isActive: true,
        },
      ];
      prisma.affiliate.findUnique.mockResolvedValue({ defaultCommissionPercent: null });
      prisma.commissionRule.findMany.mockResolvedValue(rules);

      const res = await service.calculateCommission('aff-1', 100, [
        'prod-1',
      ]);
      expect(res.commissionAmount).toBe(25); // 25% applied
      expect(res.appliedCommissionPercent).toBe(25);
    });

    it('should fallback to Global rule when no affiliate specific rule exists', async () => {
      const rules = [
        {
          id: 'rule-global',
          affiliateId: null,
          productId: null,
          percentage: 12,
          priority: 10,
          isActive: true,
        },
      ];
      prisma.affiliate.findUnique.mockResolvedValue({ defaultCommissionPercent: null });
      prisma.commissionRule.findMany.mockResolvedValue(rules);

      const res = await service.calculateCommission('aff-1', 200, [
        'prod-x',
      ]);
      expect(res.commissionAmount).toBe(24); // 12% of 200
      expect(res.appliedCommissionPercent).toBe(12);
    });
  });

  describe('order conversion handling', () => {
    it('should create an affiliate conversion on order creation and prevent duplicates', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-1',
        code: 'MARIA27',
        status: AffiliateStatus.ACTIVE,
        defaultCommissionPercent: 10.0,
      });
      prisma.affiliateConversion.findUnique.mockResolvedValue(null);
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        subtotal: '100.00',
        status: 'CONFIRMED',
        items: [{ productId: 'p1' }],
      });
      prisma.commissionRule.findMany.mockResolvedValue([
        {
          affiliateId: null,
          productId: null,
          percentage: 10,
          priority: 10,
          isActive: true,
        },
      ]);
      prisma.affiliateConversion.create.mockResolvedValue({
        id: 'conv-1',
        affiliateId: 'aff-1',
        amount: '100.00',
        commissionAmount: '10.00',
        appliedCommissionPercent: '10.00',
        status: ConversionStatus.APPROVED,
      });

      const conversion = await service.handleOrderCreated('order-1', 'MARIA27');
      expect(conversion?.commissionAmount).toBe('10.00');
      expect(prisma.affiliateConversion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appliedCommissionPercent: '10.00',
          }),
        }),
      );
    });

    it('should update conversion status to CANCELLED when order is cancelled', async () => {
      prisma.affiliateConversion.findUnique.mockResolvedValue({
        id: 'conv-1',
        status: ConversionStatus.APPROVED,
      });

      await service.handleOrderStatusChanged('order-1', 'CANCELLED');
      expect(prisma.affiliateConversion.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { status: ConversionStatus.CANCELLED },
      });
    });
  });

  describe('affiliate collections', () => {
    it('should create a custom affiliate collection', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-1',
        code: 'MARIA27',
        status: AffiliateStatus.ACTIVE,
      });
      prisma.collection.create.mockResolvedValue({
        id: 'col-1',
        name: 'Meus Favoritos',
        ownerAffiliateId: 'aff-1',
      });
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-1',
        name: 'Meus Favoritos',
        ownerAffiliateId: 'aff-1',
        items: [],
      });

      const col = await service.createAffiliateCollection('aff-1', {
        name: 'Meus Favoritos',
      });
      expect(col?.ownerAffiliateId).toBe('aff-1');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AFFILIATE_COLLECTION_CREATED' }),
      );
    });
  });

  describe('Sovereign Affiliate Commission Rates (Phase 2 Fix)', () => {
    it('1. Afiliado A com 10% recebe 10%', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-a',
        defaultCommissionPercent: 10.0,
      });

      const res = await service.calculateCommission('aff-a', 200);
      expect(res.commissionAmount).toBe(20); // 10% de 200 = 20
      expect(res.appliedCommissionPercent).toBe(10);
    });

    it('2. Afiliado B com 15% recebe 15%', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-b',
        defaultCommissionPercent: 15.0,
      });

      const res = await service.calculateCommission('aff-b', 200);
      expect(res.commissionAmount).toBe(30); // 15% de 200 = 30
      expect(res.appliedCommissionPercent).toBe(15);
    });

    it('3. Afiliado C com 20% recebe 20%', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-c',
        defaultCommissionPercent: 20.0,
      });

      const res = await service.calculateCommission('aff-c', 200);
      expect(res.commissionAmount).toBe(40); // 20% de 200 = 40
      expect(res.appliedCommissionPercent).toBe(20);
    });

    it('4. CommissionRule global não sobrescreve defaultCommissionPercent do afiliado', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-a',
        defaultCommissionPercent: 10.0,
      });
      // Mesmo existindo regra global de 50%, ela não pode ser consultada nem aplicada
      prisma.commissionRule.findMany.mockResolvedValue([
        { percentage: 50, priority: 10, isActive: true },
      ]);

      const res = await service.calculateCommission('aff-a', 100);
      expect(res.commissionAmount).toBe(10); // Permanece 10%
      expect(res.appliedCommissionPercent).toBe(10);
      expect(prisma.commissionRule.findMany).not.toHaveBeenCalled();
    });

    it('5. CommissionRule de produto não sobrescreve defaultCommissionPercent do afiliado', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-b',
        defaultCommissionPercent: 15.0,
      });
      // Mesmo existindo regra de produto de 40%, ela não sobrescreve
      prisma.commissionRule.findMany.mockResolvedValue([
        { productId: 'prod-1', percentage: 40, priority: 30, isActive: true },
      ]);

      const res = await service.calculateCommission('aff-b', 100, ['prod-1']);
      expect(res.commissionAmount).toBe(15); // Permanece 15%
      expect(res.appliedCommissionPercent).toBe(15);
      expect(prisma.commissionRule.findMany).not.toHaveBeenCalled();
    });

    it('6. CommissionRule produto+afiliado não sobrescreve defaultCommissionPercent do afiliado', async () => {
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-c',
        defaultCommissionPercent: 20.0,
      });
      // Mesmo existindo regra de produto+afiliado com prioridade 50, a taxa do cadastro é soberana
      prisma.commissionRule.findMany.mockResolvedValue([
        {
          affiliateId: 'aff-c',
          productId: 'prod-1',
          percentage: 90,
          priority: 50,
          isActive: true,
        },
      ]);

      const res = await service.calculateCommission('aff-c', 100, ['prod-1']);
      expect(res.commissionAmount).toBe(20); // Permanece 20%
      expect(res.appliedCommissionPercent).toBe(20);
      expect(prisma.commissionRule.findMany).not.toHaveBeenCalled();
    });

    it('7. Afiliados diferentes possuem percentuais diferentes de forma independente', async () => {
      prisma.affiliate.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'aff-a') return { defaultCommissionPercent: 10.0 };
        if (where.id === 'aff-b') return { defaultCommissionPercent: 15.0 };
        if (where.id === 'aff-c') return { defaultCommissionPercent: 20.0 };
        return null;
      });

      const resA = await service.calculateCommission('aff-a', 300);
      const resB = await service.calculateCommission('aff-b', 300);
      const resC = await service.calculateCommission('aff-c', 300);

      expect(resA.commissionAmount).toBe(30);
      expect(resB.commissionAmount).toBe(45);
      expect(resC.commissionAmount).toBe(60);
    });

    it('8. Alteração do percentual afeta somente novas vendas e comissão histórica permanece inalterada', async () => {
      // 1ª Venda: Afiliado configurado com 10%
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-1',
        code: 'PARCEIRO10',
        status: AffiliateStatus.ACTIVE,
        defaultCommissionPercent: 10.0,
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-antigo',
        subtotal: '100.00',
        status: 'CONFIRMED',
        items: [{ productId: 'p1' }],
      });
      prisma.affiliateConversion.findUnique.mockResolvedValue(null);
      prisma.affiliateConversion.create.mockResolvedValue({
        id: 'conv-antiga',
        affiliateId: 'aff-1',
        amount: '100.00',
        commissionAmount: '10.00',
        appliedCommissionPercent: '10.00',
        status: ConversionStatus.APPROVED,
      });

      const conv1 = await service.handleOrderCreated('order-antigo', 'PARCEIRO10');
      expect(conv1?.commissionAmount).toBe('10.00');

      // Atualiza percentual do afiliado para 20%
      prisma.affiliate.update.mockResolvedValue({
        id: 'aff-1',
        defaultCommissionPercent: 20.0,
      });
      await service.update('aff-1', { defaultCommissionPercent: 20.0 });

      // Garante que a conversão histórica NUNCA foi modificada
      expect(prisma.affiliateConversion.update).not.toHaveBeenCalled();

      // 2ª Venda (nova): Agora deve calcular com 20%
      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-1',
        code: 'PARCEIRO10',
        status: AffiliateStatus.ACTIVE,
        defaultCommissionPercent: 20.0,
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-novo',
        subtotal: '100.00',
        status: 'CONFIRMED',
        items: [{ productId: 'p1' }],
      });
      prisma.affiliateConversion.create.mockResolvedValue({
        id: 'conv-nova',
        affiliateId: 'aff-1',
        amount: '100.00',
        commissionAmount: '20.00',
        appliedCommissionPercent: '20.00',
        status: ConversionStatus.APPROVED,
      });

      const conv2 = await service.handleOrderCreated('order-novo', 'PARCEIRO10');
      expect(conv2?.commissionAmount).toBe('20.00');
    });

    it('9. Conversões históricas sem appliedCommissionPercent permanecem com valor nulo sem invenção', async () => {
      // Mock de conversões históricas antigas do banco
      prisma.affiliateConversion.findMany.mockResolvedValue([
        {
          id: 'conv-legada-1',
          orderId: 'order-uuid-12345678',
          amount: '150.00',
          commissionAmount: '15.00',
          appliedCommissionPercent: null, // Sem taxa conhecida
          status: ConversionStatus.APPROVED,
          createdAt: new Date('2026-09-01'),
          order: { id: 'order-uuid-12345678', createdAt: new Date('2026-09-01'), status: 'DELIVERED' },
        },
      ]);

      const conversions = await service.getAffiliateConversions('aff-1');
      expect(conversions[0].appliedCommissionPercent).toBeNull();
      expect(conversions[0].commissionAmount).toBe('15.00');
    });

    it('10. Validação de DTOs: rejeita percentual menor que 0 ou maior que 100', async () => {
      const invalidMin = new CreateAffiliateDto();
      invalidMin.userId = '123e4567-e89b-12d3-a456-426614174000';
      invalidMin.code = 'INVALID';
      invalidMin.displayName = 'Invalid';
      invalidMin.defaultCommissionPercent = -1;

      const errorsMin = await validate(invalidMin);
      expect(errorsMin.length).toBeGreaterThan(0);
      expect(errorsMin.some((e) => e.property === 'defaultCommissionPercent')).toBe(true);

      const invalidMax = new UpdateAffiliateDto();
      invalidMax.defaultCommissionPercent = 101;

      const errorsMax = await validate(invalidMax);
      expect(errorsMax.length).toBeGreaterThan(0);
      expect(errorsMax.some((e) => e.property === 'defaultCommissionPercent')).toBe(true);

      const validDto = new UpdateAffiliateDto();
      validDto.defaultCommissionPercent = 15.5;

      const errorsValid = await validate(validDto);
      expect(errorsValid.length).toBe(0);
    });

    it('11. Persistência de defaultCommissionPercent no create e update do AffiliateService', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-new',
        affiliate: null,
        roles: [],
      });
      prisma.affiliate.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({ id: 2, name: 'AFFILIATE' });
      prisma.affiliate.create.mockResolvedValue({
        id: 'aff-new',
        code: 'NEW15',
        displayName: 'Novo Parceiro',
        defaultCommissionPercent: 15.0,
      });
      prisma.affiliateLink.create.mockResolvedValue({ id: 'link-new' });

      await service.create({
        userId: 'user-new',
        code: 'NEW15',
        displayName: 'Novo Parceiro',
        defaultCommissionPercent: 15.0,
      });

      expect(prisma.affiliate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            defaultCommissionPercent: 15.0,
          }),
        }),
      );

      prisma.affiliate.findUnique.mockResolvedValue({
        id: 'aff-new',
        code: 'NEW15',
        displayName: 'Novo Parceiro',
        defaultCommissionPercent: 15.0,
      });
      prisma.affiliate.update.mockResolvedValue({
        id: 'aff-new',
        defaultCommissionPercent: 25.0,
      });

      await service.update('aff-new', { defaultCommissionPercent: 25.0 });

      expect(prisma.affiliate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'aff-new' },
          data: expect.objectContaining({
            defaultCommissionPercent: 25.0,
          }),
        }),
      );
    });
  });
});
