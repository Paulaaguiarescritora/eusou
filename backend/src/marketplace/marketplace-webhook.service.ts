import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MarketplaceEventStatus } from '@prisma/client';
import { ChannelOrderIngestionService } from './channel-order-ingestion.service';

@Injectable()
export class MarketplaceWebhookService {
  private readonly logger = new Logger(MarketplaceWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderIngestion: ChannelOrderIngestionService,
  ) {}

  /**
   * Recebe notificação webhook e persiste imediatamente para responder em < 200ms.
   * Garante idempotência via @@unique([channelId, externalEventId]).
   */
  async recordIncomingWebhook(data: {
    channelId: string;
    externalEventId: string;
    topic: string;
    resource?: string;
    payload: any;
  }) {
    try {
      const existing = await this.prisma.marketplaceEvent.findUnique({
        where: {
          channelId_externalEventId: {
            channelId: data.channelId,
            externalEventId: data.externalEventId,
          },
        },
      });

      if (existing) {
        this.logger.log(
          `Evento webhook duplicado ignorado: channelId=${data.channelId}, externalEventId=${data.externalEventId}`,
        );
        return {
          duplicate: true,
          event: existing,
        };
      }

      const event = await this.prisma.marketplaceEvent.create({
        data: {
          channelId: data.channelId,
          externalEventId: data.externalEventId,
          topic: data.topic,
          resource: data.resource || null,
          payload: data.payload,
          status: MarketplaceEventStatus.RECEIVED,
        },
      });

      // Dispara processamento em background (não bloqueia a resposta HTTP)
      this.processEventAsync(event.id).catch((err) => {
        this.logger.error(`Erro ao disparar processamento do evento ${event.id}: ${err.message}`);
      });

      return {
        duplicate: false,
        event,
      };
    } catch (err: any) {
      this.logger.error(`Erro ao gravar webhook: ${err.message}`);
      throw err;
    }
  }

  /**
   * Processamento assíncrono de eventos da fila
   */
  async processEventAsync(eventId: string) {
    const event = await this.prisma.marketplaceEvent.findUnique({
      where: { id: eventId },
      include: { channel: { include: { accounts: true } } },
    });
    if (!event) return;

    await this.prisma.marketplaceEvent.update({
      where: { id: eventId },
      data: {
        status: MarketplaceEventStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });

    try {
      const topic = event.topic.toLowerCase();

      if (topic === 'orders_v2' || topic === 'orders' || topic.includes('order')) {
        // Tenta ingerir o pedido se o payload contiver dados de pedido
        const payload = event.payload as any;
        const externalOrderId =
          payload.order_id ||
          payload.id ||
          (event.resource ? event.resource.split('/').pop() : null) ||
          event.externalEventId;

        const account = event.channel.accounts[0];
        if (account) {
          await this.orderIngestion.ingestOrder({
            channelId: event.channelId,
            channelAccountId: account.id,
            externalOrderId: String(externalOrderId),
            externalStatus: payload.status || 'paid',
            externalTotal: Number(payload.total_amount || payload.price || 100),
            rawPayload: payload,
          });
        }
      }

      await this.prisma.marketplaceEvent.update({
        where: { id: eventId },
        data: {
          status: MarketplaceEventStatus.PROCESSED,
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (err: any) {
      this.logger.error(`Falha no processamento do evento ${eventId}: ${err.message}`);
      const maxAttempts = 5;
      const currentAttempts = event.attempts + 1;
      const willRetry = currentAttempts < maxAttempts;

      // Exponential backoff: 30s, 2m, 8m, 32m
      const backoffSec = Math.pow(4, currentAttempts) * 10;
      const nextAttemptAt = willRetry ? new Date(Date.now() + backoffSec * 1000) : null;

      await this.prisma.marketplaceEvent.update({
        where: { id: eventId },
        data: {
          status: willRetry ? MarketplaceEventStatus.RECEIVED : MarketplaceEventStatus.FAILED,
          lastError: err.message,
          nextAttemptAt,
        },
      });
    }
  }

  /**
   * Processa eventos pendentes para re-tentativa (Worker / Cron / Retry recovery)
   */
  async processPendingRetries(limit: number = 20) {
    const pendingEvents = await this.prisma.marketplaceEvent.findMany({
      where: {
        status: MarketplaceEventStatus.RECEIVED,
        attempts: { gt: 0, lt: 5 },
        nextAttemptAt: { lte: new Date() },
      },
      take: limit,
      orderBy: { nextAttemptAt: 'asc' },
    });

    const results = [];
    for (const ev of pendingEvents) {
      await this.processEventAsync(ev.id);
      results.push(ev.id);
    }
    return { processedCount: results.length, eventIds: results };
  }

  /**
   * Recupera feeds perdidos do Mercado Livre (Missed Feeds recovery)
   */
  async recoverMissedFeeds(channelId: string, accountId: string) {
    const account = await this.prisma.channelAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException(`Conta ${accountId} não encontrada.`);

    // Consulta API oficial do ML para missed feeds ou eventos pendentes
    let recoveredCount = 0;
    try {
      const cfg = (account.configuration as any) || {};
      const appId = cfg.clientId || process.env.MERCADOLIVRE_CLIENT_ID;
      if (appId) {
        const token = cfg.accessToken;
        const res = await fetch(`https://api.mercadolibre.com/missed_feeds?app_id=${appId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              const rec = await this.recordIncomingWebhook({
                channelId,
                externalEventId: String(msg._id || msg.id || Date.now()),
                topic: msg.topic || 'orders_v2',
                resource: msg.resource || null,
                payload: msg,
              });
              if (!rec.duplicate) recoveredCount++;
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Erro na consulta de missed_feeds: ${err.message}`);
    }

    return {
      channelId,
      accountId,
      recoveredCount,
      timestamp: new Date(),
    };
  }

  /**
   * Lista eventos de webhook
   */
  async listEvents(options?: {
    channelId?: string;
    status?: MarketplaceEventStatus;
    topic?: string;
    limit?: number;
  }) {
    return this.prisma.marketplaceEvent.findMany({
      where: {
        channelId: options?.channelId || undefined,
        status: options?.status || undefined,
        topic: options?.topic || undefined,
      },
      include: { channel: true },
      orderBy: { receivedAt: 'desc' },
      take: options?.limit || 50,
    });
  }
}
