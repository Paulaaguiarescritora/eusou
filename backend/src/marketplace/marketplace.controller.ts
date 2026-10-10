import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import {
  CreateChannelDto,
  CreateChannelAccountDto,
  UpdateChannelAccountDto,
  PublishProductDto,
  MapCategoryDto,
  CompleteOAuthDto,
  ValidateProductDto,
  CreateAttributeMappingDto,
  IngestChannelOrderDto,
} from './dto/marketplace.dto';
import { ChannelAttributeMappingService } from './channel-attribute-mapping.service';
import { ChannelOrderIngestionService } from './channel-order-ingestion.service';
import { MarketplaceWebhookService } from './marketplace-webhook.service';
import { MarketplaceReconciliationService } from './marketplace-reconciliation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin/marketplaces')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly attributeMappingService: ChannelAttributeMappingService,
    private readonly orderIngestionService: ChannelOrderIngestionService,
    private readonly webhookService: MarketplaceWebhookService,
    private readonly reconciliationService: MarketplaceReconciliationService,
  ) {}

  // 1. Dashboard Metrics
  @Get('dashboard')
  async getDashboard() {
    return this.marketplaceService.getDashboardMetrics();
  }

  // 2. Channels
  @Get('channels')
  async listChannels() {
    return this.marketplaceService.listChannels();
  }

  @Post('channels')
  async createChannel(@Body() dto: CreateChannelDto, @Request() req: any) {
    return this.marketplaceService.createChannel(dto, req.user?.id);
  }

  @Get('channels/:id')
  async getChannel(@Param('id') id: string) {
    return this.marketplaceService.getChannel(id);
  }

  // 3. Accounts
  @Get('accounts')
  async listAccounts(@Query('channelId') channelId?: string) {
    return this.marketplaceService.listAccounts(channelId);
  }

  @Post('accounts')
  async createAccount(
    @Body() dto: CreateChannelAccountDto,
    @Request() req: any,
  ) {
    return this.marketplaceService.createAccount(dto, req.user?.id);
  }

  @Put('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateChannelAccountDto,
    @Request() req: any,
  ) {
    return this.marketplaceService.updateAccount(id, dto, req.user?.id);
  }

  @Post('accounts/:id/test-connection')
  async testConnection(@Param('id') id: string) {
    return this.marketplaceService.testConnection(id);
  }

  // 4. Products / Publications
  @Get('products')
  async listChannelProducts(
    @Query('channelAccountId') channelAccountId?: string,
  ) {
    return this.marketplaceService.listChannelProducts(channelAccountId);
  }

  @Post('publish')
  async publishProduct(@Body() dto: PublishProductDto, @Request() req: any) {
    return this.marketplaceService.publishProduct(dto, req.user?.id);
  }

  @Post('products/:id/sync-price')
  async syncPrice(@Param('id') id: string) {
    return this.marketplaceService.syncPrice(id);
  }

  @Post('products/:id/sync-stock')
  async syncStock(@Param('id') id: string) {
    return this.marketplaceService.syncStock(id);
  }

  @Post('products/:id/unpublish')
  async unpublishProduct(@Param('id') id: string, @Request() req: any) {
    return this.marketplaceService.unpublishProduct(id, req.user?.id);
  }

  // 5. Category Mappings
  @Get('categories')
  async listCategoryMappings(@Query('channelId') channelId?: string) {
    return this.marketplaceService.listCategoryMappings(channelId);
  }

  @Post('categories')
  async mapCategory(@Body() dto: MapCategoryDto) {
    return this.marketplaceService.mapCategory(dto);
  }

  // 6. Mercado Livre OAuth
  @Get('mercadolivre/auth-url')
  async getMercadoLivreAuthUrl(
    @Query('channelAccountId') channelAccountId?: string,
  ) {
    return this.marketplaceService.getMercadoLivreAuthUrl(channelAccountId);
  }

  @Post('mercadolivre/complete-oauth')
  async completeMercadoLivreOAuth(
    @Body() dto: CompleteOAuthDto,
    @Request() req: any,
  ) {
    return this.marketplaceService.completeMercadoLivreOAuth(dto, req.user?.id);
  }

  @Post('accounts/:id/disconnect')
  async disconnectAccount(@Param('id') id: string, @Request() req: any) {
    return this.marketplaceService.disconnectAccount(id, req.user?.id);
  }

  // 7. Validação Prévia
  @Post('validate-product')
  async validateProduct(@Body() dto: ValidateProductDto) {
    return this.marketplaceService.validateProductForChannel(dto);
  }

  // 8. Sincronização Completa de Produto
  @Post('products/:id/sync')
  async syncProductDetails(@Param('id') id: string) {
    return this.marketplaceService.syncProductDetails(id);
  }

  // 9. Logs
  @Get('logs')
  async listLogs(
    @Query('channelAccountId') channelAccountId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketplaceService.listSyncLogs(
      channelAccountId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // 10. Channel Attribute Mappings (F13A)
  @Get('attribute-mappings')
  async listAttributeMappings(
    @Query('channelId') channelId: string,
    @Query('externalCategoryId') externalCategoryId?: string,
  ) {
    return this.attributeMappingService.listMappings(channelId, externalCategoryId);
  }

  @Post('attribute-mappings')
  async upsertAttributeMapping(@Body() dto: CreateAttributeMappingDto) {
    return this.attributeMappingService.upsertMapping(dto);
  }

  @Delete('attribute-mappings/:id')
  async deleteAttributeMapping(@Param('id') id: string) {
    return this.attributeMappingService.deleteMapping(id);
  }

  // 11. Channel Orders (F13A)
  @Get('orders')
  async listChannelOrders(
    @Query('channelId') channelId?: string,
    @Query('channelAccountId') channelAccountId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orderIngestionService.listChannelOrders({
      channelId,
      channelAccountId,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('orders/:id')
  async getChannelOrder(@Param('id') id: string) {
    return this.orderIngestionService.getChannelOrder(id);
  }

  @Post('orders/ingest')
  async ingestOrder(@Body() dto: IngestChannelOrderDto, @Request() req: any) {
    return this.orderIngestionService.ingestOrder(dto, req.user?.id);
  }

  // 12. Reconciliation (F13A)
  @Post('products/:id/reconcile')
  async reconcileProduct(@Param('id') channelProductId: string) {
    return this.reconciliationService.reconcileProduct(channelProductId);
  }

  @Post('accounts/:id/reconcile')
  async reconcileAccount(@Param('id') channelAccountId: string) {
    return this.reconciliationService.reconcileAccount(channelAccountId);
  }

  // 13. Marketplace Webhook Events (F13A / F13B)
  @Get('events')
  async listMarketplaceEvents(
    @Query('channelId') channelId?: string,
    @Query('topic') topic?: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhookService.listEvents({
      channelId,
      topic,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Post('events/process-retries')
  async processEventRetries(@Query('limit') limit?: string) {
    return this.webhookService.processPendingRetries(limit ? parseInt(limit, 10) : 20);
  }

  @Post('accounts/:id/recover-missed-feeds')
  async recoverMissedFeeds(
    @Param('id') accountId: string,
    @Query('channelId') channelId: string,
  ) {
    return this.webhookService.recoverMissedFeeds(channelId, accountId);
  }
}

