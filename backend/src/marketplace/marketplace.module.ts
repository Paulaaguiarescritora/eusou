import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceWebhookController } from './marketplace-webhook.controller';
import { MarketplaceService } from './marketplace.service';
import { MockMarketplaceConnector } from './mock-marketplace.connector';
import { ProductMapperService } from './product-mapper.service';
import { MercadoLivreConnector } from './mercadolivre.connector';
import { MercadoLivrePriceAdapter } from './mercadolivre-price.adapter';
import { MercadoLivreStockAdapter } from './mercadolivre-stock.adapter';
import { CredentialEncryptionService } from './credential-encryption.service';
import { HubValidatorService } from './hub-validator.service';
import { ChannelAttributeMappingService } from './channel-attribute-mapping.service';
import { ChannelOrderIngestionService } from './channel-order-ingestion.service';
import { MarketplaceWebhookService } from './marketplace-webhook.service';
import { MarketplaceReconciliationService } from './marketplace-reconciliation.service';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit-log.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [MarketplaceController, MarketplaceWebhookController],
  providers: [
    MarketplaceService,
    MockMarketplaceConnector,
    MercadoLivreConnector,
    MercadoLivrePriceAdapter,
    MercadoLivreStockAdapter,
    CredentialEncryptionService,
    ProductMapperService,
    HubValidatorService,
    ChannelAttributeMappingService,
    ChannelOrderIngestionService,
    MarketplaceWebhookService,
    MarketplaceReconciliationService,
    PrismaService,
    AuditLogService,
  ],
  exports: [
    MarketplaceService,
    MockMarketplaceConnector,
    MercadoLivreConnector,
    MercadoLivrePriceAdapter,
    MercadoLivreStockAdapter,
    CredentialEncryptionService,
    ProductMapperService,
    HubValidatorService,
    ChannelAttributeMappingService,
    ChannelOrderIngestionService,
    MarketplaceWebhookService,
    MarketplaceReconciliationService,
  ],
})
export class MarketplaceModule {}
