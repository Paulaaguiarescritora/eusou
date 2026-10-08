import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalProducts,
      totalActiveProducts,
      totalNiches,
      totalActiveNiches,
      totalCategories,
      totalActiveCategories,
      totalTags,
      totalThemes,
      totalCatalogs,
      totalActiveCatalogs,
      totalCollections,
      totalActiveCollections,
      totalAffiliates,
      activeAffiliates,
      totalClicks,
      totalConversions,
      conversions,
    ] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: 'ACTIVE' } }),
      this.prisma.niche.count(),
      this.prisma.niche.count({ where: { status: 'ACTIVE' } }),
      this.prisma.category.count(),
      this.prisma.category.count({ where: { status: 'ACTIVE' } }),
      this.prisma.tag.count(),
      this.prisma.theme.count(),
      this.prisma.catalog.count(),
      this.prisma.catalog.count({ where: { status: 'ACTIVE' } }),
      this.prisma.collection.count(),
      this.prisma.collection.count({ where: { status: 'ACTIVE' } }),
      this.prisma.affiliate.count(),
      this.prisma.affiliate.count({ where: { status: 'ACTIVE' } }),
      this.prisma.affiliateClick.count(),
      this.prisma.affiliateConversion.count(),
      this.prisma.affiliateConversion.findMany({
        select: { amount: true, commissionAmount: true, status: true },
      }),
    ]);

    const approvedCommissions = conversions
      .filter((c) => c.status === 'APPROVED')
      .reduce((sum, c) => sum + Number(c.commissionAmount), 0);

    const pendingCommissions = conversions
      .filter((c) => c.status === 'PENDING')
      .reduce((sum, c) => sum + Number(c.commissionAmount), 0);

    const affiliateSales = conversions
      .filter((c) => c.status !== 'CANCELLED')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const [
      totalPrinters,
      availablePrinters,
      queuedJobs,
      printingJobs,
      completedJobs,
      inventories,
      materials,
    ] = await Promise.all([
      this.prisma.printer.count(),
      this.prisma.printer.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.productionJob.count({ where: { status: 'QUEUED' } }),
      this.prisma.productionJob.count({ where: { status: 'PRINTING' } }),
      this.prisma.productionJob.count({ where: { status: 'COMPLETED' } }),
      this.prisma.inventory.findMany({
        select: {
          quantity: true,
          reservedQuantity: true,
          minimumQuantity: true,
          product: { select: { basePrice: true } },
        },
      }),
      this.prisma.material.findMany({
        select: { currentQuantity: true, minimumQuantity: true },
      }),
    ]);

    const lowStockMaterials = materials.filter(
      (m) => Number(m.currentQuantity) <= Number(m.minimumQuantity),
    ).length;

    const lowStockProducts = inventories.filter(
      (i) => i.quantity - i.reservedQuantity <= i.minimumQuantity,
    ).length;

    const totalInventoryValue = inventories.reduce((acc, i) => {
      const price = Number(i.product?.basePrice) || 0;
      return acc + Math.max(0, i.quantity - i.reservedQuantity) * price;
    }, 0);

    return {
      products: {
        total: totalProducts,
        active: totalActiveProducts,
      },
      niches: {
        total: totalNiches,
        active: totalActiveNiches,
      },
      categories: {
        total: totalCategories,
        active: totalActiveCategories,
      },
      tags: {
        total: totalTags,
      },
      themes: {
        total: totalThemes,
      },
      catalogs: {
        total: totalCatalogs,
        active: totalActiveCatalogs,
      },
      collections: {
        total: totalCollections,
        active: totalActiveCollections,
      },
      affiliates: {
        total: totalAffiliates,
        active: activeAffiliates,
        clicks: totalClicks,
        conversions: totalConversions,
        totalSales: affiliateSales.toFixed(2),
        approvedCommissions: approvedCommissions.toFixed(2),
        pendingCommissions: pendingCommissions.toFixed(2),
      },
      production: {
        totalPrinters,
        availablePrinters,
        queuedJobs,
        printingJobs,
        completedJobs,
        lowStockMaterials,
      },
      inventory: {
        totalItemsTracked: inventories.length,
        lowStockProducts,
        totalInventoryValue: totalInventoryValue.toFixed(2),
      },
    };
  }
}
