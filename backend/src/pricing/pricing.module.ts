import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { PricingCalculatorService } from './calculators/pricing-calculator.service';
import { PricingValidatorService } from './validators/pricing-validator.service';
import { CostResolverService } from './services/cost-resolver.service';
import { ProductionModule } from '../production/production.module';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  imports: [ProductionModule],
  controllers: [PricingController],
  providers: [
    PricingService,
    PricingCalculatorService,
    PricingValidatorService,
    CostResolverService,
    PrismaService,
    AuditLogService,
  ],
  exports: [PricingService, PricingCalculatorService, CostResolverService],
})
export class PricingModule {}
