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
  const products = await prisma.product.findMany({
    include: {
      variants: {
        include: {
          inventories: true,
          variantAttributeValues: {
            include: {
              productAttributeValue: {
                include: { attributeDefinition: true }
              }
            }
          }
        }
      },
      channelProducts: true
    }
  });

  for (const p of products) {
    console.log(`\n=== PRODUTO: ${p.name} (SKU: ${p.sku}) ===`);
    console.log(`ChannelProducts (Meli):`, p.channelProducts.map(cp => ({ id: cp.id, extId: cp.externalProductId, status: cp.status })));
    for (const v of p.variants) {
      const attrs = v.variantAttributeValues.map(av => `${av.productAttributeValue?.attributeDefinition?.name}: ${av.productAttributeValue?.value}`).join(', ');
      const totalStock = v.inventories.reduce((acc, inv) => acc + inv.quantity, 0);
      console.log(`  - Variante: "${v.name}" (SKU: ${v.sku}) | [${attrs}] | Estoque: ${totalStock}`);
    }
  }
  await prisma.$disconnect();
}
main();
