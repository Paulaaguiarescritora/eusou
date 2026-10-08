import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProductAttributeService } from './product-attribute.service';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attribute.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('products/:productId/attributes')
export class ProductAttributeController {
  constructor(
    private readonly productAttributeService: ProductAttributeService,
  ) {}

  @Post()
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateProductAttributeDto,
    @Req() req: any,
  ) {
    return this.productAttributeService.create(productId, dto, req.user?.sub);
  }

  @Get()
  findAll(@Param('productId') productId: string) {
    return this.productAttributeService.findAll(productId);
  }

  @Patch(':id')
  update(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductAttributeDto,
    @Req() req: any,
  ) {
    return this.productAttributeService.update(
      productId,
      id,
      dto,
      req.user?.sub,
    );
  }

  @Delete(':id')
  remove(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.productAttributeService.delete(productId, id, req.user?.sub);
  }
}
