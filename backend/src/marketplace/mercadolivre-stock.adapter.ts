import { Injectable, Logger } from '@nestjs/common';
import { SyncResult } from './marketplace-connector.interface';

export interface ExternalStockState {
  availableQuantity: number;
  source: 'ITEM' | 'USER_PRODUCT' | 'VARIATION';
  observedAt: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class MercadoLivreStockAdapter {
  private readonly logger = new Logger(MercadoLivreStockAdapter.name);
  private readonly apiBaseUrl = 'https://api.mercadolibre.com';

  /**
   * Atualiza a quantidade de estoque de um item, variação ou User Product no Mercado Livre
   */
  async updateStock(
    externalItemId: string,
    quantity: number,
    token: string,
    options?: {
      variationId?: string;
      userProductId?: string;
    },
  ): Promise<SyncResult> {
    try {
      const safeQty = Math.max(0, Math.floor(quantity));

      // Caso 1: Estoque de User Product (se habilitado)
      if (options?.userProductId) {
        const userProdUrl = `${this.apiBaseUrl}/user-products/stock/type/selling_address`;
        const userProdRes = await fetch(userProdUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_product_id: options.userProductId,
            available_quantity: safeQty,
          }),
        });

        if (userProdRes.ok) {
          return {
            success: true,
            message: `Estoque do User Product atualizado para ${safeQty}.`,
            timestamp: new Date(),
          };
        }
      }

      // Caso 2: Variação específica
      if (options?.variationId) {
        const varUrl = `${this.apiBaseUrl}/items/${externalItemId}/variations/${options.variationId}`;
        const varRes = await fetch(varUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ available_quantity: safeQty }),
        });
        const varData = await varRes.json().catch(() => ({}));
        if (!varRes.ok) {
          return {
            success: false,
            errorCode: `STOCK_VAR_UPDATE_${varRes.status}`,
            message: varData.message || `Erro ao atualizar estoque da variação ${options.variationId}.`,
            rawResponse: varData,
            timestamp: new Date(),
          };
        }
        return {
          success: true,
          message: `Estoque da variação ${options.variationId} atualizado para ${safeQty}.`,
          rawResponse: varData,
          timestamp: new Date(),
        };
      }

      // Caso 3: Item padrão
      const itemUrl = `${this.apiBaseUrl}/items/${externalItemId}`;
      const itemRes = await fetch(itemUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ available_quantity: safeQty }),
      });
      const itemData = await itemRes.json().catch(() => ({}));

      if (!itemRes.ok) {
        return {
          success: false,
          errorCode: `STOCK_UPDATE_${itemRes.status}`,
          message: itemData.message || `Erro ao atualizar estoque do anúncio ${externalItemId}.`,
          rawResponse: itemData,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        message: `Estoque do item ${externalItemId} atualizado para ${safeQty}.`,
        rawResponse: itemData,
        timestamp: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`Exceção ao atualizar estoque no ML: ${err.message}`);
      return {
        success: false,
        errorCode: 'STOCK_UPDATE_EXCEPTION',
        message: err.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Consulta o estoque externo observado
   */
  async getExternalStock(
    externalItemId: string,
    token: string,
    variationId?: string,
  ): Promise<ExternalStockState | null> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/items/${externalItemId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) return null;
      const data = await res.json();

      let availableQuantity = Number(data.available_quantity || 0);
      let source: ExternalStockState['source'] = 'ITEM';

      if (variationId && Array.isArray(data.variations)) {
        const foundVar = data.variations.find((v: any) => String(v.id) === String(variationId));
        if (foundVar && foundVar.available_quantity !== undefined) {
          availableQuantity = Number(foundVar.available_quantity);
          source = 'VARIATION';
        }
      }

      return {
        availableQuantity,
        source,
        observedAt: new Date(),
        metadata: {
          sold_quantity: data.sold_quantity,
          initial_quantity: data.initial_quantity,
        },
      };
    } catch (err: any) {
      this.logger.warn(`Erro ao consultar estoque externo ML: ${err.message}`);
      return null;
    }
  }
}
