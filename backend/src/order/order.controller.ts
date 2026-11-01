import {
  Controller,
  Get,
  Delete,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
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

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.orderService.deleteOrder(id, req.user?.sub);
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

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.orderService.deleteOrder(id, req.user?.sub);
  }

  // Disparo manual/reenvio de e-mail de confirmação
  @Post(':id/send-email')
  sendEmail(@Param('id') id: string) {
    return this.orderService.sendOrderConfirmationEmail(id);
  }

  // Trigger para expiração de pedidos via admin
  @Post('expire-unpaid')
  expireUnpaid(@Req() req: any) {
    return this.orderService.expireUnpaidOrders(req.user?.sub || 'admin-manual-trigger');
  }
}

// Endpoint de infraestrutura para acionamento externo (Hostinger cPanel/hPanel cron curl)
@Controller('orders/jobs')
export class OrderJobController {
  constructor(private readonly orderService: OrderService) {}

  @Post('expire-unpaid')
  async triggerCronJob(@Req() req: any) {
    const secretHeader = req.headers['x-cron-secret'];
    const configuredSecret = process.env.CRON_JOB_SECRET;

    if (configuredSecret && secretHeader !== configuredSecret) {
      throw new UnauthorizedException('Chave de autenticação do cron inválida.');
    }

    return this.orderService.expireUnpaidOrders('external-infra-cron');
  }
}
