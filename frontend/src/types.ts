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
  media?: { id: string; url: string; sortOrder?: number; isPrimary?: boolean }[];
  variants?: ProductVariant[];
  categories?: { category: { id: string; name: string; slug: string } }[];
  niches?: { niche: { id: string; name: string; slug: string } }[];
  tags?: { tag: { id: string; name: string; slug: string } }[];
}

export interface ProductVariant {
  id: string;
  name?: string | null;
  sku?: string | null;
  price?: string | number | null;
  isActive: boolean;
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
}

export interface Catalog {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: 'MANUAL' | 'AUTOMATIC';
  theme?: Theme | null;
  resolvedProducts?: Product[];
  items?: { product: Product; position: number }[];
  collections?: { collection: Collection; position: number }[];
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  products?: Product[];
  items?: { product: Product; position: number }[];
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
  items: OrderItem[];
  affiliateCode?: string | null;
}

export interface Affiliate {
  id: string;
  userId: string;
  code: string;
  displayName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
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

export interface Material {
  id: string;
  name: string;
  type: 'PLA' | 'PETG' | 'ABS' | 'RESIN' | 'OTHER';
  color?: string | null;
  unit: 'GRAM' | 'KILOGRAM' | 'METER' | 'PIECE';
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
  productionMode: 'STOCK' | 'MAKE_TO_ORDER';
  productionTimeMinutes: number;
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
