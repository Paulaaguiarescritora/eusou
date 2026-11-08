const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../backend/.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const parts = line.trim().split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').replace(/["']/g, '').trim();
    env[key] = val;
  }
}
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: env.DIRECT_URL });

async function run() {
  const niches = await prisma.niche.findMany({
    include: {
      categories: true,
      _count: { select: { products: true } }
    }
  });
  console.log('Nichos cadastrados:');
  for (const n of niches) {
    console.log(`- ID: ${n.id} | Nome: "${n.name}" | Slug: "${n.slug}" | Status: ${n.status} | Total Produtos: ${n._count.products}`);
    console.log(`  Categorias:`, n.categories.map(c => c.name).join(', ') || 'Nenhuma');
  }
  await prisma.$disconnect();
}
run();
