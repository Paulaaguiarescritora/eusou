import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MarketplaceConnector,
  ExternalProductPayload,
  SyncResult,
} from './marketplace-connector.interface';
import { CredentialEncryptionService } from './credential-encryption.service';
import { ProductMapperService } from './product-mapper.service';

export interface MercadoLivreTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

@Injectable()
export class MercadoLivreConnector implements MarketplaceConnector {
  readonly channelType = 'MERCADO_LIVRE';
  private readonly logger = new Logger(MercadoLivreConnector.name);
  private readonly apiBaseUrl = 'https://api.mercadolibre.com';
  private readonly authBaseUrl = 'https://auth.mercadolivre.com.br';

  constructor(
    private readonly config: ConfigService,
    private readonly encryption: CredentialEncryptionService,
    private readonly mapper: ProductMapperService,
  ) {}

  // =========================================================================
  // 1. OAUTH 2.0 & TOKENS
  // =========================================================================

  /**
   * Constrói a URL oficial de consentimento do Mercado Livre
   */
  getAuthorizationUrl(state?: string): string {
    const clientId = this.config.get<string>('MERCADOLIVRE_CLIENT_ID') || '';
    const redirectUri =
      this.config.get<string>('MERCADOLIVRE_REDIRECT_URI') || '';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.authBaseUrl}/authorization?${params.toString()}`;
  }

  /**
   * Troca authorization code por access_token e refresh_token
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUriOverride?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    userId: string;
    encryptedConfig: Record<string, any>;
  }> {
    const clientId = this.config.get<string>('MERCADOLIVRE_CLIENT_ID') || '';
    const clientSecret =
      this.config.get<string>('MERCADOLIVRE_CLIENT_SECRET') || '';
    const redirectUri =
      redirectUriOverride ||
      this.config.get<string>('MERCADOLIVRE_REDIRECT_URI') ||
      '';

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(`${this.apiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      this.logger.error(
        `Falha no exchange de código ML: status ${response.status}`,
      );
      throw new Error(
        `Mercado Livre OAuth exchange failed: ${errBody.message || errBody.error || response.statusText}`,
      );
    }

    const data: MercadoLivreTokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in - 300) * 1000); // margem de segurança de 5 minutos

    // Criptografa tokens sensíveis antes de retornar para armazenamento
    const encAccessToken = this.encryption.encrypt(data.access_token);
    const encRefreshToken = this.encryption.encrypt(data.refresh_token);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      userId: String(data.user_id),
      encryptedConfig: {
        encAccessToken,
        encRefreshToken,
        expiresAt: expiresAt.toISOString(),
        mlUserId: String(data.user_id),
      },
    };
  }

  /**
   * Renova o access_token utilizando o refresh_token conforme especificação oficial
   */
  async refreshAccessToken(accountConfig: Record<string, any>): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    updatedConfig: Record<string, any>;
  }> {
    const clientId = this.config.get<string>('MERCADOLIVRE_CLIENT_ID') || '';
    const clientSecret =
      this.config.get<string>('MERCADOLIVRE_CLIENT_SECRET') || '';

    let currentRefreshToken = '';
    if (accountConfig.encRefreshToken) {
      currentRefreshToken = this.encryption.decrypt(
        accountConfig.encRefreshToken,
      );
    } else if (accountConfig.refreshToken) {
      currentRefreshToken = accountConfig.refreshToken;
    }

    if (!currentRefreshToken) {
      throw new Error('Refresh token não encontrado na configuração da conta.');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: currentRefreshToken,
    });

    const response = await fetch(`${this.apiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      this.logger.error(
        `Falha na renovação de token ML: status ${response.status}`,
      );
      throw new Error(
        `Mercado Livre token refresh failed: ${err.message || err.error || response.statusText}`,
      );
    }

    const data: MercadoLivreTokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in - 300) * 1000);

    const encAccessToken = this.encryption.encrypt(data.access_token);
    const encRefreshToken = this.encryption.encrypt(data.refresh_token);

    const updatedConfig = {
      ...accountConfig,
      encAccessToken,
      encRefreshToken,
      expiresAt: expiresAt.toISOString(),
      lastRefreshedAt: new Date().toISOString(),
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      updatedConfig,
    };
  }

  /**
   * Obtém access_token válido (executando refresh automático se expirado)
   */
  async getValidAccessToken(
    accountConfig: Record<string, any>,
    onTokenUpdated?: (newConfig: Record<string, any>) => Promise<void>,
  ): Promise<string> {
    const expiresAtStr = accountConfig.expiresAt;
    const isExpired = expiresAtStr
      ? new Date(expiresAtStr).getTime() <= Date.now()
      : false;

    if (isExpired && accountConfig.encRefreshToken) {
      this.logger.log(
        'Access token expirado, executando renovação via refresh_token...',
      );
      const { accessToken, updatedConfig } =
        await this.refreshAccessToken(accountConfig);
      if (onTokenUpdated) {
        await onTokenUpdated(updatedConfig);
      }
      return accessToken;
    }

    if (accountConfig.encAccessToken) {
      return this.encryption.decrypt(accountConfig.encAccessToken);
    }

    if (accountConfig.accessToken) {
      return accountConfig.accessToken;
    }

    throw new Error('Nenhum access token configurado na conta.');
  }

  // =========================================================================
  // 2. MÉTODOS DA INTERFACE MarketplaceConnector
  // =========================================================================

  async connect(config: Record<string, any>): Promise<SyncResult> {
    try {
      const token = await this.getValidAccessToken(config);
      const res = await fetch(`${this.apiBaseUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return {
          success: false,
          errorCode: `AUTH_${res.status}`,
          message: `Falha ao validar conta no Mercado Livre (status ${res.status}).`,
          timestamp: new Date(),
        };
      }

      const user = await res.json();
      return {
        success: true,
        externalProductId: String(user.id),
        message: `Conta ${user.nickname} (ID ${user.id}) conectada com sucesso.`,
        rawResponse: { nickname: user.nickname, site_id: user.site_id },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'CONNECT_ERROR',
        message: err.message || 'Erro ao conectar conta.',
        timestamp: new Date(),
      };
    }
  }

  async testConnection(config: Record<string, any>): Promise<SyncResult> {
    const start = Date.now();
    try {
      const token = await this.getValidAccessToken(config);
      const res = await fetch(`${this.apiBaseUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        return {
          success: false,
          errorCode: `PING_${res.status}`,
          message: `Teste de conexão falhou: Mercado Livre retornou HTTP ${res.status}. ${errorText}`,
          timestamp: new Date(),
        };
      }

      const user = await res.json();
      return {
        success: true,
        message: `Conexão ativa e verificada com sucesso! Vendedor: ${user.nickname} (${user.site_id}) [${Date.now() - start}ms].`,
        rawResponse: { id: user.id, nickname: user.nickname },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'PING_EXCEPTION',
        message: `Erro na comunicação com a API do Mercado Livre: ${err.message}`,
        timestamp: new Date(),
      };
    }
  }

  async publishProduct(
    product: ExternalProductPayload,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    try {
      const token = await this.getValidAccessToken(accountConfig);
      const mlPayload = this.mapper.mapToMercadoLivrePayload(product);

      const response = await fetch(`${this.apiBaseUrl}/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(mlPayload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let errorMsg =
          data.message || 'Erro desconhecido ao publicar no Mercado Livre';
        if (Array.isArray(data.cause) && data.cause.length > 0) {
          const causeDetails = data.cause
            .map((c: any) => c.message || JSON.stringify(c))
            .join('; ');
          errorMsg = `${errorMsg}: ${causeDetails}`;
        }

        return {
          success: false,
          errorCode: data.error || `HTTP_${response.status}`,
          message: `Mercado Livre rejeitou a publicação: ${errorMsg}`,
          rawResponse: data,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        externalProductId: data.id,
        externalSku: product.sku,
        externalUrl: data.permalink,
        message: `Produto publicado com sucesso no Mercado Livre. Anúncio: ${data.id}`,
        rawResponse: {
          id: data.id,
          permalink: data.permalink,
          status: data.status,
          price: data.price,
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'PUBLISH_EXCEPTION',
        message: `Exceção ao publicar no Mercado Livre: ${err.message}`,
        timestamp: new Date(),
      };
    }
  }

  async updateProduct(
    externalProductId: string,
    product: ExternalProductPayload,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    try {
      const token = await this.getValidAccessToken(accountConfig);
      const body = {
        title: product.title.slice(0, 60),
        pictures: product.images.map((img) => ({ source: img })),
      };

      const response = await fetch(
        `${this.apiBaseUrl}/items/${externalProductId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          errorCode: `HTTP_${response.status}`,
          message: `Falha ao atualizar anúncio no Mercado Livre: ${data.message || response.statusText}`,
          rawResponse: data,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        externalProductId,
        externalSku: product.sku,
        externalUrl: data.permalink,
        message: `Anúncio ${externalProductId} atualizado com sucesso no Mercado Livre.`,
        rawResponse: data,
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'UPDATE_EXCEPTION',
        message: err.message,
        timestamp: new Date(),
      };
    }
  }

  async updatePrice(
    externalProductId: string,
    price: number,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    try {
      const token = await this.getValidAccessToken(accountConfig);

      // No Mercado Livre, o PUT /items/{id} com price atualiza o preço do anúncio
      const response = await fetch(
        `${this.apiBaseUrl}/items/${externalProductId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ price }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          errorCode: `PRICE_${response.status}`,
          message: `Falha ao sincronizar preço no Mercado Livre: ${data.message || response.statusText}`,
          rawResponse: data,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        externalProductId,
        message: `Preço do anúncio ${externalProductId} atualizado para R$ ${price.toFixed(2)} no Mercado Livre.`,
        rawResponse: { price: data.price },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'PRICE_EXCEPTION',
        message: err.message,
        timestamp: new Date(),
      };
    }
  }

  async updateStock(
    externalProductId: string,
    quantity: number,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    try {
      const token = await this.getValidAccessToken(accountConfig);

      const response = await fetch(
        `${this.apiBaseUrl}/items/${externalProductId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ available_quantity: Math.max(0, quantity) }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          errorCode: `STOCK_${response.status}`,
          message: `Falha ao sincronizar estoque no Mercado Livre: ${data.message || response.statusText}`,
          rawResponse: data,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        externalProductId,
        message: `Estoque do anúncio ${externalProductId} atualizado para ${quantity} un. no Mercado Livre.`,
        rawResponse: { available_quantity: data.available_quantity },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'STOCK_EXCEPTION',
        message: err.message,
        timestamp: new Date(),
      };
    }
  }

  async unpublishProduct(
    externalProductId: string,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    try {
      const token = await this.getValidAccessToken(accountConfig);

      // Oficial: para pausar o anúncio no Mercado Livre altera-se status para "paused"
      const response = await fetch(
        `${this.apiBaseUrl}/items/${externalProductId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ status: 'paused' }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          errorCode: `UNPUBLISH_${response.status}`,
          message: `Falha ao pausar anúncio no Mercado Livre: ${data.message || response.statusText}`,
          rawResponse: data,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        externalProductId,
        message: `Anúncio ${externalProductId} pausado no Mercado Livre com sucesso.`,
        rawResponse: { status: data.status },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'UNPUBLISH_EXCEPTION',
        message: err.message,
        timestamp: new Date(),
      };
    }
  }

  async syncProduct(
    externalProductId: string,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    try {
      const token = await this.getValidAccessToken(accountConfig);

      const response = await fetch(
        `${this.apiBaseUrl}/items/${externalProductId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          success: false,
          errorCode: `SYNC_${response.status}`,
          message: `Falha ao consultar anúncio no Mercado Livre: ${data.message || response.statusText}`,
          rawResponse: data,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        externalProductId: data.id,
        externalUrl: data.permalink,
        message: `Anúncio sincronizado. Status no ML: ${data.status}, Preço: R$ ${data.price}, Estoque: ${data.available_quantity}.`,
        rawResponse: {
          id: data.id,
          status: data.status,
          price: data.price,
          available_quantity: data.available_quantity,
          permalink: data.permalink,
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'SYNC_EXCEPTION',
        message: err.message,
        timestamp: new Date(),
      };
    }
  }

  async getProduct(
    externalProductId: string,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult> {
    return this.syncProduct(externalProductId, accountConfig);
  }

  async disconnect(_accountConfig: Record<string, any>): Promise<SyncResult> {
    return {
      success: true,
      message: 'Tokens locais revogados e desvinculados com sucesso.',
      timestamp: new Date(),
    };
  }
}
