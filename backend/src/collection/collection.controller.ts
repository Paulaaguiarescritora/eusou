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
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { QueryCollectionsDto } from './dto/query-collections.dto';
import {
  AddCollectionProductDto,
  CollectionProductsOrderDto,
} from './dto/manage-collection-items.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  create(@Body() dto: CreateCollectionDto, @Req() req: any) {
    return this.collectionService.create(dto, req.user?.sub);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: any) {
    return this.collectionService.duplicate(id, req.user?.sub);
  }

  @Get()
  findAll(@Query() query: QueryCollectionsDto) {
    return this.collectionService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.collectionService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
    @Req() req: any,
  ) {
    return this.collectionService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.collectionService.delete(id, req.user?.sub);
  }

  // --- Products in Collection ---

  @Post(':id/products')
  addProduct(
    @Param('id') id: string,
    @Body() dto: AddCollectionProductDto,
    @Req() req: any,
  ) {
    return this.collectionService.addProduct(id, dto, req.user?.sub);
  }

  @Delete(':id/products/:productId')
  removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Req() req: any,
  ) {
    return this.collectionService.removeProduct(id, productId, req.user?.sub);
  }

  @Post(':id/products/reorder')
  reorderProducts(
    @Param('id') id: string,
    @Body() dto: CollectionProductsOrderDto,
    @Req() req: any,
  ) {
    return this.collectionService.reorderProducts(id, dto, req.user?.sub);
  }
}
