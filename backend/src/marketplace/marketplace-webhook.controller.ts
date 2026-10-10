import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MarketplaceWebhookService } from './marketplace-webhook.service';
import { PrismaService } from '../prisma.service';
import { ChannelType } from '@prisma/client';

@Controller('marketplaces/webhooks')
export class MarketplaceWebhookController {
  private readonly logger = new Logger(MarketplaceWebhookController.name);

  constructor(
    private readonly webhookService: MarketplaceWebhookService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Endpoint público de ingestão rápida de webhooks dos canais de marketplace.
   * Responde HTTP 200/202 em tempo recorde (< 200ms) conforme SLAs do Mercado Livre, Shopee, etc.
   */
  @Post(':channelType')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('channelType') channelTypeParam: string,
    @Body() payload: any,
    @Headers('x-signature') signature?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const channelTypeUpper = channelTypeParam.toUpperCase().replace('-', '_');

    // Valida se o canal existe no banco
    const channel = await this.prisma.channel.findFirst({
      where: {
        OR: [
          { type: channelTypeUpper as ChannelType },
          { name: { contains: channelTypeParam, mode: 'insensitive' } },
        ],
      },
    });

    if (!channel) {
      this.logger.warn(`Webhook recebido para canal desconhecido: ${channelTypeParam}`);
      // Responde 200 para evitar que o marketplace fique reenviando em loop
      return { status: 'IGNORED', message: 'Channel not found' };
    }

    // Identifica ID único do evento para garantir idempotência
    // Mercado Livre: payload._id, payload.resource, ou requestId
    const externalEventId =
      payload?._id ||
      payload?.id ||
      payload?.event_id ||
      requestId ||
      `${channel.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const topic = payload?.topic || payload?.event || payload?.type || 'notification';
    const resource = payload?.resource || payload?.uri || null;

    const result = await this.webhookService.recordIncomingWebhook({
      channelId: channel.id,
      externalEventId: String(externalEventId),
      topic,
      resource,
      payload,
    });

    return {
      status: 'ACK',
      duplicate: result.duplicate,
      eventId: result.event.id,
    };
  }
}
