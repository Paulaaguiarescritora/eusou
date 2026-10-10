export interface ExternalProductPayload {
  externalId?: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  stockQuantity: number;
  categoryExternalId?: string;
  attributes: Record<string, string>;
  images: string[];
  dimensions?: {
    height?: number;
    width?: number;
    length?: number;
    weight?: number;
  };
  metadata?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  externalProductId?: string;
  externalSku?: string;
  externalUrl?: string;
  message?: string;
  errorCode?: string;
  rawResponse?: any;
  timestamp: Date;
}

export interface MarketplaceConnector {
  readonly channelType: string;

  connect(config: Record<string, any>): Promise<SyncResult>;
  testConnection(config: Record<string, any>): Promise<SyncResult>;

  publishProduct(
    product: ExternalProductPayload,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult>;

  updateProduct(
    externalProductId: string,
    product: ExternalProductPayload,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult>;

  updatePrice(
    externalProductId: string,
    price: number,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult>;

  updateStock(
    externalProductId: string,
    quantity: number,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult>;

  unpublishProduct(
    externalProductId: string,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult>;

  syncProduct(
    externalProductId: string,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult>;

  getProduct?(
    externalProductId: string,
    accountConfig: Record<string, any>,
  ): Promise<SyncResult>;

  getExternalState?(
    externalProductId: string,
    accountConfig: Record<string, any>,
    variationId?: string,
  ): Promise<{
    price: number | null;
    stock: number | null;
    status: string | null;
    raw: any;
  }>;

  disconnect?(accountConfig: Record<string, any>): Promise<SyncResult>;
}
