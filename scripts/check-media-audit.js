const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../backend/.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
let directUrl = '';
for (const line of lines) {
  if (line.trim().startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].replace(/["']/g, '').trim();
}
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: directUrl });

async function main() {
  const medias = await prisma.media.findMany({
    include: { product: { select: { id: true, name: true, sku: true, slug: true } } }
  });
  console.log('=== AUDITORIA DE MÍDIAS / FOTOS ===');
  console.log('Total de fotos/mídias cadastradas no banco:', medias.length);
  
  const byProduct = {};
  for (const m of medias) {
    const pName = m.product ? `${m.product.name} (${m.product.sku})` : 'Sem Produto';
    if (!byProduct[pName]) byProduct[pName] = [];
    byProduct[pName].push(m);
  }

  for (const [prod, list] of Object.entries(byProduct)) {
    console.log(`\nProduto: ${prod} - ${list.length} foto(s):`);
    for (const item of list) {
      console.log(`  - [Primary: ${item.isPrimary}] URL: ${item.url} (Alt: ${item.altText || 'SEM ALT'})`);
    }
  }

  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, sku: true, status: true, media: true }
  });

  const withoutMedia = allProducts.filter(p => !p.media || p.media.length === 0);
  console.log(`\nTotal de produtos cadastrados: ${allProducts.length}`);
  console.log(`Produtos SEM NENHUMA foto cadastrada: ${withoutMedia.length}`);
  if (withoutMedia.length > 0) {
    console.log('Lista de produtos sem foto:');
    withoutMedia.forEach(p => console.log(`  - [${p.status}] ${p.name} (SKU: ${p.sku})`));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
