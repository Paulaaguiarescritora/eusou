import {
  Controller,
  Get,
  Post,
  Put,
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
} from './dto/marketplace.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin/marketplaces')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

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
}
