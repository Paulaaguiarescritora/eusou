import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { AssignProductChannelsDto } from './dto/assign-channels.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto, @Req() req: Request) {
    const actorId = (req as any).user?.sub;
    return this.productService.create(dto, actorId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryProductsDto) {
    return this.productService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Get(':id/pricing-summary')
  @HttpCode(HttpStatus.OK)
  async getPricingSummary(@Param('id') id: string) {
    return this.productService.getPricingSummary(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    const actorId = (req as any).user?.sub;
    return this.productService.update(id, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Req() req: Request) {
    const actorId = (req as any).user?.sub;
    return this.productService.delete(id, actorId);
  }

  @Post(':id/niches')
  @HttpCode(HttpStatus.OK)
  async assignNiches(
    @Param('id') id: string,
    @Body() dto: { nicheIds: string[] },
    @Req() req: Request,
  ) {
    const actorId = (req as any).user?.sub;
    return this.productService.assignNiches(id, dto.nicheIds, actorId);
  }

  @Post(':id/categories')
  @HttpCode(HttpStatus.OK)
  async assignCategories(
    @Param('id') id: string,
    @Body() dto: { categoryIds: string[] },
    @Req() req: Request,
  ) {
    const actorId = (req as any).user?.sub;
    return this.productService.assignCategories(id, dto.categoryIds, actorId);
  }

  @Post(':id/tags')
  @HttpCode(HttpStatus.OK)
  async assignTags(
    @Param('id') id: string,
    @Body() dto: { tagIds: string[] },
    @Req() req: Request,
  ) {
    const actorId = (req as any).user?.sub;
    return this.productService.assignTags(id, dto.tagIds, actorId);
  }

  // ==========================================
  // DISPONIBILIDADE COMERCIAL EM CANAIS (FASE 2)
  // ==========================================

  @Get(':id/channels')
  @HttpCode(HttpStatus.OK)
  async getChannels(@Param('id') id: string) {
    return this.productService.getChannels(id);
  }

  @Post(':id/channels')
  @HttpCode(HttpStatus.OK)
  async assignChannels(
    @Param('id') id: string,
    @Body() dto: AssignProductChannelsDto,
    @Req() req: Request,
  ) {
    const actorId = (req as any).user?.sub;
    return this.productService.assignChannels(id, dto, actorId);
  }
}
