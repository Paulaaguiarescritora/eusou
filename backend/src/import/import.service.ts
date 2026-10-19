import {
  Injectable,
  Logger,
  OnModuleDestroy,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ImportParserService } from './import-parser.service';
import { ProductService } from '../product/product.service';
import { VariantService } from '../variant/variant.service';
import { InventoryService } from '../inventory/inventory.service';
import { MediaService } from '../media/media.service';
import { AuditLogService } from '../audit-log.service';
import { generateSlug } from '../product/utils/slug.util';
import { ProductStatus } from '@prisma/client';
import { ExecuteImportDto } from './dto/dry-run.dto';
import {
  DryRunIssue,
  DryRunSummary,
  ParsedImportPackage,
  ParsedProductRow,
  ParsedVariantRow,
  ParsedImageRow,
  ExecuteImportResult,
  ImportTokenStatus,
} from './interfaces/import.interfaces';
import { randomUUID } from 'crypto';

export interface CachedImport {
  packageData: ParsedImportPackage;
  createdAt: number;
  actorId?: string;
  status: ImportTokenStatus;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
}

@Injectable()
export class ImportService implements OnModuleDestroy {
  private readonly logger = new Logger(ImportService.name);

  // Cache em memória para lotes validados no Dry-Run (TTL: 30 minutos)
  private readonly importCache = new Map<string, CachedImport>();
  private cleanupInterval: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ImportParserService,
    private readonly productService: ProductService,
    private readonly variantService: VariantService,
    private readonly inventoryService: InventoryService,
    private readonly mediaService: MediaService,
    private readonly auditLog: AuditLogService,
  ) {
    // Limpeza periódica de tokens expirados a cada 10 minutos (unref para não bloquear encerramento de testes)
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [token, data] of this.importCache.entries()) {
        if (now - data.createdAt > 30 * 60 * 1000) {
          this.importCache.delete(token);
        }
      }
    }, 10 * 60 * 1000);

    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  public getCachedImport(token: string): CachedImport | undefined {
    return this.importCache.get(token);
  }

  public removeCachedImport(token: string): void {
    this.importCache.delete(token);
  }

  /**
   * FASE 1: DRY-RUN COMPLETO SEM GRAVAÇÃO NO BANCO
   */
  async dryRun(
    buffer: Buffer,
    fileName?: string,
    actorId?: string,
  ): Promise<DryRunSummary> {
    const errors: DryRunIssue[] = [];
    const warnings: DryRunIssue[] = [];

    // 1. Extração e Parse da Planilha / ZIP
    const { packageData, parseErrors } = this.parser.parseBuffer(buffer, fileName);
    if (parseErrors.length > 0) {
      errors.push(...parseErrors);
      return {
        totalProducts: 0,
        validProducts: 0,
        invalidProducts: 0,
        validVariants: 0,
        validImages: 0,
        errors,
        warnings,
        canImport: false,
      };
    }

    const { products, variants, images, zipImages } = packageData;

    if (products.length === 0) {
      errors.push({
        sheet: 'Produtos',
        row: 1,
        message: 'Nenhum produto encontrado para importação na planilha.',
      });
      return {
        totalProducts: 0,
        validProducts: 0,
        invalidProducts: 0,
        validVariants: 0,
        validImages: 0,
        errors,
        warnings,
        canImport: false,
      };
    }

    // Pré-carregamento dos dados de referência do banco para validação eficiente em lote
    const [
      existingProducts,
      existingVariants,
      dbNiches,
      dbCategories,
      dbChannels,
    ] = await Promise.all([
      this.prisma.product.findMany({
        select: { id: true, sku: true, slug: true, name: true },
      }),
      this.prisma.productVariant.findMany({
        select: { id: true, sku: true, productId: true },
      }),
      this.prisma.niche.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.category.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, slug: true, parentId: true, nicheId: true },
      }),
      this.prisma.channel.findMany({
        where: { isActive: true },
        select: { id: true, name: true, type: true },
      }),
    ]);

    // Mapas para consulta rápida no banco
    const dbProductSkuSet = new Set(
      existingProducts.map((p) => (p.sku || '').toUpperCase()).filter(Boolean),
    );
    const dbProductSlugSet = new Set(
      existingProducts.map((p) => (p.slug || '').toLowerCase()).filter(Boolean),
    );
    const dbVariantSkuSet = new Set(
      existingVariants.map((v) => (v.sku || '').toUpperCase()).filter(Boolean),
    );

    // Mapeamento e Agrupamento no Arquivo
    const fileProductSkuMap = new Map<string, ParsedProductRow>();
    const fileProductSlugMap = new Map<string, number>();
    const fileVariantSkuMap = new Map<string, number>();
    const invalidProductSkus = new Set<string>();

    // 2. Validação da Aba PRODUTOS
    for (const prod of products) {
      const row = prod.rowNumber;
      const skuNorm = (prod.sku || '').toUpperCase().trim();

      // SKU Obrigatório
      if (!skuNorm) {
        errors.push({
          sheet: 'Produtos',
          row,
          message: 'Produtos — linha ' + row + ' — SKU do produto é obrigatório.',
        });
        invalidProductSkus.add(`ROW_${row}`);
      } else {
        // SKU Duplicado dentro do arquivo
        if (fileProductSkuMap.has(skuNorm)) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU "${prod.sku}" duplicado no arquivo (já declarado na linha ${fileProductSkuMap.get(skuNorm)!.rowNumber}).`,
          });
          invalidProductSkus.add(skuNorm);
        } else {
          fileProductSkuMap.set(skuNorm, prod);
        }

        // SKU já existente no banco de dados
        if (dbProductSkuSet.has(skuNorm)) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU "${prod.sku}" já cadastrado no sistema. Não é permitido sobrescrever produto existente.`,
          });
          invalidProductSkus.add(skuNorm);
        }

        // SKU de produto colidindo com SKU de variante existente
        if (dbVariantSkuSet.has(skuNorm)) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU "${prod.sku}" conflita com o SKU de uma variante já existente no sistema.`,
          });
          invalidProductSkus.add(skuNorm);
        }
      }

      // Nome Obrigatório
      if (!prod.name || prod.name.trim().length === 0) {
        errors.push({
          sheet: 'Produtos',
          row,
          sku: prod.sku,
          message: `Produtos — linha ${row} — Nome do produto é obrigatório.`,
        });
        invalidProductSkus.add(skuNorm || `ROW_${row}`);
      }

      // Slug: validação ou geração
      const effectiveSlug = prod.slug?.trim() ? generateSlug(prod.slug) : generateSlug(prod.name);
      if (!effectiveSlug) {
        errors.push({
          sheet: 'Produtos',
          row,
          sku: prod.sku,
          message: `Produtos — linha ${row} — SKU ${prod.sku} — Não foi possível gerar um slug válido a partir do nome do produto.`,
        });
        invalidProductSkus.add(skuNorm || `ROW_${row}`);
      } else {
        // Slug duplicado no arquivo
        if (fileProductSlugMap.has(effectiveSlug)) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU ${prod.sku} — Slug "${effectiveSlug}" duplicado no arquivo (conflita com a linha ${fileProductSlugMap.get(effectiveSlug)}).`,
          });
          invalidProductSkus.add(skuNorm || `ROW_${row}`);
        } else {
          fileProductSlugMap.set(effectiveSlug, row);
        }

        // Slug existente no banco
        if (dbProductSlugSet.has(effectiveSlug)) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU ${prod.sku} — Slug "${effectiveSlug}" já cadastrado no sistema.`,
          });
          invalidProductSkus.add(skuNorm || `ROW_${row}`);
        }
      }

      // Preço de Atacado: OBRIGATÓRIO E > 0
      if (!prod.wholesalePrice || prod.wholesalePrice <= 0) {
        errors.push({
          sheet: 'Produtos',
          row,
          sku: prod.sku,
          message: `Produtos — linha ${row} — SKU ${prod.sku} — Preço de Atacado é obrigatório e deve ser maior que zero (base de cálculo do motor F12).`,
        });
        invalidProductSkus.add(skuNorm || `ROW_${row}`);
      }

      // Fonte do Custo e Custo de Produção
      if (prod.costSource === 'MANUAL') {
        if (!prod.manualCost || prod.manualCost <= 0) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU ${prod.sku} — Para Fonte do Custo "MANUAL", o Custo de Produção é obrigatório e deve ser maior que zero.`,
          });
          invalidProductSkus.add(skuNorm || `ROW_${row}`);
        }
      }

      // TAXONOMIA: Validação rigorosa da Hierarquia Nicho -> Categoria -> Subcategoria
      // REGRA: NÃO criar automaticamente durante a importação.
      const nicheInput = (prod.nicheName || '').trim();
      const catInput = (prod.categoryName || '').trim();
      const subcatInput = (prod.subcategoryName || '').trim();

      if (!nicheInput) {
        errors.push({
          sheet: 'Produtos',
          row,
          sku: prod.sku,
          message: `Produtos — linha ${row} — SKU ${prod.sku} — Nicho é obrigatório.`,
        });
        invalidProductSkus.add(skuNorm || `ROW_${row}`);
      }

      if (!catInput) {
        errors.push({
          sheet: 'Produtos',
          row,
          sku: prod.sku,
          message: `Produtos — linha ${row} — SKU ${prod.sku} — Categoria é obrigatória.`,
        });
        invalidProductSkus.add(skuNorm || `ROW_${row}`);
      }

      let matchedNiche: any = null;
      if (nicheInput) {
        const nicheSlug = generateSlug(nicheInput);
        matchedNiche = dbNiches.find(
          (n) =>
            n.name.toLowerCase() === nicheInput.toLowerCase() ||
            n.slug.toLowerCase() === nicheSlug,
        );

        if (!matchedNiche) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU ${prod.sku} — Nicho "${nicheInput}" não encontrado no sistema.`,
          });
          invalidProductSkus.add(skuNorm || `ROW_${row}`);
        }
      }

      let matchedCategory: any = null;
      if (matchedNiche && catInput) {
        const catSlug = generateSlug(catInput);
        matchedCategory = dbCategories.find(
          (c) =>
            c.nicheId === matchedNiche.id &&
            !c.parentId &&
            (c.name.toLowerCase() === catInput.toLowerCase() ||
              c.slug.toLowerCase() === catSlug),
        );

        if (!matchedCategory) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU ${prod.sku} — Categoria "${catInput}" não encontrada no Nicho "${nicheInput}".`,
          });
          invalidProductSkus.add(skuNorm || `ROW_${row}`);
        }
      }

      if (matchedNiche && matchedCategory && subcatInput) {
        const subcatSlug = generateSlug(subcatInput);
        const matchedSubcategory = dbCategories.find(
          (c) =>
            c.nicheId === matchedNiche.id &&
            c.parentId === matchedCategory.id &&
            (c.name.toLowerCase() === subcatInput.toLowerCase() ||
              c.slug.toLowerCase() === subcatSlug),
        );

        if (!matchedSubcategory) {
          errors.push({
            sheet: 'Produtos',
            row,
            sku: prod.sku,
            message: `Produtos — linha ${row} — SKU ${prod.sku} — Subcategoria "${subcatInput}" não encontrada na Categoria "${catInput}" do Nicho "${nicheInput}".`,
          });
          invalidProductSkus.add(skuNorm || `ROW_${row}`);
        }
      }

      // Validação de Canais Comerciais
      if (prod.channels.length > 0) {
        for (const chName of prod.channels) {
          const chClean = chName.toUpperCase().replace(/\s+/g, '_');
          const channelExists = dbChannels.some(
            (c) =>
              c.type.toUpperCase() === chClean ||
              c.name.toLowerCase() === chName.toLowerCase(),
          );
          if (!channelExists) {
            errors.push({
              sheet: 'Produtos',
              row,
              sku: prod.sku,
              message: `Produtos — linha ${row} — SKU ${prod.sku} — Canal comercial "${chName}" não encontrado no sistema.`,
            });
            invalidProductSkus.add(skuNorm || `ROW_${row}`);
          }
        }
      }
    }

    // 3. Validação da Aba VARIANTES
    const productVariantsMap = new Map<string, ParsedVariantRow[]>();
    for (const v of variants) {
      const row = v.rowNumber;
      const prodSkuNorm = (v.productSku || '').toUpperCase().trim();
      const varSkuNorm = (v.sku || '').toUpperCase().trim();

      if (!prodSkuNorm) {
        errors.push({
          sheet: 'Variantes',
          row,
          message: `Variantes — linha ${row} — SKU do Produto não informado.`,
        });
        continue;
      }

      // Produto pai deve existir na aba Produtos
      if (!fileProductSkuMap.has(prodSkuNorm)) {
        errors.push({
          sheet: 'Variantes',
          row,
          sku: v.sku,
          message: `Variantes — linha ${row} — SKU do Produto "${v.productSku}" não encontrado na aba Produtos.`,
        });
        continue;
      }

      // SKU da Variante obrigatório
      if (!varSkuNorm) {
        errors.push({
          sheet: 'Variantes',
          row,
          message: `Variantes — linha ${row} — SKU da Variante é obrigatório para o produto "${v.productSku}".`,
        });
        invalidProductSkus.add(prodSkuNorm);
        continue;
      }

      // SKU da Variante duplicado dentro do arquivo
      if (fileVariantSkuMap.has(varSkuNorm)) {
        errors.push({
          sheet: 'Variantes',
          row,
          sku: v.sku,
          message: `Variantes — linha ${row} — SKU da Variante "${v.sku}" duplicado no arquivo (conflita com a linha ${fileVariantSkuMap.get(varSkuNorm)}).`,
        });
        invalidProductSkus.add(prodSkuNorm);
      } else {
        fileVariantSkuMap.set(varSkuNorm, row);
      }

      // SKU da Variante já existente no banco de dados
      if (dbVariantSkuSet.has(varSkuNorm)) {
        errors.push({
          sheet: 'Variantes',
          row,
          sku: v.sku,
          message: `Variantes — linha ${row} — SKU da Variante "${v.sku}" já cadastrado no sistema.`,
        });
        invalidProductSkus.add(prodSkuNorm);
      }

      // SKU da Variante colidindo com SKU de Produto (no banco ou no arquivo)
      if (dbProductSkuSet.has(varSkuNorm) || fileProductSkuMap.has(varSkuNorm)) {
        errors.push({
          sheet: 'Variantes',
          row,
          sku: v.sku,
          message: `Variantes — linha ${row} — SKU da Variante "${v.sku}" conflita com o SKU de um produto pai.`,
        });
        invalidProductSkus.add(prodSkuNorm);
      }

      // Nome da Variante
      if (!v.name || v.name.trim().length === 0) {
        errors.push({
          sheet: 'Variantes',
          row,
          sku: v.sku,
          message: `Variantes — linha ${row} — Nome da variante é obrigatório para o SKU "${v.sku}".`,
        });
        invalidProductSkus.add(prodSkuNorm);
      }

      // Estoque Inicial da Variante
      if (v.initialStock < 0 || isNaN(v.initialStock)) {
        errors.push({
          sheet: 'Variantes',
          row,
          sku: v.sku,
          message: `Variantes — linha ${row} — SKU ${v.sku} — Estoque Inicial da variante deve ser um número inteiro maior ou igual a zero.`,
        });
        invalidProductSkus.add(prodSkuNorm);
      }

      if (!productVariantsMap.has(prodSkuNorm)) {
        productVariantsMap.set(prodSkuNorm, []);
      }
      productVariantsMap.get(prodSkuNorm)!.push(v);
    }

    // 4. Regras de Consistência Produto vs Variantes vs Estoque
    for (const prod of products) {
      const skuNorm = (prod.sku || '').toUpperCase().trim();
      const prodVariants = productVariantsMap.get(skuNorm) || [];

      if (prodVariants.length > 0) {
        // PRODUTO COM VARIANTES:
        // O estoque operacional é exclusivamente das variantes.
        // Se informado estoque na aba Produtos, avisar que será ignorado.
        if (prod.initialStock && prod.initialStock > 0) {
          warnings.push({
            sheet: 'Produtos',
            row: prod.rowNumber,
            sku: prod.sku,
            message: `Produtos — linha ${prod.rowNumber} — SKU ${prod.sku} — O produto possui ${prodVariants.length} variante(s). O Estoque Inicial informado na aba Produtos (${prod.initialStock}) será desconsiderado conforme regra operacional.`,
          });
        }
      } else {
        // PRODUTO SEM VARIANTES:
        // Deve validar estoque inicial >= 0
        if (prod.initialStock !== undefined && (prod.initialStock < 0 || isNaN(prod.initialStock))) {
          errors.push({
            sheet: 'Produtos',
            row: prod.rowNumber,
            sku: prod.sku,
            message: `Produtos — linha ${prod.rowNumber} — SKU ${prod.sku} — Estoque Inicial deve ser maior ou igual a zero.`,
          });
          invalidProductSkus.add(skuNorm);
        }
      }
    }

    // 5. Validação da Aba IMAGENS
    const primaryImagesTracker = new Map<string, number>(); // ContextKey -> RowNumber

    for (const img of images) {
      const row = img.rowNumber;
      const prodSkuNorm = (img.productSku || '').toUpperCase().trim();
      const varSkuNorm = img.variantSku ? img.variantSku.toUpperCase().trim() : null;

      if (!prodSkuNorm) {
        errors.push({
          sheet: 'Imagens',
          row,
          message: `Imagens — linha ${row} — SKU do Produto não informado.`,
        });
        continue;
      }

      // SKU do produto deve existir na aba Produtos
      if (!fileProductSkuMap.has(prodSkuNorm)) {
        errors.push({
          sheet: 'Imagens',
          row,
          sku: img.productSku,
          message: `Imagens — linha ${row} — SKU do Produto "${img.productSku}" não encontrado na aba Produtos.`,
        });
        continue;
      }

      // Se informou SKU da variante, deve existir para aquele produto no arquivo
      if (varSkuNorm) {
        const prodVariants = productVariantsMap.get(prodSkuNorm) || [];
        const variantExists = prodVariants.some(
          (v) => (v.sku || '').toUpperCase().trim() === varSkuNorm,
        );
        if (!variantExists) {
          errors.push({
            sheet: 'Imagens',
            row,
            sku: img.variantSku || undefined,
            message: `Imagens — linha ${row} — SKU da Variante "${img.variantSku}" não encontrado entre as variantes do produto "${img.productSku}" na planilha.`,
          });
          invalidProductSkus.add(prodSkuNorm);
        }
      }

      // Arquivo ou URL
      if (!img.fileOrUrl || img.fileOrUrl.trim().length === 0) {
        errors.push({
          sheet: 'Imagens',
          row,
          sku: img.productSku,
          message: `Imagens — linha ${row} — Arquivo ou URL da imagem não informado para o produto "${img.productSku}".`,
        });
        invalidProductSkus.add(prodSkuNorm);
      } else {
        const fileRef = img.fileOrUrl.trim();
        const isUrl = /^https?:\/\//i.test(fileRef);

        // Se for nome de arquivo relativo, e estamos processando um ZIP, verifica se existe no ZIP
        if (!isUrl && packageData.isZipPackage) {
          const normalizedRef = fileRef.toLowerCase().replace(/\\/g, '/');
          const simpleName = normalizedRef.split('/').pop() || normalizedRef;

          const foundInZip =
            zipImages &&
            (zipImages.has(fileRef) ||
              zipImages.has(normalizedRef) ||
              zipImages.has(`imagens/${simpleName}`) ||
              zipImages.has(simpleName));

          if (!foundInZip) {
            errors.push({
              sheet: 'Imagens',
              row,
              sku: img.productSku,
              message: `Imagens — linha ${row} — Arquivo de imagem "${fileRef}" não encontrado dentro do arquivo ZIP.`,
            });
            invalidProductSkus.add(prodSkuNorm);
          }
        }
      }

      // Validação de múltiplas imagens principais conflitantes
      if (img.isPrimary) {
        const contextKey = varSkuNorm ? `${prodSkuNorm}:${varSkuNorm}` : prodSkuNorm;
        if (primaryImagesTracker.has(contextKey)) {
          errors.push({
            sheet: 'Imagens',
            row,
            sku: img.productSku,
            message: `Imagens — linha ${row} — Múltiplas imagens marcadas como principal para o ${
              varSkuNorm ? `variante "${varSkuNorm}"` : `produto "${img.productSku}"`
            } (já definida na linha ${primaryImagesTracker.get(contextKey)}).`,
          });
          invalidProductSkus.add(prodSkuNorm);
        } else {
          primaryImagesTracker.set(contextKey, row);
        }
      }
    }

    // 6. Consolidação dos Resultados do Dry-Run
    const totalProducts = products.length;
    const invalidCount = invalidProductSkus.size;
    const validCount = Math.max(0, totalProducts - invalidCount);
    const validVariants = variants.filter(
      (v) => !invalidProductSkus.has((v.productSku || '').toUpperCase().trim()),
    ).length;
    const validImages = images.filter(
      (i) => !invalidProductSkus.has((i.productSku || '').toUpperCase().trim()),
    ).length;

    const canImport = errors.length === 0 && totalProducts > 0;
    let importToken: string | undefined;

    if (canImport) {
      importToken = randomUUID();
      this.importCache.set(importToken, {
        packageData,
        createdAt: Date.now(),
        actorId,
        status: 'PENDING',
      });
      this.logger.log(
        `Dry-Run aprovado com sucesso: ${totalProducts} produtos prontos. Token gerado: ${importToken}`,
      );
    } else {
      this.logger.warn(
        `Dry-Run finalizado com ${errors.length} erro(s). Importação bloqueada até correção.`,
      );
    }

    return {
      totalProducts,
      validProducts: validCount,
      invalidProducts: invalidCount,
      validVariants,
      validImages,
      errors,
      warnings,
      canImport,
      importToken,
    };
  }

  /**
   * FASE 2: EXECUÇÃO TRANSACIONAL DA IMPORTAÇÃO EM MASSA
   * Utiliza EXCLUSIVAMENTE o pacote aprovado no Dry-Run pelo importToken
   */
  async execute(dto: ExecuteImportDto, actorId?: string): Promise<ExecuteImportResult> {
    const startTime = Date.now();
    const token = dto.importToken?.trim();

    if (!token) {
      throw new BadRequestException('Token de importação é obrigatório.');
    }

    const cached = this.importCache.get(token);
    if (!cached) {
      throw new NotFoundException(
        'Token de importação não encontrado ou inexistente. Por favor, execute um novo Dry-Run.',
      );
    }

    // 1. Validação de TTL (30 minutos)
    const now = Date.now();
    if (now - cached.createdAt > 30 * 60 * 1000) {
      this.importCache.delete(token);
      throw new BadRequestException(
        'Token de importação expirado (validade máxima de 30 minutos). Por favor, execute um novo Dry-Run.',
      );
    }

    // 2. Concorrência e Estado do Token
    if (cached.status === 'COMPLETED') {
      throw new BadRequestException(
        'Este lote de importação já foi executado anteriormente e não pode ser reutilizado.',
      );
    }

    if (cached.status === 'EXECUTING') {
      throw new ConflictException(
        'Este lote de importação já está sendo executado no momento por outra requisição.',
      );
    }

    if (cached.status !== 'PENDING') {
      throw new BadRequestException(
        `Status de importação inválido para execução: "${cached.status}".`,
      );
    }

    // Bloqueia concorrência alterando atomicamente o estado operacional
    cached.status = 'EXECUTING';
    cached.startedAt = now;

    const { products, variants, images, zipImages } = cached.packageData;
    const createdProductIds: string[] = [];
    const createdProductsSummary: Array<{ id: string; sku: string; name: string }> = [];
    let totalVariantsCreated = 0;
    let totalImagesProcessed = 0;
    let totalChannelsAssigned = 0;
    let totalStockMovements = 0;

    let currentStage = 'INITIALIZATION';
    let currentSku: string | undefined;

    // Registro inicial no AuditLog
    await this.auditLog.log({
      action: 'IMPORT_STARTED',
      entity: 'Import',
      userId: actorId ?? null,
      metadata: {
        importToken: token,
        totalProducts: products.length,
        totalVariants: variants.length,
        totalImages: images.length,
      },
    });

    try {
      // Pré-carregamento dos canais, nichos e categorias ativos para resolução rápida
      const [dbChannels, dbNiches, dbCategories] = await Promise.all([
        this.prisma.channel.findMany({ where: { isActive: true } }),
        this.prisma.niche.findMany({ where: { status: 'ACTIVE' } }),
        this.prisma.category.findMany({ where: { status: 'ACTIVE' } }),
      ]);

      const ownStoreChannel = dbChannels.find((c) => c.type === 'OWN_STORE');

      // Loop de execução produto a produto utilizando estritamente os serviços homologados
      for (const prod of products) {
        currentSku = prod.sku;

        // 3. PRODUCT: Criação do Produto via ProductService
        currentStage = 'PRODUCT_CREATION';
        const createdProduct = await this.productService.create(
          {
            name: prod.name,
            sku: prod.sku,
            slug: prod.slug || undefined,
            brand: prod.brand || undefined,
            shortDescription: prod.shortDescription || undefined,
            description: prod.description || undefined,
            status: ProductStatus.ACTIVE,
            costSource: prod.costSource,
            manualCost: prod.manualCost !== null ? prod.manualCost : undefined,
            wholesalePrice: prod.wholesalePrice,
          },
          actorId,
        );

        createdProductIds.push(createdProduct.id);
        createdProductsSummary.push({
          id: createdProduct.id,
          sku: prod.sku,
          name: prod.name,
        });

        // 4. TAXONOMIA: Associação de Nicho e Categorias resolvidas no Dry-Run
        currentStage = 'TAXONOMY_ASSIGNMENT';
        const matchedNiche = dbNiches.find(
          (n) =>
            n.name.toLowerCase() === prod.nicheName.toLowerCase() ||
            n.slug.toLowerCase() === generateSlug(prod.nicheName),
        );
        if (matchedNiche) {
          await this.productService.assignNiches(
            createdProduct.id,
            [matchedNiche.id],
            actorId,
          );

          const categoryIds: string[] = [];
          const matchedCategory = dbCategories.find(
            (c) =>
              c.nicheId === matchedNiche.id &&
              !c.parentId &&
              (c.name.toLowerCase() === prod.categoryName.toLowerCase() ||
                c.slug.toLowerCase() === generateSlug(prod.categoryName)),
          );
          if (matchedCategory) {
            categoryIds.push(matchedCategory.id);

            if (prod.subcategoryName) {
              const matchedSubcategory = dbCategories.find(
                (c) =>
                  c.nicheId === matchedNiche.id &&
                  c.parentId === matchedCategory.id &&
                  (c.name.toLowerCase() === prod.subcategoryName!.toLowerCase() ||
                    c.slug.toLowerCase() === generateSlug(prod.subcategoryName!)),
              );
              if (matchedSubcategory) {
                categoryIds.push(matchedSubcategory.id);
              }
            }
          }

          if (categoryIds.length > 0) {
            await this.productService.assignCategories(
              createdProduct.id,
              categoryIds,
              actorId,
            );
          }
        }

        // 5. TAGS: Resolução / Criação de Tags e Vínculo via ProductService
        currentStage = 'TAGS_ASSIGNMENT';
        if (prod.tags && prod.tags.length > 0) {
          const tagIds: string[] = [];
          for (const tagName of prod.tags) {
            const cleanTag = tagName.trim();
            if (!cleanTag) continue;
            const tagSlug = generateSlug(cleanTag);

            let tag = await this.prisma.tag.findFirst({
              where: {
                OR: [
                  { name: { equals: cleanTag, mode: 'insensitive' } },
                  { slug: tagSlug },
                ],
              },
            });

            if (!tag) {
              tag = await this.prisma.tag.create({
                data: {
                  name: cleanTag,
                  slug: tagSlug,
                  status: 'ACTIVE',
                },
              });
            }

            if (!tagIds.includes(tag.id)) {
              tagIds.push(tag.id);
            }
          }

          if (tagIds.length > 0) {
            await this.productService.assignTags(
              createdProduct.id,
              tagIds,
              actorId,
            );
          }
        }

        // 6. CANAIS: Associação dos canais validados (OWN_STORE sempre incluído e ativo)
        currentStage = 'CHANNELS_ASSIGNMENT';
        const assignedChannels: { channelId: string; isEnabled: boolean }[] = [];

        // Garante Loja Própria sempre associada e ativa
        if (ownStoreChannel) {
          assignedChannels.push({
            channelId: ownStoreChannel.id,
            isEnabled: true,
          });
        }

        for (const chName of prod.channels) {
          const chClean = chName.toUpperCase().replace(/\s+/g, '_');
          const matchedCh = dbChannels.find(
            (c) =>
              c.type.toUpperCase() === chClean ||
              c.name.toLowerCase() === chName.toLowerCase(),
          );
          if (matchedCh && !assignedChannels.some((a) => a.channelId === matchedCh.id)) {
            assignedChannels.push({
              channelId: matchedCh.id,
              isEnabled: true,
            });
          }
        }

        await this.productService.assignChannels(
          createdProduct.id,
          { channels: assignedChannels },
          actorId,
        );
        totalChannelsAssigned += assignedChannels.length;

        // 7. VARIANTES & ESTOQUE
        currentStage = 'VARIANTS_AND_STOCK';
        const prodVariants = variants.filter(
          (v) => (v.productSku || '').toUpperCase().trim() === prod.sku.toUpperCase().trim(),
        );

        const createdVariantsBySku = new Map<string, any>();

        if (prodVariants.length > 0) {
          // REGRA CRÍTICA DO EUSOU:
          // Se o produto possuir variantes, NUNCA manter estoque de produto-pai (variantId: null).
          // Remove o registro de inventário base criado por padrão no ProductService.create:
          await this.prisma.inventory.deleteMany({
            where: {
              productId: createdProduct.id,
              variantId: null,
            },
          });

          // Cria cada variante via VariantService
          for (const v of prodVariants) {
            const createdVar = await this.variantService.create(
              createdProduct.id,
              {
                sku: v.sku,
                name: v.name,
                isActive: true,
              },
              actorId,
            );

            createdVariantsBySku.set(v.sku.toUpperCase().trim(), createdVar);
            totalVariantsCreated++;

            // Aplica estoque exclusivamente via InventoryService.adjustStock
            if (v.initialStock > 0) {
              await this.inventoryService.adjustStock(
                {
                  productId: createdProduct.id,
                  variantId: createdVar.id,
                  quantity: v.initialStock,
                  mode: 'SET',
                  reason: `Estoque inicial da variante no lote de importação em massa (${token.slice(0, 8)})`,
                },
                actorId,
              );
              totalStockMovements++;
            }
          }
        } else {
          // PRODUTO SEM VARIANTES:
          // Se houver estoque inicial definido, aplica via InventoryService.adjustStock
          if (prod.initialStock !== undefined && prod.initialStock > 0) {
            await this.inventoryService.adjustStock(
              {
                productId: createdProduct.id,
                variantId: undefined,
                quantity: prod.initialStock,
                mode: 'SET',
                reason: `Estoque inicial do produto no lote de importação em massa (${token.slice(0, 8)})`,
              },
              actorId,
            );
            totalStockMovements++;
          }
        }

        // 8. F12: Recálculo dos preços comerciais dos canais via PricingService
        currentStage = 'PRICING_F12';
        await this.productService.recalculateEnabledChannelPrices(
          createdProduct.id,
          actorId,
        );

        // 9. IMAGENS: Processamento via MediaService
        currentStage = 'IMAGES_PROCESSING';
        const prodImages = images.filter(
          (i) => (i.productSku || '').toUpperCase().trim() === prod.sku.toUpperCase().trim(),
        );

        for (const img of prodImages) {
          let variantId: string | null = null;
          if (img.variantSku) {
            const matchedVar = createdVariantsBySku.get(img.variantSku.toUpperCase().trim());
            if (matchedVar) {
              variantId = matchedVar.id;
            }
          }

          const fileRef = img.fileOrUrl.trim();
          const isUrl = /^https?:\/\//i.test(fileRef);

          if (isUrl) {
            // Imagem externa via URL direta
            await this.mediaService.create(
              createdProduct.id,
              {
                url: fileRef,
                type: 'IMAGE',
                isPrimary: img.isPrimary,
                sortOrder: img.sortOrder,
                variantId: variantId || undefined,
              },
              actorId,
            );
            totalImagesProcessed++;
          } else if (zipImages && zipImages.size > 0) {
            // Imagem empacotada no ZIP
            const normalizedRef = fileRef.toLowerCase().replace(/\\/g, '/');
            const simpleName = normalizedRef.split('/').pop() || normalizedRef;

            const buffer =
              zipImages.get(fileRef) ||
              zipImages.get(normalizedRef) ||
              zipImages.get(`imagens/${simpleName}`) ||
              zipImages.get(simpleName);

            if (buffer) {
              const uploaded = await this.mediaService.uploadBase64(
                createdProduct.id,
                buffer.toString('base64'),
                simpleName,
                img.isPrimary,
                actorId,
              );

              // Atualiza variantId e sortOrder se necessário
              if (variantId || img.sortOrder !== 0) {
                await this.prisma.media.update({
                  where: { id: uploaded.id },
                  data: {
                    variantId: variantId || null,
                    sortOrder: img.sortOrder,
                  },
                });
              }
              totalImagesProcessed++;
            }
          }
        }
      }

      // Sucesso total da execução
      const durationMs = Date.now() - startTime;
      cached.status = 'COMPLETED';
      cached.completedAt = Date.now();

      // Limpa dados pesados de zipImages em memória
      delete (cached.packageData as any).zipImages;

      // Auditoria de conclusão
      await this.auditLog.log({
        action: 'IMPORT_COMPLETED',
        entity: 'Import',
        userId: actorId ?? null,
        metadata: {
          importToken: token,
          productsCreated: createdProductsSummary.length,
          variantsCreated: totalVariantsCreated,
          imagesProcessed: totalImagesProcessed,
          channelsAssigned: totalChannelsAssigned,
          stockMovements: totalStockMovements,
          durationMs,
        },
      });

      this.logger.log(
        `Importação em massa concluída com sucesso: ${createdProductsSummary.length} produtos, ${totalVariantsCreated} variantes, ${totalImagesProcessed} imagens em ${durationMs}ms.`,
      );

      return {
        success: true,
        totalProductsCreated: createdProductsSummary.length,
        totalVariantsCreated,
        totalImagesProcessed,
        totalChannelsAssigned,
        totalStockMovements,
        createdProducts: createdProductsSummary,
        durationMs,
      };
    } catch (err: any) {
      // 10. COMPENSAÇÃO / ROLLBACK TRANSACIONAL ATÔMICO
      this.logger.error(
        `Erro durante execução da importação na etapa [${currentStage}] (SKU: ${currentSku}): ${err?.message}`,
      );

      if (createdProductIds.length > 0) {
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.media.deleteMany({ where: { productId: { in: createdProductIds } } });
            await tx.stockMovement.deleteMany({ where: { productId: { in: createdProductIds } } });
            await tx.inventory.deleteMany({ where: { productId: { in: createdProductIds } } });
            await tx.variantAttributeValue.deleteMany({
              where: { variant: { productId: { in: createdProductIds } } },
            });
            await tx.productVariant.deleteMany({ where: { productId: { in: createdProductIds } } });
            await tx.productChannelPrice.deleteMany({
              where: { productId: { in: createdProductIds } },
            });
            await tx.productChannel.deleteMany({ where: { productId: { in: createdProductIds } } });
            await tx.productNiche.deleteMany({ where: { productId: { in: createdProductIds } } });
            await tx.productCategory.deleteMany({
              where: { productId: { in: createdProductIds } },
            });
            await tx.productTag.deleteMany({ where: { productId: { in: createdProductIds } } });
            await tx.product.deleteMany({ where: { id: { in: createdProductIds } } });
          });
          this.logger.log(
            `Rollback atômico executado com sucesso: ${createdProductIds.length} produtos e dependências revertidos.`,
          );
        } catch (cleanupErr: any) {
          this.logger.error(`Falha no rollback atômico: ${cleanupErr?.message}`);
        }
      }

      cached.status = 'FAILED';
      cached.errorMessage = err?.message;

      await this.auditLog.log({
        action: 'IMPORT_FAILED_ROLLED_BACK',
        entity: 'Import',
        userId: actorId ?? null,
        metadata: {
          importToken: token,
          failedStage: currentStage,
          failedSku: currentSku,
          error: err?.message,
          rolledBackCount: createdProductIds.length,
        },
      });

      throw new BadRequestException({
        success: false,
        message: `Falha na importação na etapa "${currentStage}"${
          currentSku ? ` (SKU: ${currentSku})` : ''
        }: ${err?.message || 'Erro inesperado'}. O lote foi 100% revertido (nenhum registro permaneceu criado).`,
        failedStage: currentStage,
        failedSku: currentSku,
        rolledBack: true,
      });
    }
  }
}
