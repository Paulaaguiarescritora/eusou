import { Injectable } from '@nestjs/common';
import {
  MarketplaceConnector,
  ExternalProductPayload,
  SyncResult,
} from './marketplace-connector.interface';

@Injectable()
export class MockMarketplaceConnector implements MarketplaceConnector {
  readonly channelType = 'MERCADO_LIVRE';

  async connect(config: Record<string, any>): Promise<SyncResult> {
    const isMockError = config?.simulateError === true;
    if (isMockError) {
      return {
        success: false,
        message: 'Falha simulada na conexão com o canal externo.',
        errorCode: 'AUTH_FAILED',
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      externalProductId: config?.externalAccountId || 'mock-acc-' + Date.now(),
      message: 'Conexão mock estabelecida com sucesso.',
      timestamp: new Date(),
    };
  }

  async testConnection(config: Record<string, any>): Promise<SyncResult> {
    const isMockError = config?.simulateError === true;
    if (isMockError) {
      return {
        success: false,
        message:
          'Erro no teste de ping: canal indisponível ou credencial inválida.',
        errorCode: 'PING_FAILED',
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      message:
        'Teste de conexão bem-sucedido (Mock Marketplace API respondeu 200 OK).',
      timestamp: new Date(),
    };
  }

  async publishProduct(
    product: ExternalProductPayload,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    if (
      accountConfig?.simulatePublishError ||
      product.sku?.includes('ERR_PUBLISH')
    ) {
      return {
        success: false,
        errorCode: 'ERR_VALIDATION_EXTERNAL',
        message:
          'Mock Marketplace rejeitou a publicação: atributos obrigatórios ausentes.',
        timestamp: new Date(),
      };
    }

    const mockExternalId =
      'MLB-' + Math.floor(100000000 + Math.random() * 900000000);
    const mockExternalUrl = `https://produto.mercadolivre.com.br/${mockExternalId}-${product.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    return {
      success: true,
      externalProductId: mockExternalId,
      externalSku: product.sku,
      externalUrl: mockExternalUrl,
      message: 'Produto publicado com sucesso no Mock Marketplace.',
      rawResponse: {
        id: mockExternalId,
        status: 'active',
        title: product.title,
        price: product.price,
      },
      timestamp: new Date(),
    };
  }

  async updateProduct(
    externalProductId: string,
    product: ExternalProductPayload,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    if (accountConfig?.simulateError) {
      return {
        success: false,
        errorCode: 'ERR_UPDATE',
        message: 'Mock Marketplace rejeitou a atualização de produto.',
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      externalProductId,
      externalSku: product.sku,
      message: `Produto ${externalProductId} atualizado com sucesso.`,
      timestamp: new Date(),
    };
  }

  async updatePrice(
    externalProductId: string,
    price: number,
    _accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    if (price < 0) {
      return {
        success: false,
        errorCode: 'INVALID_PRICE',
        message: 'Preço não pode ser negativo no canal externo.',
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      externalProductId,
      message: `Preço do produto ${externalProductId} sincronizado para R$ ${price.toFixed(2)}.`,
      rawResponse: { price },
      timestamp: new Date(),
    };
  }

  async updateStock(
    externalProductId: string,
    quantity: number,
    _accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    if (quantity < 0) {
      return {
        success: false,
        errorCode: 'INVALID_STOCK',
        message: 'Estoque não pode ser negativo no canal externo.',
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      externalProductId,
      message: `Estoque do produto ${externalProductId} atualizado para ${quantity} un.`,
      rawResponse: { available_quantity: quantity },
      timestamp: new Date(),
    };
  }

  async unpublishProduct(
    externalProductId: string,
    _accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    return {
      success: true,
      externalProductId,
      message: `Produto ${externalProductId} pausado/despublicado com sucesso.`,
      timestamp: new Date(),
    };
  }

  async syncProduct(
    externalProductId: string,
    _accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    return {
      success: true,
      externalProductId,
      message: `Status e integridade do produto ${externalProductId} verificados com sucesso.`,
      rawResponse: {
        id: externalProductId,
        status: 'active',
        lastChecked: new Date().toISOString(),
      },
      timestamp: new Date(),
    };
  }
}
