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
  const recentVariants = await prisma.productVariant.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: {
      product: { select: { name: true, sku: true } },
      inventories: true
    }
  });

  console.log('Últimas variantes modificadas no banco:');
  for (const v of recentVariants) {
    const stock = v.inventories.reduce((a, b) => a + b.quantity, 0);
    console.log(`- Produto: ${v.product.name} | Variante: ${v.name} (SKU: ${v.sku}) | Estoque: ${stock} | Atualizado: ${v.updatedAt}`);
  }

  const recentMovements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { variant: { select: { name: true, sku: true } } }
  });
  console.log('\nÚltimas movimentações de estoque:');
  for (const m of recentMovements) {
    console.log(`- ${m.variant?.sku} (${m.variant?.name}): tipo=${m.type}, qtd=${m.quantity}, em=${m.createdAt}`);
  }

  await prisma.$disconnect();
}
main();
