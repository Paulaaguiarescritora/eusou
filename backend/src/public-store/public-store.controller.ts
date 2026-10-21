import { Controller, Get, Post, Body, Param, Query, Header } from '@nestjs/common';
import { PublicStoreService } from './public-store.service';
import { QueryProductsDto } from '../product/dto/query-products.dto';

@Controller('public')
export class PublicStoreController {
  constructor(private readonly publicStoreService: PublicStoreService) {}

  @Get('context')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120')
  getStoreContext(@Query('niche') niche?: string) {
    return this.publicStoreService.getStoreContext(niche);
  }

  @Get('home')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120')
  getHomeData() {
    return this.publicStoreService.getHomeData();
  }

  @Get('products')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120')
  getProducts(@Query() query: QueryProductsDto) {
    return this.publicStoreService.getProducts(query);
  }

  @Post('cart/validate')
  validateCart(@Body() body: { items: any[] }) {
    return this.publicStoreService.validateCart(body?.items || []);
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
