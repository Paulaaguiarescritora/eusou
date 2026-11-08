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
      media: { orderBy: { sortOrder: 'asc' } },
      inventories: true,
      productChannelPrices: true,
      channelProducts: true
    }
  });
  console.log('Product:', p?.name);
  console.log('SKU:', p?.sku);
  console.log('Price:', p?.price);
  console.log('Media count:', p?.media?.length);
  if (p?.media?.length) {
    p.media.forEach((m, idx) => console.log(`[${idx}] ${m.id} | sortOrder: ${m.sortOrder} | url: ${m.url}`));
  }
  console.log('Channel Products:', p?.channelProducts);
  await prisma.$disconnect();
}
check().catch(console.error);
