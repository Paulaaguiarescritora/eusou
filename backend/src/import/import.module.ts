import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { ImportParserService } from './import-parser.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { ProductModule } from '../product/product.module';
import { VariantModule } from '../variant/variant.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MediaModule } from '../media/media.module';
import { PricingModule } from '../pricing/pricing.module';
import { TagModule } from '../tag/tag.module';

@Module({
  imports: [
    ProductModule,
    VariantModule,
    InventoryModule,
    MediaModule,
    PricingModule,
    TagModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    ImportParserService,
    PrismaService,
    AuditLogService,
  ],
  exports: [ImportService],
})
export class ImportModule {}
