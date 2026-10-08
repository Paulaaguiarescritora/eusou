import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  // Public order creation (guest checkout)
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  // Public order tracking by UUID
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.orderService.findById(id);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/orders')
export class AdminOrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  findAll(@Query() query: QueryOrdersDto) {
    return this.orderService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.orderService.findById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @Req() req: any,
  ) {
    return this.orderService.updateStatus(id, dto, req.user?.sub);
  }
}
