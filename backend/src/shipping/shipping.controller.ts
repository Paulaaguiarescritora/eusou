import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculate(@Body() dto: CalculateShippingDto) {
    return this.shippingService.calculateShipping(dto);
  }
}
