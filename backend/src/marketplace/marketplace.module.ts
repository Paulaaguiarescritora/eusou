import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MockMarketplaceConnector } from './mock-marketplace.connector';
import { ProductMapperService } from './product-mapper.service';
import { MercadoLivreConnector } from './mercadolivre.connector';
import { CredentialEncryptionService } from './credential-encryption.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';

@Module({
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    MockMarketplaceConnector,
    MercadoLivreConnector,
    CredentialEncryptionService,
    ProductMapperService,
    PrismaService,
    AuditLogService,
  ],
  exports: [
    MarketplaceService,
    MockMarketplaceConnector,
    MercadoLivreConnector,
    CredentialEncryptionService,
    ProductMapperService,
  ],
})
export class MarketplaceModule {}
