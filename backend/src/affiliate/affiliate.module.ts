import { Module } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import {
  AdminAffiliateController,
  AffiliateController,
  PublicAffiliateController,
} from './affiliate.controller';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [
    AdminAffiliateController,
    AffiliateController,
    PublicAffiliateController,
  ],
  providers: [AffiliateService, PrismaService, AuditLogService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
