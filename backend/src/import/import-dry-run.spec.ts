import { Test, TestingModule } from '@nestjs/testing';
import { ImportService } from './import.service';
import { ImportParserService } from './import-parser.service';
import { PrismaService } from '../prisma.service';
import { ProductService } from '../product/product.service';
import { VariantService } from '../variant/variant.service';
import { InventoryService } from '../inventory/inventory.service';
import { MediaService } from '../media/media.service';
import { AuditLogService } from '../audit-log.service';
import * as XLSX from 'xlsx';
const AdmZip = require('adm-zip');

describe('FASE 1 — Importador em Massa: Parser, Validações e Dry-Run', () => {
  let importService: ImportService;
  let importParser: ImportParserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prod-existing-1',
            sku: 'FEL-GAT-001',
            slug: 'porta-chaves-gatinho',
            name: 'Porta Chaves Gatinho',
          },
        ]),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'var-existing-1',
            sku: 'FEL-GAT-001-AZU',
            productId: 'prod-existing-1',
          },
        ]),
      },
      niche: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'niche-pet',
            name: 'Pet Shop',
            slug: 'pet-shop',
          },
        ]),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cat-gatos',
            name: 'Gatos',
            slug: 'gatos',
            parentId: null,
            nicheId: 'niche-pet',
          },
          {
            id: 'subcat-brinquedos',
            name: 'Brinquedos',
            slug: 'brinquedos',
            parentId: 'cat-gatos',
            nicheId: 'niche-pet',
          },
        ]),
      },
      channel: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ch-own', name: 'Loja Própria', type: 'OWN_STORE' },
          { id: 'ch-ml', name: 'Mercado Livre Oficial', type: 'MERCADO_LIVRE' },
          { id: 'ch-shopee', name: 'Shopee', type: 'SHOPEE' },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        ImportParserService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductService, useValue: {} },
        { provide: VariantService, useValue: {} },
        { provide: InventoryService, useValue: {} },
        { provide: MediaService, useValue: {} },
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(true) } },
      ],
    }).compile();

    importService = module.get<ImportService>(ImportService);
    importParser = module.get<ImportParserService>(ImportParserService);
  });

  // Helper para criar buffer de XLSX em memória
  function createExcelBuffer(
    productsRows: any[][],
    variantsRows?: any[][],
    imagesRows?: any[][],
  ): Buffer {
    const wb = XLSX.utils.book_new();

    const wsProd = XLSX.utils.aoa_to_sheet(productsRows);
    XLSX.utils.book_append_sheet(wb, wsProd, 'Produtos');

    if (variantsRows) {
      const wsVar = XLSX.utils.aoa_to_sheet(variantsRows);
      XLSX.utils.book_append_sheet(wb, wsVar, 'Variantes');
    }

    if (imagesRows) {
      const wsImg = XLSX.utils.aoa_to_sheet(imagesRows);
      XLSX.utils.book_append_sheet(wb, wsImg, 'Imagens');
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 1. Planilha vazia ou sem aba Produtos
  it('1. deve acusar erro se a aba obrigatória Produtos não existir ou estiver vazia', async () => {
    const wb = XLSX.utils.book_new();
    const wsEmpty = XLSX.utils.aoa_to_sheet([['Apenas', 'Outra', 'Aba']]);
    XLSX.utils.book_append_sheet(wb, wsEmpty, 'OutraAba');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain('Aba obrigatória "Produtos" não foi encontrada');
  });

  // 2. Preço de Atacado obrigatório e > 0
  it('2. deve acusar erro se Preço de Atacado estiver vazio, inválido ou <= 0', async () => {
    const buffer = createExcelBuffer([
      [
        'SKU',
        'Nome do Produto',
        'Nicho',
        'Categoria',
        'Subcategoria',
        'Marca',
        'Slug',
        'Tags',
        'Descrição Curta',
        'Descrição Completa',
        'Fonte do Custo',
        'Custo de Produção',
        'Preço de Atacado',
        'Estoque Inicial',
        'Canais Comerciais',
      ],
      [
        'FEL-NOVO-01',
        'Arranhador Torre',
        'Pet Shop',
        'Gatos',
        'Brinquedos',
        'Felinodelia',
        'arranhador-torre',
        'gatos',
        'Curta',
        'Completa',
        'MANUAL',
        '10,00',
        '0,00', // Inválido!
        '5',
        'OWN_STORE',
      ],
    ]);

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(false);
    const atacadoError = result.errors.find((e) =>
      e.message.includes('Preço de Atacado é obrigatório e deve ser maior que zero'),
    );
    expect(atacadoError).toBeDefined();
    expect(atacadoError?.row).toBe(2);
    expect(atacadoError?.sku).toBe('FEL-NOVO-01');
  });

  // 3. Custo de produção quando Fonte do Custo = MANUAL
  it('3. deve acusar erro se Fonte do Custo for MANUAL e Custo de Produção for inválido ou zero', async () => {
    const buffer = createExcelBuffer([
      [
        'SKU',
        'Nome do Produto',
        'Nicho',
        'Categoria',
        'Subcategoria',
        'Marca',
        'Slug',
        'Tags',
        'Descrição Curta',
        'Descrição Completa',
        'Fonte do Custo',
        'Custo de Produção',
        'Preço de Atacado',
        'Estoque Inicial',
        'Canais Comerciais',
      ],
      [
        'FEL-NOVO-02',
        'Arranhador Torre',
        'Pet Shop',
        'Gatos',
        'Brinquedos',
        'Felinodelia',
        'arranhador-torre',
        'gatos',
        'Curta',
        'Completa',
        'MANUAL',
        '', // Vazio com MANUAL!
        '25,00',
        '5',
        'OWN_STORE',
      ],
    ]);

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(false);
    const costError = result.errors.find((e) =>
      e.message.includes('Custo de Produção é obrigatório e deve ser maior que zero'),
    );
    expect(costError).toBeDefined();
  });

  // 4. Hierarquia Taxonômica: Nicho inexistente
  it('4. deve acusar erro se o Nicho não existir no sistema (não cria automaticamente)', async () => {
    const buffer = createExcelBuffer([
      [
        'SKU',
        'Nome do Produto',
        'Nicho',
        'Categoria',
        'Subcategoria',
        'Marca',
        'Slug',
        'Tags',
        'Descrição Curta',
        'Descrição Completa',
        'Fonte do Custo',
        'Custo de Produção',
        'Preço de Atacado',
        'Estoque Inicial',
        'Canais Comerciais',
      ],
      [
        'FEL-NOVO-03',
        'Vaso Autoirrigável',
        'Jardinagem Inexistente', // Nicho inexistente!
        'Vasos',
        '',
        'Felinodelia',
        'vaso-autoirrigavel',
        'plantas',
        'Curta',
        'Completa',
        'COST_FROM_F7',
        '',
        '30,00',
        '2',
        'OWN_STORE',
      ],
    ]);

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(false);
    const nicheError = result.errors.find((e) =>
      e.message.includes('Nicho "Jardinagem Inexistente" não encontrado no sistema'),
    );
    expect(nicheError).toBeDefined();
  });

  // 5. Hierarquia Taxonômica: Categoria incompatível com o Nicho
  it('5. deve acusar erro se Categoria não pertencer ao Nicho selecionado', async () => {
    const buffer = createExcelBuffer([
      [
        'SKU',
        'Nome do Produto',
        'Nicho',
        'Categoria',
        'Subcategoria',
        'Marca',
        'Slug',
        'Tags',
        'Descrição Curta',
        'Descrição Completa',
        'Fonte do Custo',
        'Custo de Produção',
        'Preço de Atacado',
        'Estoque Inicial',
        'Canais Comerciais',
      ],
      [
        'FEL-NOVO-04',
        'Coleira Cachorro',
        'Pet Shop',
        'Cachorros', // Não cadastrada em Pet Shop no banco!
        '',
        'Felinodelia',
        'coleira-cachorro',
        'pet',
        'Curta',
        'Completa',
        'COST_FROM_F7',
        '',
        '15,00',
        '10',
        'OWN_STORE',
      ],
    ]);

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(false);
    const catError = result.errors.find((e) =>
      e.message.includes('Categoria "Cachorros" não encontrada no Nicho "Pet Shop"'),
    );
    expect(catError).toBeDefined();
  });

  // 6. Conflito de SKU duplicado no próprio arquivo
  it('6. deve acusar erro se houver SKU de produto duplicado dentro do arquivo', async () => {
    const buffer = createExcelBuffer([
      [
        'SKU',
        'Nome do Produto',
        'Nicho',
        'Categoria',
        'Subcategoria',
        'Marca',
        'Slug',
        'Tags',
        'Descrição Curta',
        'Descrição Completa',
        'Fonte do Custo',
        'Custo de Produção',
        'Preço de Atacado',
        'Estoque Inicial',
        'Canais Comerciais',
      ],
      [
        'FEL-DUP-01',
        'Produto A',
        'Pet Shop',
        'Gatos',
        'Brinquedos',
        'Felinodelia',
        'produto-a',
        'pet',
        'Curta',
        'Completa',
        'COST_FROM_F7',
        '',
        '15,00',
        '1',
        'OWN_STORE',
      ],
      [
        'FEL-DUP-01', // Mesmo SKU na linha 3!
        'Produto B',
        'Pet Shop',
        'Gatos',
        'Brinquedos',
        'Felinodelia',
        'produto-b',
        'pet',
        'Curta',
        'Completa',
        'COST_FROM_F7',
        '',
        '20,00',
        '1',
        'OWN_STORE',
      ],
    ]);

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(false);
    const dupError = result.errors.find((e) =>
      e.message.includes('SKU "FEL-DUP-01" duplicado no arquivo'),
    );
    expect(dupError).toBeDefined();
    expect(dupError?.row).toBe(3);
  });

  // 7. Conflito de SKU já existente no banco
  it('7. deve acusar erro se o SKU já existir no banco de dados', async () => {
    const buffer = createExcelBuffer([
      [
        'SKU',
        'Nome do Produto',
        'Nicho',
        'Categoria',
        'Subcategoria',
        'Marca',
        'Slug',
        'Tags',
        'Descrição Curta',
        'Descrição Completa',
        'Fonte do Custo',
        'Custo de Produção',
        'Preço de Atacado',
        'Estoque Inicial',
        'Canais Comerciais',
      ],
      [
        'FEL-GAT-001', // SKU já existente no banco mockado!
        'Porta Chaves Repetido',
        'Pet Shop',
        'Gatos',
        'Brinquedos',
        'Felinodelia',
        'porta-chaves-repetido',
        'pet',
        'Curta',
        'Completa',
        'COST_FROM_F7',
        '',
        '15,00',
        '1',
        'OWN_STORE',
      ],
    ]);

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(false);
    const dbSkuError = result.errors.find((e) =>
      e.message.includes('SKU "FEL-GAT-001" já cadastrado no sistema'),
    );
    expect(dbSkuError).toBeDefined();
  });

  // 8. Validação de Variantes: SKU de produto inexistente na aba Produtos
  it('8. deve acusar erro se uma variante referenciar SKU de produto inexistente na aba Produtos', async () => {
    const buffer = createExcelBuffer(
      [
        [
          'SKU',
          'Nome do Produto',
          'Nicho',
          'Categoria',
          'Subcategoria',
          'Marca',
          'Slug',
          'Tags',
          'Descrição Curta',
          'Descrição Completa',
          'Fonte do Custo',
          'Custo de Produção',
          'Preço de Atacado',
          'Estoque Inicial',
          'Canais Comerciais',
        ],
        [
          'FEL-OK-01',
          'Ratinho com Pena',
          'Pet Shop',
          'Gatos',
          'Brinquedos',
          'Felinodelia',
          'ratinho-com-pena',
          'pet',
          'Curta',
          'Completa',
          'COST_FROM_F7',
          '',
          '12,00',
          '0',
          'OWN_STORE',
        ],
      ],
      [
        ['SKU do Produto', 'SKU da Variante', 'Nome da Variante', 'Valor da Variante', 'Estoque Inicial'],
        ['FEL-FANTASMA', 'FEL-FAN-01', 'Cinza', 'Cinza', 5], // FEL-FANTASMA não existe na aba Produtos!
      ],
    );

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(false);
    const varError = result.errors.find((e) =>
      e.message.includes('SKU do Produto "FEL-FANTASMA" não encontrado na aba Produtos'),
    );
    expect(varError).toBeDefined();
  });

  // 9. Regra de Estoque: Produto com variantes avisa que Estoque Inicial da aba Produtos será ignorado
  it('9. deve emitir aviso e ignorar Estoque Inicial da aba Produtos quando o produto possui variantes', async () => {
    const buffer = createExcelBuffer(
      [
        [
          'SKU',
          'Nome do Produto',
          'Nicho',
          'Categoria',
          'Subcategoria',
          'Marca',
          'Slug',
          'Tags',
          'Descrição Curta',
          'Descrição Completa',
          'Fonte do Custo',
          'Custo de Produção',
          'Preço de Atacado',
          'Estoque Inicial',
          'Canais Comerciais',
        ],
        [
          'FEL-VAR-PROD',
          'Comedouro Elevado',
          'Pet Shop',
          'Gatos',
          'Brinquedos',
          'Felinodelia',
          'comedouro-elevado',
          'gato',
          'Curta',
          'Completa',
          'MANUAL',
          '15,00',
          '35,00',
          '10', // Informou 10 no produto-pai!
          'OWN_STORE;MERCADO_LIVRE',
        ],
      ],
      [
        ['SKU do Produto', 'SKU da Variante', 'Nome da Variante', 'Valor da Variante', 'Estoque Inicial'],
        ['FEL-VAR-PROD', 'FEL-VAR-AZU', 'Azul', 'Azul', 4],
        ['FEL-VAR-PROD', 'FEL-VAR-ROS', 'Rosa', 'Rosa', 6],
      ],
    );

    const result = await importService.dryRun(buffer);

    expect(result.canImport).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].message).toContain('será desconsiderado conforme regra operacional');
    expect(result.validVariants).toBe(2);
  });

  // 10. Validação de Imagens dentro de arquivo ZIP
  it('10. deve acusar erro se imagem listada na aba Imagens não existir dentro do arquivo ZIP', async () => {
    const excelBuffer = createExcelBuffer(
      [
        [
          'SKU',
          'Nome do Produto',
          'Nicho',
          'Categoria',
          'Subcategoria',
          'Marca',
          'Slug',
          'Tags',
          'Descrição Curta',
          'Descrição Completa',
          'Fonte do Custo',
          'Custo de Produção',
          'Preço de Atacado',
          'Estoque Inicial',
          'Canais Comerciais',
        ],
        [
          'FEL-ZIP-01',
          'Toca Gatinho',
          'Pet Shop',
          'Gatos',
          'Brinquedos',
          'Felinodelia',
          'toca-gatinho',
          'gato',
          'Curta',
          'Completa',
          'COST_FROM_F7',
          '',
          '45,00',
          '3',
          'OWN_STORE',
        ],
      ],
      undefined,
      [
        ['SKU do Produto', 'Ordem', 'Arquivo ou URL', 'Imagem Principal'],
        ['FEL-ZIP-01', 1, 'imagens/foto-fantasma.jpg', 'SIM'], // Não vai existir no zip!
      ],
    );

    // Cria ZIP contendo apenas o Excel, sem a imagem foto-fantasma.jpg
    const zip = new AdmZip();
    zip.addFile('planilha.xlsx', excelBuffer);
    const zipBuffer = zip.toBuffer();

    const result = await importService.dryRun(zipBuffer, 'import.zip');

    expect(result.canImport).toBe(false);
    const imgError = result.errors.find((e) =>
      e.message.includes('Arquivo de imagem "imagens/foto-fantasma.jpg" não encontrado dentro do arquivo ZIP'),
    );
    expect(imgError).toBeDefined();
  });

  // 11. Validação de Imagens com Múltiplas Imagens Principais conflitantes
  it('11. deve acusar erro se houver mais de uma imagem marcada como Principal para o mesmo produto', async () => {
    const excelBuffer = createExcelBuffer(
      [
        [
          'SKU',
          'Nome do Produto',
          'Nicho',
          'Categoria',
          'Subcategoria',
          'Marca',
          'Slug',
          'Tags',
          'Descrição Curta',
          'Descrição Completa',
          'Fonte do Custo',
          'Custo de Produção',
          'Preço de Atacado',
          'Estoque Inicial',
          'Canais Comerciais',
        ],
        [
          'FEL-IMG-01',
          'Toca Dupla',
          'Pet Shop',
          'Gatos',
          'Brinquedos',
          'Felinodelia',
          'toca-dupla',
          'gato',
          'Curta',
          'Completa',
          'COST_FROM_F7',
          '',
          '45,00',
          '3',
          'OWN_STORE',
        ],
      ],
      undefined,
      [
        ['SKU do Produto', 'Ordem', 'Arquivo ou URL', 'Imagem Principal'],
        ['FEL-IMG-01', 1, 'https://exemplo.com/foto1.jpg', 'SIM'],
        ['FEL-IMG-01', 2, 'https://exemplo.com/foto2.jpg', 'SIM'], // Segunda foto como SIM para o mesmo produto!
      ],
    );

    const result = await importService.dryRun(excelBuffer);

    expect(result.canImport).toBe(false);
    const primaryError = result.errors.find((e) =>
      e.message.includes('Múltiplas imagens marcadas como principal'),
    );
    expect(primaryError).toBeDefined();
  });

  // 12. Dry-Run 100% Válido: gera importToken, habilita canImport e não toca no banco de dados
  it('12. Dry-Run 100% válido deve aprovar, gerar importToken e habilitar canImport sem gravar no banco', async () => {
    const excelBuffer = createExcelBuffer(
      [
        [
          'SKU',
          'Nome do Produto',
          'Nicho',
          'Categoria',
          'Subcategoria',
          'Marca',
          'Slug',
          'Tags',
          'Descrição Curta',
          'Descrição Completa',
          'Fonte do Custo',
          'Custo de Produção',
          'Preço de Atacado',
          'Estoque Inicial',
          'Canais Comerciais',
        ],
        [
          'FEL-VAL-01',
          'Brinquedo Válido',
          'Pet Shop',
          'Gatos',
          'Brinquedos',
          'Felinodelia',
          'brinquedo-valido',
          'gatos, brinquedos, pet',
          'Descrição Curta',
          'Descrição Completa',
          'MANUAL',
          '5,50',
          '15,00',
          '0',
          'OWN_STORE;MERCADO_LIVRE',
        ],
      ],
      [
        ['SKU do Produto', 'SKU da Variante', 'Nome da Variante', 'Valor da Variante', 'Estoque Inicial'],
        ['FEL-VAL-01', 'FEL-VAL-01-AZU', 'Azul', 'Azul', 5],
        ['FEL-VAL-01', 'FEL-VAL-01-ROS', 'Rosa', 'Rosa', 3],
      ],
      [
        ['SKU do Produto', 'Ordem', 'Arquivo ou URL', 'Imagem Principal'],
        ['FEL-VAL-01', 1, 'https://exemplo.com/foto-valida.jpg', 'SIM'],
      ],
    );

    const result = await importService.dryRun(excelBuffer, 'teste.xlsx', 'user-admin-1');

    expect(result.canImport).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.totalProducts).toBe(1);
    expect(result.validProducts).toBe(1);
    expect(result.validVariants).toBe(2);
    expect(result.validImages).toBe(1);
    expect(result.importToken).toBeDefined();
    expect(typeof result.importToken).toBe('string');

    // Confirma que o token foi registrado no cache em memória
    const cached = importService.getCachedImport(result.importToken!);
    expect(cached).toBeDefined();
    expect(cached?.packageData.products.length).toBe(1);
    expect(cached?.packageData.variants.length).toBe(2);
  });
});
