const path = require('path');
const XLSX = require('../backend/node_modules/xlsx');

// 1. Dados da aba principal de Cadastro
const rows = [
  {
    'Nome do Produto': 'Vela de Massagem Beijável Morango',
    'Categoria': 'Velas & Óleos',
    'Variante / Sabor / Cor': 'Morango',
    'Preço de Venda (R$)': 39.90,
    'Custo (R$)': 15.00,
    'Estoque': 10,
    'Descrição Curta': 'Vela aromática hidratante beijável sabor morango com chantilly.',
    'Descrição Completa': 'Modo de usar: Acenda o pavio por 5 minutos até formar uma leve camada líquida morna. Derrame sobre a pele massageando suavemente.',
    'Nome da Foto ou Link': 'vela-morango.jpg',
    'Publicar no Mercado Livre?': 'NÃO (Apenas Loja Própria)'
  },
  {
    'Nome do Produto': 'Gel Lubrificante Íntimo Neutro 100ml',
    'Categoria': 'Cosméticos & Lubrificantes',
    'Variante / Sabor / Cor': 'Neutro',
    'Preço de Venda (R$)': 29.90,
    'Custo (R$)': 10.50,
    'Estoque': 15,
    'Descrição Curta': 'Lubrificante à base de água de longa duração, não mancha.',
    'Descrição Completa': 'Fórmula premium desenvolvida para máxima hidratação e conforto. À base de água, compatível com preservativos.',
    'Nome da Foto ou Link': 'gel-neutro-100ml.jpg',
    'Publicar no Mercado Livre?': 'NÃO (Apenas Loja Própria)'
  },
  {
    'Nome do Produto': 'Vibrador Cápsula Bullet Pocket',
    'Categoria': 'Acessórios & Bem-Estar',
    'Variante / Sabor / Cor': 'Rosa Metalizado',
    'Preço de Venda (R$)': 59.90,
    'Custo (R$)': 22.00,
    'Estoque': 5,
    'Descrição Curta': 'Vibrador bullet compacto com 10 velocidades de vibração.',
    'Descrição Completa': 'Silicone de toque aveludado, resistente à água, recarregável via USB. Silencioso e discreto.',
    'Nome da Foto ou Link': 'bullet-rosa.jpg',
    'Publicar no Mercado Livre?': 'NÃO (Apenas Loja Própria)'
  }
];

// 2. Cria a planilha
const wb = XLSX.utils.book_new();

// Aba Produtos
const ws = XLSX.utils.json_to_sheet(rows, {
  header: [
    'Nome do Produto',
    'Categoria',
    'Variante / Sabor / Cor',
    'Preço de Venda (R$)',
    'Custo (R$)',
    'Estoque',
    'Descrição Curta',
    'Descrição Completa',
    'Nome da Foto ou Link',
    'Publicar no Mercado Livre?'
  ]
});

// Ajuste da largura das colunas para ficar legível
ws['!cols'] = [
  { wch: 36 }, // Nome do Produto
  { wch: 26 }, // Categoria
  { wch: 24 }, // Variante
  { wch: 18 }, // Preço Venda
  { wch: 14 }, // Custo
  { wch: 12 }, // Estoque
  { wch: 40 }, // Descrição Curta
  { wch: 50 }, // Descrição Completa
  { wch: 25 }, // Nome Foto
  { wch: 30 }  // Meli
];

XLSX.utils.book_append_sheet(wb, ws, 'Produtos Sensora');

// Aba Instruções
const instructions = [
  { 'Instruções de Preenchimento': '1. Preencha cada linha com um produto (ou variante).' },
  { 'Instruções de Preenchimento': '2. Se o mesmo produto tiver cores ou sabores diferentes, repita o Nome do Produto e mude a coluna "Variante / Sabor / Cor".' },
  { 'Instruções de Preenchimento': '3. Preço de Venda e Estoque são os campos mais importantes.' },
  { 'Instruções de Preenchimento': '4. As fotos você pode colocar o nome do arquivo (ex: foto1.jpg) e me mandar os arquivos das fotos, ou colar o link.' },
  { 'Instruções de Preenchimento': '5. Todos os produtos serão cadastrados no nicho "Sensora Íntima" com trava automática para NÃO ir para o Mercado Livre.' },
  { 'Instruções de Preenchimento': '6. Após preencher, basta salvar o arquivo e me enviar aqui no chat!' }
];
const wsInstructions = XLSX.utils.json_to_sheet(instructions);
wsInstructions['!cols'] = [{ wch: 90 }];
XLSX.utils.book_append_sheet(wb, wsInstructions, 'Como Preencher');

// Salva o arquivo na raiz do projeto
const outputPath = path.resolve(__dirname, '../Planilha_Cadastro_Sensora_Intima.xlsx');
XLSX.writeFile(wb, outputPath);
console.log('✅ Planilha gerada com sucesso em:', outputPath);
