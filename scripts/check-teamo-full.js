const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../backend/.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
let directUrl = '';
for (const line of lines) {
  if (line.trim().startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].replace(/["']/g, '').trim();
}
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: directUrl });

async function check() {
  const p = await prisma.product.findUnique({
    where: { id: 'd6847eee-6db9-4c92-b1da-b4129d7aa894' },
    include: {
      inventories: true,
      productChannelPrices: true,
      categories: { include: { category: true } },
      niches: { include: { niche: true } }
    }
  });
  console.log('ID:', p.id);
  console.log('Name:', p.name);
  console.log('Status:', p.status);
  console.log('Brand:', p.brand);
  console.log('basePrice:', p.basePrice);
  console.log('manualCost:', p.manualCost);
  console.log('wholesalePrice:', p.wholesalePrice);
  console.log('Inventories:', p.inventories);
  console.log('Channel prices:', p.productChannelPrices);
  console.log('Categories:', p.categories.map(c => c.category.name));
  console.log('Niches:', p.niches.map(n => n.niche.name));
  await prisma.$disconnect();
}
check().catch(console.error);
