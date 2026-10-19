import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { InfoController } from './info.controller';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ProductModule } from './product/product.module';
import { AttributeModule } from './attribute/attribute.module';
import { ProductAttributeModule } from './product-attribute/product-attribute.module';
import { VariantModule } from './variant/variant.module';
import { MediaModule } from './media/media.module';
import { NicheModule } from './niche/niche.module';
import { CategoryModule } from './category/category.module';
import { TagModule } from './tag/tag.module';
import { ThemeModule } from './theme/theme.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CatalogModule } from './catalog/catalog.module';
import { CollectionModule } from './collection/collection.module';
import { OrderModule } from './order/order.module';
import { PublicStoreModule } from './public-store/public-store.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProductionModule } from './production/production.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { PricingModule } from './pricing/pricing.module';
import { PaymentModule } from './payment/payment.module';
import { ImportModule } from './import/import.module';
import { PrismaService } from './prisma.service';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    ProductModule,
    AttributeModule,
    ProductAttributeModule,
    VariantModule,
    MediaModule,
    NicheModule,
    CategoryModule,
    TagModule,
    ThemeModule,
    DashboardModule,
    CatalogModule,
    CollectionModule,
    OrderModule,
    PaymentModule,
    PublicStoreModule,
    AffiliateModule,
    InventoryModule,
    ProductionModule,
    MarketplaceModule,
    PricingModule,
    ImportModule,
  ],
  controllers: [HealthController, InfoController],
  providers: [PrismaService, AuditLogService],
})
export class AppModule {}
