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
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { QueryCatalogsDto } from './dto/query-catalogs.dto';
import {
  AddCatalogProductDto,
  AddCatalogCollectionDto,
  CatalogProductsOrderDto,
  CatalogCollectionsOrderDto,
} from './dto/manage-catalog-items.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('catalogs')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  create(@Body() dto: CreateCatalogDto, @Req() req: any) {
    return this.catalogService.create(dto, req.user?.sub);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: any) {
    return this.catalogService.duplicate(id, req.user?.sub);
  }

  @Get()
  findAll(@Query() query: QueryCatalogsDto) {
    return this.catalogService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.catalogService.findById(id);
  }

  @Get(':id/resolve-products')
  resolveProducts(@Param('id') id: string) {
    return this.catalogService.resolveProducts(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogDto,
    @Req() req: any,
  ) {
    return this.catalogService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.catalogService.delete(id, req.user?.sub);
  }

  // --- Products in Catalog ---

  @Post(':id/products')
  addProduct(
    @Param('id') id: string,
    @Body() dto: AddCatalogProductDto,
    @Req() req: any,
  ) {
    return this.catalogService.addProduct(id, dto, req.user?.sub);
  }

  @Delete(':id/products/:productId')
  removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Req() req: any,
  ) {
    return this.catalogService.removeProduct(id, productId, req.user?.sub);
  }

  @Post(':id/products/reorder')
  reorderProducts(
    @Param('id') id: string,
    @Body() dto: CatalogProductsOrderDto,
    @Req() req: any,
  ) {
    return this.catalogService.reorderProducts(id, dto, req.user?.sub);
  }

  // --- Collections in Catalog ---

  @Post(':id/collections')
  addCollection(
    @Param('id') id: string,
    @Body() dto: AddCatalogCollectionDto,
    @Req() req: any,
  ) {
    return this.catalogService.addCollection(id, dto, req.user?.sub);
  }

  @Delete(':id/collections/:collectionId')
  removeCollection(
    @Param('id') id: string,
    @Param('collectionId') collectionId: string,
    @Req() req: any,
  ) {
    return this.catalogService.removeCollection(
      id,
      collectionId,
      req.user?.sub,
    );
  }

  @Post(':id/collections/reorder')
  reorderCollections(
    @Param('id') id: string,
    @Body() dto: CatalogCollectionsOrderDto,
    @Req() req: any,
  ) {
    return this.catalogService.reorderCollections(id, dto, req.user?.sub);
  }
}
