import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicStoreService } from './public-store.service';
import { QueryProductsDto } from '../product/dto/query-products.dto';

@Controller('public')
export class PublicStoreController {
  constructor(private readonly publicStoreService: PublicStoreService) {}

  @Get('home')
  getHomeData() {
    return this.publicStoreService.getHomeData();
  }

  @Get('products')
  getProducts(@Query() query: QueryProductsDto) {
    return this.publicStoreService.getProducts(query);
  }

  @Get('products/:slug')
  getProductBySlug(@Param('slug') slug: string) {
    return this.publicStoreService.getProductBySlug(slug);
  }

  @Get('embed/products/:id')
  getEmbedProductById(@Param('id') id: string) {
    return this.publicStoreService.getEmbedProductById(id);
  }

  @Get('catalogs/:slug')
  getCatalogBySlug(@Param('slug') slug: string) {
    return this.publicStoreService.getCatalogBySlug(slug);
  }

  @Get('collections/:slug')
  getCollectionBySlug(@Param('slug') slug: string) {
    return this.publicStoreService.getCollectionBySlug(slug);
  }

  @Get('categories')
  getCategories() {
    return this.publicStoreService.getCategories();
  }
}
