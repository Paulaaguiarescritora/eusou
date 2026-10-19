import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrderExpirationScheduler {
  private readonly logger = new Logger(OrderExpirationScheduler.name);
  private isJobRunning = false;

  constructor(
    private readonly orderService: OrderService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Job executado automaticamente a cada 10 minutos.
   * Cancela pedidos PENDING cujo prazo de pagamento de 24h já expirou (paymentDeadline <= now)
   * e libera o estoque reservado de forma estritamente idempotente.
   */
  @Cron('*/10 * * * *', {
    name: 'expire-unpaid-orders-job',
    timeZone: 'America/Sao_Paulo',
  })
  async handleExpirationJob(): Promise<{
    found: number;
    expired: number;
    released: number;
    durationMs: number;
  }> {
    if (this.isJobRunning) {
      this.logger.warn(
        '[OrderExpirationScheduler] Execução anterior ainda em andamento. Ignorando disparo concorrente para evitar sobreposição.',
      );
      return { found: 0, expired: 0, released: 0, durationMs: 0 };
    }

    this.isJobRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log(
        '[OrderExpirationScheduler] Iniciando verificação periódica de pedidos não pagos expirados (> 24 horas)...',
      );

      const now = new Date();

      // Diagnóstico prévio: contagem de pedidos no escopo de expiração
      const foundCount = await this.prisma.order.count({
        where: {
          status: OrderStatus.PENDING,
          paymentDeadline: {
            lte: now,
          },
        },
      });

      if (foundCount === 0) {
        const durationMs = Date.now() - startTime;
        this.logger.log(
          `[OrderExpirationScheduler] Verificação concluída em ${durationMs}ms. Nenhum pedido pendente com prazo de pagamento expirado.`,
        );
        return { found: 0, expired: 0, released: 0, durationMs };
      }

      this.logger.log(
        `[OrderExpirationScheduler] Encontrado(s) ${foundCount} pedido(s) elegível(is) para cancelamento por prazo expirado. Executando cancelamento e liberação de estoque...`,
      );

      // Executa rotina idempotente oficial
      const result = await this.orderService.expireUnpaidOrders('system-expiration-cron');

      const durationMs = Date.now() - startTime;

      this.logger.log(
        `[OrderExpirationScheduler] Sucesso: ${result.expiredCount} pedido(s) cancelado(s), reservas liberadas em ${durationMs}ms. IDs: [${result.orderIds.join(', ')}]`,
      );

      return {
        found: foundCount,
        expired: result.expiredCount,
        released: result.expiredCount,
        durationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      this.logger.error(
        `[OrderExpirationScheduler] Falha na execução do job de expiração após ${durationMs}ms: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      this.isJobRunning = false;
    }
  }
}
