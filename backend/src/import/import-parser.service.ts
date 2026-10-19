import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
const AdmZip = require('adm-zip');
import {
  ParsedImportPackage,
  ParsedProductRow,
  ParsedVariantRow,
  ParsedImageRow,
  DryRunIssue,
} from './interfaces/import.interfaces';

@Injectable()
export class ImportParserService {
  /**
   * Normaliza chave de cabeçalho removendo acentos, pontuações e convertendo para minúsculas
   */
  private normalizeHeader(header: string): string {
    return (header || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Converte valores de moeda/número (ex: "R$ 3,50", "7,00", 7) para number
   */
  public parseNumeric(value: any): number | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') {
      return isNaN(value) ? null : value;
    }
    const str = value
      .toString()
      .replace('R$', '')
      .replace(/\s+/g, '')
      .replace(/\./g, '') // remove separador de milhar se houver
      .replace(',', '.'); // substitui vírgula por ponto
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  /**
   * Converte strings booleanas ("SIM", "NÃO", "NAO", "TRUE", true)
   */
  public parseBoolean(value: any): boolean {
    if (value === true || value === 1) return true;
    if (!value) return false;
    const str = value.toString().trim().toUpperCase();
    return str === 'SIM' || str === 'TRUE' || str === 'S' || str === '1';
  }

  /**
   * Extrai o pacote de dados do arquivo (ZIP ou XLSX)
   */
  public parseBuffer(
    buffer: Buffer,
    fileName?: string,
  ): {
    packageData: ParsedImportPackage;
    parseErrors: DryRunIssue[];
  } {
    const parseErrors: DryRunIssue[] = [];
    let excelBuffer: Buffer | null = null;
    const zipImages = new Map<string, Buffer>();

    const hasZipMagic =
      buffer.length > 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);

    let isContainerZip = false;

    if (hasZipMagic) {
      try {
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();

        // Todo arquivo .xlsx é um zip que possui internamente 'xl/' ou '[Content_Types].xml'
        const isPlainExcel = zipEntries.some(
          (e: any) =>
            e.entryName.startsWith('xl/') ||
            e.entryName === '[Content_Types].xml',
        );

        const isExplicitZip = fileName?.toLowerCase().endsWith('.zip');
        const hasEmbeddedXlsx = zipEntries.some((e: any) =>
          e.entryName.toLowerCase().endsWith('.xlsx'),
        );

        if (!isPlainExcel && (isExplicitZip || hasEmbeddedXlsx)) {
          isContainerZip = true;
          for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            const entryName = entry.entryName;

            if (entryName.toLowerCase().endsWith('.xlsx')) {
              if (!excelBuffer) {
                excelBuffer = entry.getData();
              }
            } else {
              const extMatch = entryName
                .toLowerCase()
                .match(/\.(jpe?g|png|webp|gif|bmp)$/);
              if (extMatch) {
                const fileData = entry.getData();
                zipImages.set(entryName, fileData);
                zipImages.set(entryName.toLowerCase(), fileData);
                const simpleName = entry.name.toLowerCase();
                if (simpleName && !zipImages.has(simpleName)) {
                  zipImages.set(simpleName, fileData);
                }
              }
            }
          }

          if (!excelBuffer) {
            parseErrors.push({
              sheet: 'Arquivo',
              row: 1,
              message:
                'Nenhuma planilha .xlsx foi encontrada dentro do arquivo .zip enviado.',
            });
            return {
              packageData: {
                products: [],
                variants: [],
                images: [],
                zipImages,
                fileName,
              },
              parseErrors,
            };
          }
        }
      } catch (err: any) {
        if (fileName?.toLowerCase().endsWith('.zip')) {
          parseErrors.push({
            sheet: 'Arquivo',
            row: 1,
            message: `Falha ao processar arquivo .zip: ${err?.message || 'Arquivo corrompido'}.`,
          });
          return {
            packageData: {
              products: [],
              variants: [],
              images: [],
              zipImages,
              fileName,
            },
            parseErrors,
          };
        }
      }
    }

    if (!isContainerZip) {
      excelBuffer = buffer;
    }

    // Leitura da Planilha via XLSX
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(excelBuffer, { type: 'buffer' });
    } catch (err: any) {
      parseErrors.push({
        sheet: 'Arquivo',
        row: 1,
        message: `Não foi possível ler a planilha Excel: ${err?.message || 'Formato inválido'}.`,
      });
      return {
        packageData: { products: [], variants: [], images: [], zipImages, fileName },
        parseErrors,
      };
    }

    // Validação da Aba Obrigatória "Produtos"
    const sheetNames = workbook.SheetNames || [];
    const prodSheetName = sheetNames.find(
      (s) => this.normalizeHeader(s) === 'produtos' || this.normalizeHeader(s) === 'produto',
    );

    if (!prodSheetName) {
      parseErrors.push({
        sheet: 'Arquivo',
        row: 1,
        message:
          'Aba obrigatória "Produtos" não foi encontrada na planilha. Verifique a estrutura do modelo oficial.',
      });
      return {
        packageData: { products: [], variants: [], images: [], zipImages, fileName },
        parseErrors,
      };
    }

    const products: ParsedProductRow[] = [];
    const variants: ParsedVariantRow[] = [];
    const images: ParsedImageRow[] = [];

    // 1. Processar Aba Produtos
    const prodSheet = workbook.Sheets[prodSheetName];
    const prodRows: any[][] = XLSX.utils.sheet_to_json(prodSheet, { header: 1 });
    if (prodRows.length < 2) {
      parseErrors.push({
        sheet: 'Produtos',
        row: 1,
        message: 'A aba "Produtos" está vazia ou não contém linhas de dados para importar.',
      });
    } else {
      const headerRow = prodRows[0] || [];
      const colMap = new Map<string, number>();
      headerRow.forEach((col: any, idx: number) => {
        if (col) colMap.set(this.normalizeHeader(col.toString()), idx);
      });

      for (let r = 1; r < prodRows.length; r++) {
        const row = prodRows[r];
        if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === null || c === '')) {
          continue; // Pula linhas em branco
        }

        const getVal = (colName: string) => {
          const idx = colMap.get(this.normalizeHeader(colName));
          return idx !== undefined && row[idx] !== undefined && row[idx] !== null
            ? row[idx].toString().trim()
            : '';
        };

        const getRaw = (colName: string) => {
          const idx = colMap.get(this.normalizeHeader(colName));
          return idx !== undefined ? row[idx] : undefined;
        };

        const sku = getVal('SKU');
        const name = getVal('Nome do Produto') || getVal('Nome');
        const nicheName = getVal('Nicho');
        const categoryName = getVal('Categoria');
        const subcategoryName = getVal('Subcategoria') || null;
        const brand = getVal('Marca') || null;
        const slug = getVal('Slug') || null;
        const rawTags = getVal('Tags');
        const shortDescription = getVal('Descricao Curta') || getVal('Descrição Curta') || null;
        const description = getVal('Descricao Completa') || getVal('Descrição Completa') || null;
        const rawCostSource = getVal('Fonte do Custo').toUpperCase();
        const costSource: 'MANUAL' | 'COST_FROM_F7' =
          rawCostSource === 'COST_FROM_F7' ? 'COST_FROM_F7' : 'MANUAL';
        const manualCost = this.parseNumeric(getRaw('Custo de Producao') ?? getRaw('Custo de Produção'));
        const wholesalePrice = this.parseNumeric(getRaw('Preco de Atacado') ?? getRaw('Preço de Atacado')) ?? 0;
        const initialStockRaw = this.parseNumeric(getRaw('Estoque Inicial'));
        const initialStock = initialStockRaw !== null ? Math.floor(initialStockRaw) : 0;
        const rawChannels = getVal('Canais Comerciais') || getVal('Canais');

        const tags = rawTags
          ? rawTags
              .split(',')
              .map((t: string) => t.trim())
              .filter((t: string) => t.length > 0)
          : [];

        const channels = rawChannels
          ? rawChannels
              .split(';')
              .map((c: string) => c.trim())
              .filter((c: string) => c.length > 0)
          : [];

        products.push({
          rowNumber: r + 1, // 1-indexed (linha do Excel)
          sku,
          name,
          nicheName,
          categoryName,
          subcategoryName: subcategoryName && subcategoryName !== '-' ? subcategoryName : null,
          brand,
          slug,
          tags,
          shortDescription,
          description,
          costSource,
          manualCost,
          wholesalePrice,
          initialStock,
          channels,
        });
      }
    }

    // 2. Processar Aba Variantes (se presente)
    const varSheetName = sheetNames.find(
      (s) => this.normalizeHeader(s) === 'variantes' || this.normalizeHeader(s) === 'variante',
    );
    if (varSheetName) {
      const varSheet = workbook.Sheets[varSheetName];
      const varRows: any[][] = XLSX.utils.sheet_to_json(varSheet, { header: 1 });
      if (varRows.length >= 2) {
        const headerRow = varRows[0] || [];
        const colMap = new Map<string, number>();
        headerRow.forEach((col: any, idx: number) => {
          if (col) colMap.set(this.normalizeHeader(col.toString()), idx);
        });

        for (let r = 1; r < varRows.length; r++) {
          const row = varRows[r];
          if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === null || c === '')) {
            continue;
          }

          const getVal = (colName: string) => {
            const idx = colMap.get(this.normalizeHeader(colName));
            return idx !== undefined && row[idx] !== undefined && row[idx] !== null
              ? row[idx].toString().trim()
              : '';
          };

          const getRaw = (colName: string) => {
            const idx = colMap.get(this.normalizeHeader(colName));
            return idx !== undefined ? row[idx] : undefined;
          };

          const productSku = getVal('SKU do Produto');
          const sku = getVal('SKU da Variante') || getVal('SKU Variante');
          const name = getVal('Nome da Variante') || getVal('Variante');
          const stockRaw = this.parseNumeric(getRaw('Estoque Inicial'));
          const initialStock = stockRaw !== null ? Math.floor(stockRaw) : 0;

          variants.push({
            rowNumber: r + 1,
            productSku,
            sku,
            name,
            initialStock,
          });
        }
      }
    }

    // 3. Processar Aba Imagens (se presente)
    const imgSheetName = sheetNames.find(
      (s) => this.normalizeHeader(s) === 'imagens' || this.normalizeHeader(s) === 'imagem',
    );
    if (imgSheetName) {
      const imgSheet = workbook.Sheets[imgSheetName];
      const imgRows: any[][] = XLSX.utils.sheet_to_json(imgSheet, { header: 1 });
      if (imgRows.length >= 2) {
        const headerRow = imgRows[0] || [];
        const colMap = new Map<string, number>();
        headerRow.forEach((col: any, idx: number) => {
          if (col) colMap.set(this.normalizeHeader(col.toString()), idx);
        });

        for (let r = 1; r < imgRows.length; r++) {
          const row = imgRows[r];
          if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === null || c === '')) {
            continue;
          }

          const getVal = (colName: string) => {
            const idx = colMap.get(this.normalizeHeader(colName));
            return idx !== undefined && row[idx] !== undefined && row[idx] !== null
              ? row[idx].toString().trim()
              : '';
          };

          const getRaw = (colName: string) => {
            const idx = colMap.get(this.normalizeHeader(colName));
            return idx !== undefined ? row[idx] : undefined;
          };

          const productSku = getVal('SKU do Produto');
          const variantSku = getVal('SKU da Variante') || getVal('SKU Variante') || null;
          const orderRaw = this.parseNumeric(getRaw('Ordem'));
          const sortOrder = orderRaw !== null ? Math.floor(orderRaw) : 0;
          const fileOrUrl =
            getVal('Arquivo ou URL') || getVal('Arquivo') || getVal('URL') || getVal('Imagem');
          const isPrimary = this.parseBoolean(getRaw('Imagem Principal') ?? getRaw('Principal'));

          images.push({
            rowNumber: r + 1,
            productSku,
            variantSku: variantSku || null,
            sortOrder,
            fileOrUrl,
            isPrimary,
          });
        }
      }
    }

    return {
      packageData: {
        products,
        variants,
        images,
        zipImages,
        isZipPackage: isContainerZip,
        fileName,
      },
      parseErrors,
    };
  }
}
