const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../backend/.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
let directUrl = '';
for (const line of lines) {
  if (line.trim().startsWith('DIRECT_URL=')) {
    directUrl = line.split('=')[1].replace(/["']/g, '').trim();
  }
}

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: directUrl });

async function checkDb() {
  const products = await prisma.product.findMany({
    include: {
      variants: true,
      categories: { include: { category: true } },
      niches: { include: { niche: true } },
      productChannelPrices: { include: { channel: true } }
    }
  });
  console.log('Total produtos no banco:', products.length);
  for (const p of products) {
    console.log('Produto:', p.sku, '|', p.name, '| Base:', p.basePrice, '| Status:', p.status);
    for (const v of p.variants) {
      console.log('   Variante:', v.sku, '|', v.name, '| Preco:', v.price);
    }
    for (const cp of p.productChannelPrices) {
      console.log('   Canal:', cp.channel?.name || cp.channelId, '| Preco:', cp.price);
    }
  }

  const niches = await prisma.niche.findMany();
  console.log('Nichos no banco:', niches.map(n => n.name));

  const categories = await prisma.category.findMany();
  console.log('Categorias no banco:', categories.map(c => c.name));

  const channels = await prisma.channel.findMany();
  console.log('Canais no banco:', channels.map(c => c.name));

  await prisma.$disconnect();
}

checkDb().catch(e => console.error(e));
