export interface ParsedProductRow {
  rowNumber: number;
  sku: string;
  name: string;
  nicheName: string;
  categoryName: string;
  subcategoryName?: string | null;
  brand?: string | null;
  slug?: string | null;
  tags: string[];
  shortDescription?: string | null;
  description?: string | null;
  costSource: 'MANUAL' | 'COST_FROM_F7';
  manualCost?: number | null;
  wholesalePrice: number;
  initialStock?: number;
  channels: string[];
}

export interface ParsedVariantRow {
  rowNumber: number;
  productSku: string;
  sku: string;
  name: string;
  initialStock: number;
}

export interface ParsedImageRow {
  rowNumber: number;
  productSku: string;
  variantSku?: string | null;
  sortOrder: number;
  fileOrUrl: string;
  isPrimary: boolean;
}

export interface DryRunIssue {
  sheet: 'Produtos' | 'Variantes' | 'Imagens' | 'Arquivo';
  row: number;
  sku?: string;
  message: string;
}

export interface DryRunSummary {
  totalProducts: number;
  validProducts: number;
  invalidProducts: number;
  validVariants: number;
  validImages: number;
  errors: DryRunIssue[];
  warnings: DryRunIssue[];
  canImport: boolean;
  importToken?: string;
}

export interface ParsedImportPackage {
  products: ParsedProductRow[];
  variants: ParsedVariantRow[];
  images: ParsedImageRow[];
  zipImages?: Map<string, Buffer>;
  isZipPackage?: boolean;
  fileName?: string;
}

export type ImportTokenStatus = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';

export interface ExecuteImportResult {
  success: boolean;
  totalProductsCreated: number;
  totalVariantsCreated: number;
  totalImagesProcessed: number;
  totalChannelsAssigned: number;
  totalStockMovements: number;
  createdProducts: Array<{ id: string; sku: string; name: string }>;
  durationMs: number;
  rolledBack?: boolean;
  error?: string;
  failedStage?: string;
  failedSku?: string;
}
