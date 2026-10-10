import { Injectable, Logger } from '@nestjs/common';
import { SyncResult } from './marketplace-connector.interface';

export interface ExternalPriceState {
  rawPrice: number;
  currencyId: string;
  source: 'ITEM' | 'PRICE_API' | 'USER_PRODUCT' | 'VARIATION';
  observedAt: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class MercadoLivrePriceAdapter {
  private readonly logger = new Logger(MercadoLivrePriceAdapter.name);
  private readonly apiBaseUrl = 'https://api.mercadolibre.com';

  /**
   * Adapta e formata o preço efetivo do EuSou para envio à API do Mercado Livre
   */
  formatPricePayload(effectivePrice: number, currency: string = 'BRL') {
    return {
      price: Math.round(effectivePrice * 100) / 100,
      currency_id: currency,
    };
  }

  /**
   * Atualiza o preço de um item ou variação na API do Mercado Livre
   */
  async updatePrice(
    externalItemId: string,
    price: number,
    token: string,
    variationId?: string,
  ): Promise<SyncResult> {
    try {
      const payload: Record<string, any> = {
        price: Math.round(price * 100) / 100,
      };

      let url = `${this.apiBaseUrl}/items/${externalItemId}`;
      if (variationId) {
        url = `${this.apiBaseUrl}/items/${externalItemId}/variations/${variationId}`;
      }

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          errorCode: `PRICE_UPDATE_${res.status}`,
          message: data.message || `Erro ao atualizar preço na API ML (HTTP ${res.status}).`,
          rawResponse: data,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        message: `Preço atualizado com sucesso no Mercado Livre para R$ ${price.toFixed(2)}.`,
        rawResponse: data,
        timestamp: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`Exceção ao atualizar preço no ML: ${err.message}`);
      return {
        success: false,
        errorCode: 'PRICE_UPDATE_EXCEPTION',
        message: err.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Consulta o preço externo vigente do anúncio utilizando fontes oficiais
   */
  async getExternalPrice(
    externalItemId: string,
    token: string,
    variationId?: string,
  ): Promise<ExternalPriceState | null> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/items/${externalItemId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) return null;
      const data = await res.json();

      let targetPrice = data.price;
      let source: ExternalPriceState['source'] = 'ITEM';

      if (variationId && Array.isArray(data.variations)) {
        const foundVar = data.variations.find((v: any) => String(v.id) === String(variationId));
        if (foundVar && foundVar.price !== undefined) {
          targetPrice = foundVar.price;
          source = 'VARIATION';
        }
      }

      return {
        rawPrice: Number(targetPrice || 0),
        currencyId: data.currency_id || 'BRL',
        source,
        observedAt: new Date(),
        metadata: {
          original_price: data.original_price,
          base_price: data.base_price,
          buying_mode: data.buying_mode,
        },
      };
    } catch (err: any) {
      this.logger.warn(`Erro ao consultar preço externo ML: ${err.message}`);
      return null;
    }
  }
}
