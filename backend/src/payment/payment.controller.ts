import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, RefundPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PaymentStatus } from '@prisma/client';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Process payment for an order (Pix or Credit Card)
   */
  @Post()
  processPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentService.processPayment(dto);
  }

  /**
   * Consult payment by ID (used by checkout polling)
   */
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.paymentService.findById(id);
  }

  /**
   * Consult payment by orderId
   */
  @Get('order/:orderId')
  findByOrderId(@Param('orderId') orderId: string) {
    return this.paymentService.findByOrderId(orderId);
  }

  /**
   * Dedicated Public Webhook Endpoint for Mercado Pago notifications
   */
  @Post('webhooks/mercadopago')
  handleWebhook(
    @Headers() headers: Record<string, any>,
    @Query() query: Record<string, any>,
    @Body() body: any,
  ) {
    return this.paymentService.handleWebhook(headers, query, body);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/payments')
export class AdminPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: PaymentStatus,
    @Query('orderId') orderId?: string,
  ) {
    return this.paymentService.findAll({ page: Number(page) || 1, limit: Number(limit) || 10, status, orderId });
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.paymentService.findById(id);
  }

  @Post(':id/cancel')
  cancelPayment(@Param('id') id: string, @Req() req: any) {
    return this.paymentService.cancelPayment(id, req.user?.sub);
  }

  @Post(':id/refund')
  refundPayment(
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: any,
  ) {
    return this.paymentService.refundPayment(id, dto, req.user?.sub);
  }
}
