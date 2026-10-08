import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InventoryService, AdjustStockDto } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StockMovementType } from '@prisma/client';

@Controller('admin/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventory(
    @Query('productId') productId?: string,
    @Query('variantId') variantId?: string,
    @Query('lowStockOnly') lowStockOnly?: boolean,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getInventory({
      productId,
      variantId,
      lowStockOnly,
      search,
      page,
      limit,
    });
  }

  @Get('movements')
  async getMovements(
    @Query('productId') productId?: string,
    @Query('variantId') variantId?: string,
    @Query('type') type?: StockMovementType,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getMovements({
      productId,
      variantId,
      type,
      page,
      limit,
    });
  }

  @Post('adjust')
  async adjustStock(@Body() dto: AdjustStockDto, @Request() req: any) {
    return this.inventoryService.adjustStock(dto, req.user?.id);
  }
}
