export interface Product {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  brand?: string | null;
  basePrice?: string | number | null;
  costSource?: 'COST_FROM_F7' | 'MANUAL';
  manualCost?: string | number | null;
  wholesalePrice?: string | number | null;
  hasValidCost?: boolean;
  hasValidWholesalePrice?: boolean;
  statusCostLabel?: string;
  stock?: number;
  reservedStock?: number;
  availableStock?: number;
  productionProfiles?: any[];
  productChannelPrices?: any[];
  media?: { id: string; url: string; sortOrder?: number; isPrimary?: boolean; altText?: string | null }[];
  variants?: ProductVariant[];
  categories?: { category: { id: string; name: string; slug: string; niche?: { id: string; name: string; slug: string } } }[];
  niches?: { niche: { id: string; name: string; slug: string } }[];
  tags?: { tag: { id: string; name: string; slug: string } }[];
  productChannels?: {
    id: string;
    channelId: string;
    isEnabled: boolean;
    channel: { id: string; name: string; type: string };
  }[];
}

export interface ProductChannelItem {
  id: string;
  name: string;
  type: string;
  channelIsActive: boolean;
  isAssigned: boolean;
  isEnabled: boolean;
  assignedAt?: string | null;
}

export interface ProductChannelsResponse {
  productId: string;
  productName: string;
  productStatus: string;
  channels: ProductChannelItem[];
}

export interface ProductVariant {
  id: string;
  name?: string | null;
  sku?: string | null;
  price?: string | number | null;
  isActive: boolean;
  stock?: number;
  reservedStock?: number;
  availableStock?: number;
  productionCost?: number | null;
  initialStock?: number;
  materialId?: string | null;
  materialName?: string | null;
  materialCostPerUnit?: number | null;
  isMaterialCustom?: boolean;
  variantAttributeValues?: {
    productAttributeValue: {
      value: string;
      attributeDefinition: { name: string; slug: string };
    };
  }[];
}

export interface Theme {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  logo?: string | null;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  buttonStyle: string;
  cardStyle: string;
  bannerStyle: string;
  productsPerRow: number;
  showCategories: boolean;
  showHighlights: boolean;
  showNewProducts: boolean;
  showOffers: boolean;
  isPreset?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { catalogs?: number };
}

export interface CatalogRule {
  id?: string;
  catalogId?: string;
  type: 'NICHE' | 'CATEGORY' | 'TAG';
  value: string;
}

export interface Catalog {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  type: 'MANUAL' | 'AUTOMATIC';
  nicheId?: string | null;
  themeId?: string | null;
  niche?: Niche | null;
  theme?: Theme | null;
  rules?: CatalogRule[];
  resolvedProducts?: Product[];
  items?: { id?: string; productId?: string; product: Product; position: number }[];
  collections?: { id?: string; collectionId?: string; collection: Collection; position: number }[];
  _count?: { items?: number; collections?: number; rules?: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  coverMediaId?: string | null;
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  products?: Product[];
  items?: { id?: string; productId?: string; product: Product; position: number }[];
  catalogs?: { id?: string; catalogId?: string; catalog: Catalog; position?: number }[];
  _count?: { items?: number; catalogs?: number };
  createdAt?: string;
  updatedAt?: string;
}

export interface Niche {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  themeId?: string | null;
  theme?: Theme | null;
  categories?: { id: string; name: string; slug: string; status?: string; _count?: { products?: number } }[];
  _count?: { products?: number; catalogs?: number; categories?: number };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  parentId?: string | null;
  parent?: Category | null;
  nicheId?: string | null;
  niche?: Niche | null;
  children?: Category[];
  products?: { product: Product }[];
  _count?: { products?: number; children?: number };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE';
  _count?: { products?: number };
}

export interface AttributeDefinition {
  id: string;
  name: string;
  slug: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'SELECT';
  description?: string | null;
  options?: any;
}

export interface CartItem {
  productId: string;
  variantId?: string | null;
  name: string;
  variantLabel?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  unitPrice: number;
  quantity: number;
  nicheName?: string | null;
  availableStock?: number;
}

export interface OrderItem {
  id: string;
  productNameSnapshot: string;
  skuSnapshot?: string | null;
  quantity: number;
  unitPrice: string | number;
  subtotal: string | number;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  subtotal: string | number;
  shippingAmount: string | number;
  total: string | number;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  createdAt: string;
  paymentDeadline?: string | null;
  channelId?: string | null;
  items: OrderItem[];
  affiliateCode?: string | null;
  payments?: Payment[];
}

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'EXPIRED';

export type PaymentMethod = 'PIX' | 'CREDIT_CARD';

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentId?: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: string | number;
  currency: string;
  paidAt?: string | null;
  expiresAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  pixQrCode?: string | null;
  pixQrCodeBase64?: string | null;
  createdAt: string;
  order?: Order;
}

export interface Affiliate {
  id: string;
  userId: string;
  code: string;
  displayName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  defaultCommissionPercent?: number | string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface AffiliateLink {
  id: string;
  affiliateId: string;
  code: string;
  slug: string;
  targetType: 'STORE' | 'PRODUCT' | 'COLLECTION' | 'CATALOG';
  targetId?: string | null;
  targetUrl: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  clicksCount: number;
  createdAt: string;
}

export interface AffiliateConversion {
  id: string;
  affiliateId: string;
  orderId: string;
  orderAmount: number | string;
  commissionRate: number | string;
  commissionAmount: number | string;
  appliedCommissionPercent?: number | string | null;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  createdAt: string;
  affiliate?: {
    displayName: string;
    code: string;
  };
  order?: {
    id: string;
    total: number | string;
    status: string;
  };
}

export interface AffiliateDashboardStats {
  affiliate: Affiliate;
  clicks: number;
  conversions: number;
  totalSold: number;
  pendingCommission: number;
  approvedCommission: number;
}

export interface CommissionRule {
  id: string;
  name: string;
  type: 'GLOBAL' | 'AFFILIATE' | 'PRODUCT' | 'PRODUCT_AFFILIATE';
  percentage: number | string;
  affiliateId?: string | null;
  productId?: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  affiliate?: { displayName: string; code: string };
  product?: { name: string; sku?: string | null };
}

// ==========================================
// F7: PRODUÇÃO, IMPRESSORAS, MATERIAIS, CUSTOS E ESTOQUE
// ==========================================

export interface Printer {
  id: string;
  name: string;
  model: string;
  status: 'AVAILABLE' | 'PRINTING' | 'MAINTENANCE' | 'INACTIVE';
  location?: string | null;
  machineCostPerHour: number | string;
  notes?: string | null;
  createdAt: string;
}

export type MaterialCategory = 'PRODUCTION' | 'COMPONENT' | 'PACKAGING';

export interface Material {
  id: string;
  name: string;
  type: 'PLA' | 'PETG' | 'ABS' | 'RESIN' | 'OTHER';
  category?: MaterialCategory;
  color?: string | null;
  unit: 'GRAM' | 'KILOGRAM' | 'METER' | 'PIECE' | 'UNIT';
  costPerUnit: number | string;
  currentQuantity: number | string;
  minimumQuantity: number | string;
  isActive: boolean;
  createdAt: string;
}

export interface ProductionProfile {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  printerId?: string | null;
  productionMode: 'STOCK' | 'MAKE_TO_ORDER';
  productionTimeMinutes: number;
  productionTimeSeconds?: number | null;
  materialWeightGrams: number | string;
  powerConsumptionWatts: number;
  finishingTimeMinutes: number;
  finishingCost: number | string;
  packagingCost: number | string;
  laborCost: number | string;
  notes?: string | null;
  isActive: boolean;
  product?: Product | null;
  variant?: ProductVariant | null;
  printer?: Printer | null;
  materials?: {
    id: string;
    materialId: string;
    quantity: number | string;
    unit: string;
    material: Material;
  }[];
}

export interface ProductionJob {
  id: string;
  productId: string;
  variantId?: string | null;
  printerId: string;
  status: 'QUEUED' | 'PRINTING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  plannedQuantity: number;
  producedQuantity: number;
  rejectedQuantity: number;
  startedAt?: string | null;
  completedAt?: string | null;
  estimatedCost: number | string;
  actualCost?: number | string | null;
  notes?: string | null;
  createdAt: string;
  product?: Product;
  variant?: ProductVariant | null;
  printer?: Printer;
}

export interface InventoryItem {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  quantity: number;
  reservedQuantity: number;
  minimumQuantity: number;
  availableQuantity: number;
  isLowStock: boolean;
  updatedAt: string;
  product?: Product | null;
  variant?: ProductVariant | null;
}

export interface StockMovement {
  id: string;
  productId: string;
  variantId?: string | null;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RESERVATION' | 'RELEASE';
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason: string;
  createdBy?: string | null;
  createdAt: string;
  product?: Product | null;
  variant?: ProductVariant | null;
}

// ==========================================
// F9: MARKETPLACES, CANAIS E CONECTORES
// ==========================================

export type ChannelType =
  | 'OWN_STORE'
  | 'MERCADO_LIVRE'
  | 'SHOPEE'
  | 'AMAZON'
  | 'MAGALU'
  | 'TIKTOK_SHOP'
  | 'GOOGLE_MERCHANT'
  | 'OTHER';

export type ChannelAccountStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ERROR'
  | 'DISCONNECTED'
  | 'PENDING';

export type ChannelProductStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'ERROR'
  | 'UNPUBLISHED';

export type ChannelSyncOperation =
  | 'PUBLISH'
  | 'UPDATE'
  | 'PRICE'
  | 'STOCK'
  | 'UNPUBLISH'
  | 'SYNC'
  | 'TEST_CONNECTION';

export type ChannelSyncStatus = 'SUCCESS' | 'ERROR' | 'PENDING';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  isActive: boolean;
  description?: string | null;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    accounts: number;
    categories: number;
  };
}

export interface ChannelAccount {
  id: string;
  channelId: string;
  name: string;
  status: ChannelAccountStatus;
  externalAccountId?: string | null;
  configuration?: Record<string, any> | null;
  lastSyncAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  channel?: Channel;
  _count?: {
    channelProducts: number;
    syncLogs: number;
  };
}

export interface ChannelProduct {
  id: string;
  productId: string;
  channelAccountId: string;
  externalProductId?: string | null;
  externalUrl?: string | null;
  externalSku?: string | null;
  priceOverride?: number | string | null;
  status: ChannelProductStatus;
  lastSyncAt?: string | null;
  lastError?: string | null;
  syncPayload?: any;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  channelAccount?: ChannelAccount;
}

export interface ChannelCategoryMapping {
  id: string;
  channelId: string;
  categoryId: string;
  externalCategoryId: string;
  externalCategoryName: string;
  createdAt: string;
  channel?: Channel;
  category?: Category;
}

export interface ChannelSyncLog {
  id: string;
  channelAccountId: string;
  channelProductId?: string | null;
  operation: ChannelSyncOperation;
  status: ChannelSyncStatus;
  message?: string | null;
  details?: any;
  externalCode?: string | null;
  durationMs?: number | null;
  createdAt: string;
  channelAccount?: ChannelAccount;
  channelProduct?: ChannelProduct;
}

// F13A / F13B Types
export interface ChannelOrder {
  id: string;
  channelId: string;
  channelAccountId: string;
  orderId: string;
  externalOrderId: string;
  externalBuyerId?: string | null;
  externalStatus: string;
  externalTotal: number | string;
  externalCurrency: string;
  commissionFee?: number | string | null;
  shippingFee?: number | string | null;
  rawPayload?: any;
  syncedAt: string;
  createdAt: string;
  channel?: Channel;
  channelAccount?: ChannelAccount;
  order?: {
    id: string;
    customerName: string;
    customerEmail: string;
    status: string;
    total: number | string;
  };
}

export interface MarketplaceEvent {
  id: string;
  channelId: string;
  externalEventId: string;
  topic: string;
  resource?: string | null;
  payload: any;
  status: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED';
  attempts: number;
  lastError?: string | null;
  nextAttemptAt?: string | null;
  receivedAt: string;
  processedAt?: string | null;
  channel?: Channel;
}

export interface ChannelAttributeMapping {
  id: string;
  channelId: string;
  externalCategoryId?: string | null;
  attributeDefinitionId: string;
  externalAttributeId: string;
  externalAttributeName?: string | null;
  isRequired: boolean;
  defaultValue?: string | null;
  valueMapping?: Record<string, string> | null;
  attributeDefinition?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface DiscrepancyReport {
  channelProductId: string;
  productId: string;
  channelName: string;
  externalProductId: string;
  hasDiscrepancy: boolean;
  discrepancies: {
    price?: {
      localEffectivePrice: number;
      remotePrice: number;
      delta: number;
    };
    stock?: {
      localAvailableStock: number;
      remoteStock: number;
      delta: number;
    };
    status?: {
      localStatus: string;
      remoteStatus: string;
    };
  };
}

// ==========================================
// F14: CENTRAL DE OPERAÇÃO COMERCIAL TYPES
// ==========================================

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface CommercialAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  entityRelated: string;
  entityId?: string;
  createdAt: string;
  recommendedAction: 'VER' | 'CORRIGIR' | 'SINCRONIZAR' | 'REPROCESSAR' | 'IGNORAR';
  actionUrl: string;
}

export type OperationHealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface OperationHealth {
  status: OperationHealthStatus;
  label: string;
  summary: string;
  counts: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
}

export interface CommercialDashboardData {
  period: {
    filter: 'today' | '7d' | '30d' | '90d';
    startDate: string;
    endDate: string;
  };
  health: OperationHealth;
  alerts: CommercialAlert[];
  sales: {
    totalRevenue: string;
    previousRevenue: string;
    growthPercent: number | null;
    orderCount: number;
    averageTicket: string;
    periods: {
      today: { orders: number; revenue: string };
      days7: { orders: number; revenue: string };
      days30: { orders: number; revenue: string };
    };
    originBreakdown: {
      ownStore: string;
      marketplace: string;
      affiliate: string;
    };
  };
  products: {
    total: number;
    active: number;
    withoutCategory: number;
    withoutBasePrice: number;
    publishErrors: number;
  };
  inventory: {
    availableQuantity: number;
    reservedQuantity: number;
    criticalCount: number;
    lowCount: number;
    criticalItems: {
      productId: string;
      variantId?: string;
      productName: string;
      sku?: string;
      available: number;
      minimum: number;
      status: 'ESGOTADO' | 'BAIXO';
    }[];
  };
  production: {
    activeJobsCount: number;
    completedJobsCount: number;
    recentJobs: {
      id: string;
      productName: string;
      plannedQuantity: number;
      printerName: string;
      status: string;
      createdAt: string;
    }[];
  };
  marketplaces: {
    totalChannels: number;
    activeAccounts: number;
    publishedCount: number;
    pendingEvents: number;
    failedEvents: number;
    accounts: {
      accountId: string;
      accountName: string;
      channelName: string;
      channelType: string;
      status: string;
      lastSyncAt?: string;
      publishedCount: number;
      recentOrdersCount: number;
    }[];
  };
  affiliates: {
    total: number;
    active: number;
    clicks: number;
    conversions: number;
    totalSales: string;
    pendingCommissions: string;
    approvedCommissions: string;
  };
  recentOrders: {
    id: string;
    customerName: string;
    total: string;
    status: string;
    origin: string;
    createdAt: string;
    itemCount: number;
  }[];
}
