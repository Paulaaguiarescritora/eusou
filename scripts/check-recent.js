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
  const prods = await prisma.product.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      media: true
    }
  });
  console.log('Recent products:');
  for (const p of prods) {
    console.log(`- ${p.id} | ${p.sku} | ${p.name} | updated: ${p.updatedAt} | media: ${p.media.length}`);
  }
  const mediaRecent = await prisma.productMedia.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('\nRecent product media:');
  for (const m of mediaRecent) {
    console.log(`- productId: ${m.productId} | url: ${m.url} | created: ${m.createdAt}`);
  }
  await prisma.$disconnect();
}
check().catch(console.error);
