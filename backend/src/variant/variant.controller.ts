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
import { VariantService } from './variant.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { AddVariantAttributeDto } from './dto/add-variant-attribute.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('products/:productId/variants')
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  @Post()
  create(
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
    @Req() req: any,
  ) {
    return this.variantService.create(productId, dto, req.user?.sub);
  }

  @Get()
  findAll(@Param('productId') productId: string) {
    return this.variantService.findAll(productId);
  }

  @Get(':variantId')
  findOne(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.variantService.findById(productId, variantId);
  }

  @Patch(':variantId')
  update(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
    @Req() req: any,
  ) {
    return this.variantService.update(productId, variantId, dto, req.user?.sub);
  }

  @Delete(':variantId')
  remove(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Req() req: any,
  ) {
    return this.variantService.delete(productId, variantId, req.user?.sub);
  }

  @Post(':variantId/attributes')
  addAttribute(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: AddVariantAttributeDto,
    @Req() req: any,
  ) {
    return this.variantService.addAttribute(
      productId,
      variantId,
      dto.productAttributeValueId,
      req.user?.sub,
    );
  }

  @Delete(':variantId/attributes/:attributeValueId')
  removeAttribute(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Param('attributeValueId') attributeValueId: string,
    @Req() req: any,
  ) {
    return this.variantService.removeAttribute(
      productId,
      variantId,
      attributeValueId,
      req.user?.sub,
    );
  }
}
