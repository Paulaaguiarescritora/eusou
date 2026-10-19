const fs = require('fs');
const path = require('path');

// Gera arquivo CSV compatível com Excel (com delimitador ';' e BOM UTF-8 para abrir com acentuação perfeita no Excel do Windows)
const headers = [
  'SKU',
  'Nome do Produto',
  'Nicho',
  'Categoria',
  'Descricao',
  'Variante / Opcao / Cor',
  'Preco (R$)',
  'Estoque Inicial',
  'URL da Imagem'
];

const sampleRows = [
  [
    'FEL-GAT-001-PRE',
    'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
    'Gatos',
    'Decoração',
    'Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.',
    'Preto',
    '39.90',
    '10',
    'https://images.unsplash.com/photo-1543852786-1cf6624b9987'
  ],
  [
    'FEL-GAT-001-BRA',
    'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
    'Gatos',
    'Decoração',
    'Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.',
    'Branco',
    '39.90',
    '10',
    'https://images.unsplash.com/photo-1543852786-1cf6624b9987'
  ],
  [
    'FEL-GAT-001-VER',
    'Porta Chaves Gatinho Felinodelia De Parede Minimalista',
    'Gatos',
    'Decoração',
    'Porta chaves decorativo em formato de gatinho felino com acabamento premium e ganchos reforçados.',
    'Vermelho',
    '39.90',
    '8',
    'https://images.unsplash.com/photo-1543852786-1cf6624b9987'
  ],
  [
    'PET-MED-002-AZU',
    'Medalha de Identificação Pet Personalizada com Nome',
    'Cães e Gatos',
    'Acessórios',
    'Medalha coleira leve, resistente e gravada a laser com dados do seu pet.',
    'Azul',
    '24.90',
    '25',
    ''
  ],
  [
    'PET-MED-002-ROS',
    'Medalha de Identificação Pet Personalizada com Nome',
    'Cães e Gatos',
    'Acessórios',
    'Medalha coleira leve, resistente e gravada a laser com dados do seu pet.',
    'Rosa',
    '24.90',
    '25',
    ''
  ]
];

// UTF-8 BOM (\uFEFF) para o Excel abrir com acentuação correta
const bom = '\uFEFF';
const csvContent = bom + [
  headers.join(';'),
  ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
].join('\r\n');

const outputPath = path.resolve(__dirname, '../modelo_produtos_eusou.csv');
fs.writeFileSync(outputPath, csvContent, 'utf8');

console.log('Planilha modelo gerada com sucesso em:', outputPath);
