import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CommercialAlertService } from './commercial-alert.service';
import {
  ChannelAccountStatus,
  ChannelProductStatus,
  MarketplaceEventStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';

export type DashboardPeriod = 'today' | '7d' | '30d' | '90d';

export interface CommercialDashboardFilter {
  period?: DashboardPeriod;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertService: CommercialAlertService,
  ) {}

  /**
   * Resolução de intervalo de datas (Período atual e Período anterior equivalente)
   */
  private resolveDateRanges(filter: CommercialDashboardFilter) {
    const now = new Date();
    let currentStart = new Date();
    let currentEnd = now;

    if (filter.startDate && filter.endDate) {
      currentStart = new Date(filter.startDate);
      currentEnd = new Date(filter.endDate);
    } else {
      const p = filter.period || '30d';
      if (p === 'today') {
        currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      } else if (p === '7d') {
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (p === '90d') {
        currentStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      } else {
        // Default 30d
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    }

    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const previousStart = new Date(currentStart.getTime() - durationMs);
    const previousEnd = new Date(currentStart.getTime());

    return {
      current: { start: currentStart, end: currentEnd },
      previous: { start: previousStart, end: previousEnd },
    };
  }

  /**
   * Resumo Operacional Consolidado (Endpoint principal /admin/dashboard/summary)
   */
  async getCommercialSummary(filter: CommercialDashboardFilter = {}) {
    const dates = this.resolveDateRanges(filter);

    // 1. Vendas e Pedidos (F5) - Período Atual vs Anterior
    const [
      currentOrders,
      previousOrders,
      todayOrders,
      orders7d,
      orders30d,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: dates.current.start, lte: dates.current.end },
          status: { not: OrderStatus.CANCELLED },
        },
        include: {
          items: true,
          channelOrder: { include: { channel: true } },
        },
      }),
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: dates.previous.start, lte: dates.previous.end },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
      // Hoje
      this.prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
      // 7 dias
      this.prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
      // 30 dias
      this.prisma.order.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
          status: { not: OrderStatus.CANCELLED },
        },
      }),
    ]);

    // Métricas financeiras com Prisma.Decimal
    const currentRevenue = currentOrders.reduce(
      (acc, ord) => acc.add(ord.total),
      new Prisma.Decimal(0),
    );
    const previousRevenue = previousOrders.reduce(
      (acc, ord) => acc.add(ord.total),
      new Prisma.Decimal(0),
    );

    const revenueToday = todayOrders.reduce(
      (acc, ord) => acc.add(ord.total),
      new Prisma.Decimal(0),
    );
    const revenue7d = orders7d.reduce(
      (acc, ord) => acc.add(ord.total),
      new Prisma.Decimal(0),
    );
    const revenue30d = orders30d.reduce(
      (acc, ord) => acc.add(ord.total),
      new Prisma.Decimal(0),
    );

    // Comparação percentual de faturamento
    let revenueGrowthPercent: number | null = null;
    if (previousRevenue.greaterThan(0)) {
      revenueGrowthPercent = Number(
        currentRevenue
          .minus(previousRevenue)
          .dividedBy(previousRevenue)
          .times(100)
          .toFixed(1),
      );
    }

    const orderCount = currentOrders.length;
    const averageTicket = orderCount > 0
      ? currentRevenue.dividedBy(orderCount).toFixed(2)
      : '0.00';

    // Quebra por Origem de Venda
    let revenueOwnStore = new Prisma.Decimal(0);
    let revenueMarketplace = new Prisma.Decimal(0);
    let revenueAffiliate = new Prisma.Decimal(0);

    for (const ord of currentOrders) {
      if (ord.channelOrder) {
        revenueMarketplace = revenueMarketplace.add(ord.total);
      } else if (ord.affiliateCode) {
        revenueAffiliate = revenueAffiliate.add(ord.total);
      } else {
        revenueOwnStore = revenueOwnStore.add(ord.total);
      }
    }

    // 2. Saúde Operacional & Alertas (F14 Core)
    const [operationHealth, alerts] = await Promise.all([
      this.alertService.getOperationHealth(),
      this.alertService.getAlerts(),
    ]);

    // 3. Produtos & Catálogo (F2A, F3, F11)
    const [
      totalProducts,
      activeProducts,
      productsWithoutCategory,
      productsWithoutBasePrice,
      productsWithPublishError,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { status: 'ACTIVE', categories: { none: {} } } }),
      this.prisma.product.count({ where: { status: 'ACTIVE', OR: [{ basePrice: null }, { basePrice: 0 }] } }),
      this.prisma.channelProduct.count({ where: { status: ChannelProductStatus.ERROR } }),
    ]);

    // 4. Estoque & Produção (F7)
    const [
      productsWithStock,
      activeJobs,
      completedJobs,
    ] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: { not: 'ARCHIVED' } },
        include: {
          variants: {
            where: { isActive: true },
            include: { inventories: true },
          },
          inventories: {
            where: { variantId: null },
          },
        },
      }),
      this.prisma.productionJob.findMany({
        where: { status: { in: ['QUEUED', 'PRINTING'] } },
        include: { product: true, printer: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.productionJob.count({
        where: { status: 'COMPLETED' },
      }),
    ]);

    let totalStockAvailable = 0;
    let totalStockReserved = 0;
    let criticalStockCount = 0;
    let lowStockCount = 0;

    const criticalItems: any[] = [];

    for (const prod of productsWithStock) {
      const activeVariants = prod.variants || [];
      const hasVariants = activeVariants.length > 0;

      if (hasVariants) {
        // Produto com variantes:
        // O estoque do produto-pai NÃO deve ser considerado nem gerar alerta.
        // O Dashboard deve somar o estoque disponível das variantes para apresentar o estoque total do produto
        // e identificar individualmente quais variantes estão zeradas ou abaixo do mínimo.
        for (const variant of activeVariants) {
          const varInv = variant.inventories?.[0];
          const qty = varInv?.quantity || 0;
          const res = varInv?.reservedQuantity || 0;
          const min = varInv?.minimumQuantity || 0;
          const avail = qty - res;

          totalStockAvailable += Math.max(0, avail);
          totalStockReserved += res;

          const variantLabel = variant.name || variant.sku || 'Variante';
          const displayName = `${prod.name} (${variantLabel})`;

          if (avail <= 0) {
            criticalStockCount++;
            criticalItems.push({
              productId: prod.id,
              variantId: variant.id,
              productName: displayName,
              sku: variant.sku || prod.sku,
              available: avail,
              minimum: min,
              status: 'ESGOTADO',
            });
          } else if (avail <= min) {
            lowStockCount++;
            criticalItems.push({
              productId: prod.id,
              variantId: variant.id,
              productName: displayName,
              sku: variant.sku || prod.sku,
              available: avail,
              minimum: min,
              status: 'BAIXO',
            });
          }
        }
      } else {
        // Produto sem variantes:
        // Usar estoque do produto-pai (variantId == null)
        const parentInv = prod.inventories?.[0];
        if (parentInv) {
          const avail = parentInv.quantity - parentInv.reservedQuantity;
          totalStockAvailable += Math.max(0, avail);
          totalStockReserved += parentInv.reservedQuantity;

          if (avail <= 0) {
            criticalStockCount++;
            criticalItems.push({
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              available: avail,
              minimum: parentInv.minimumQuantity,
              status: 'ESGOTADO',
            });
          } else if (avail <= parentInv.minimumQuantity) {
            lowStockCount++;
            criticalItems.push({
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              available: avail,
              minimum: parentInv.minimumQuantity,
              status: 'BAIXO',
            });
          }
        }
      }
    }

    // 5. Marketplaces & Canais (F9, F10, F13)
    const [
      channels,
      channelAccounts,
      publishedChannelProducts,
      pendingEvents,
      failedEvents,
      recentOrders,
    ] = await Promise.all([
      this.prisma.channel.findMany({
        include: { _count: { select: { accounts: true, channelOrders: true } } },
      }),
      this.prisma.channelAccount.findMany({
        include: {
          channel: true,
          _count: { select: { channelProducts: true, channelOrders: true } },
        },
      }),
      this.prisma.channelProduct.count({ where: { status: ChannelProductStatus.PUBLISHED } }),
      this.prisma.marketplaceEvent.count({ where: { status: MarketplaceEventStatus.RECEIVED } }),
      this.prisma.marketplaceEvent.count({ where: { status: MarketplaceEventStatus.FAILED } }),
      this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          channelOrder: { include: { channel: true } },
        },
      }),
    ]);

    // Saúde detalhada por conta de canal
    const marketplaceHealth = channelAccounts.map((acc) => ({
      accountId: acc.id,
      accountName: acc.name,
      channelName: acc.channel.name,
      channelType: acc.channel.type,
      status: acc.status,
      lastSyncAt: acc.lastSyncAt,
      publishedCount: acc._count.channelProducts,
      recentOrdersCount: acc._count.channelOrders,
    }));

    // 6. Afiliados (F6)
    const [
      totalAffiliates,
      activeAffiliates,
      affiliateClicks,
      affiliateConversions,
    ] = await Promise.all([
      this.prisma.affiliate.count(),
      this.prisma.affiliate.count({ where: { status: 'ACTIVE' } }),
      this.prisma.affiliateClick.count({
        where: { createdAt: { gte: dates.current.start, lte: dates.current.end } },
      }),
      this.prisma.affiliateConversion.findMany({
        where: { createdAt: { gte: dates.current.start, lte: dates.current.end } },
      }),
    ]);

    let affiliatePendingCommission = new Prisma.Decimal(0);
    let affiliateApprovedCommission = new Prisma.Decimal(0);
    let affiliateTotalAmount = new Prisma.Decimal(0);

    for (const c of affiliateConversions) {
      affiliateTotalAmount = affiliateTotalAmount.add(c.amount);
      if (c.status === 'PENDING') {
        affiliatePendingCommission = affiliatePendingCommission.add(c.commissionAmount);
      } else if (c.status === 'APPROVED') {
        affiliateApprovedCommission = affiliateApprovedCommission.add(c.commissionAmount);
      }
    }

    // 7. Consolidação Final da Central
    return {
      period: {
        filter: filter.period || '30d',
        startDate: dates.current.start.toISOString(),
        endDate: dates.current.end.toISOString(),
      },
      health: operationHealth,
      alerts: alerts.slice(0, 8), // Top prioritários
      sales: {
        totalRevenue: currentRevenue.toFixed(2),
        previousRevenue: previousRevenue.toFixed(2),
        growthPercent: revenueGrowthPercent,
        orderCount,
        averageTicket,
        periods: {
          today: { orders: todayOrders.length, revenue: revenueToday.toFixed(2) },
          days7: { orders: orders7d.length, revenue: revenue7d.toFixed(2) },
          days30: { orders: orders30d.length, revenue: revenue30d.toFixed(2) },
        },
        originBreakdown: {
          ownStore: revenueOwnStore.toFixed(2),
          marketplace: revenueMarketplace.toFixed(2),
          affiliate: revenueAffiliate.toFixed(2),
        },
      },
      products: {
        total: totalProducts,
        active: activeProducts,
        withoutCategory: productsWithoutCategory,
        withoutBasePrice: productsWithoutBasePrice,
        publishErrors: productsWithPublishError,
      },
      inventory: {
        availableQuantity: totalStockAvailable,
        reservedQuantity: totalStockReserved,
        criticalCount: criticalStockCount,
        lowCount: lowStockCount,
        criticalItems: criticalItems.slice(0, 6),
      },
      production: {
        activeJobsCount: activeJobs.length,
        completedJobsCount: completedJobs,
        recentJobs: activeJobs.map((j) => ({
          id: j.id,
          productName: j.product.name,
          plannedQuantity: j.plannedQuantity,
          printerName: j.printer.name,
          status: j.status,
          createdAt: j.createdAt,
        })),
      },
      marketplaces: {
        totalChannels: channels.length,
        activeAccounts: channelAccounts.filter((a) => a.status === ChannelAccountStatus.ACTIVE).length,
        publishedCount: publishedChannelProducts,
        pendingEvents,
        failedEvents,
        accounts: marketplaceHealth,
      },
      affiliates: {
        total: totalAffiliates,
        active: activeAffiliates,
        clicks: affiliateClicks,
        conversions: affiliateConversions.length,
        totalSales: affiliateTotalAmount.toFixed(2),
        pendingCommissions: affiliatePendingCommission.toFixed(2),
        approvedCommissions: affiliateApprovedCommission.toFixed(2),
      },
      recentOrders: recentOrders.map((ord: any) => {
        let origin = 'Loja Própria';
        if (ord.channelOrder?.channel) {
          origin = ord.channelOrder.channel.name;
        } else if (ord.affiliateCode) {
          origin = `Afiliado (${ord.affiliateCode})`;
        }
        const itemCount = Array.isArray(ord.items)
          ? ord.items.reduce((s: number, i: any) => s + (i.quantity || 0), 0)
          : 0;
        return {
          id: ord.id,
          customerName: ord.customerName,
          total: Number(ord.total).toFixed(2),
          status: ord.status,
          origin,
          createdAt: ord.createdAt,
          itemCount,
        };
      }),
    };
  }

  /**
   * Mantém retrocompatibilidade com o getSummary legado se algum teste chamar
   */
  async getSummary() {
    return this.getCommercialSummary();
  }
}
