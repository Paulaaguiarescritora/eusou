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
  const mediaRecent = await prisma.media.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { product: true }
  });
  console.log('Recent media in DB:');
  for (const m of mediaRecent) {
    console.log(`- id: ${m.id} | prod: ${m.product?.name} (${m.productId}) | url: ${m.url} | created: ${m.createdAt}`);
  }
  await prisma.$disconnect();
}
check().catch(console.error);
