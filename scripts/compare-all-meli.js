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
  const account = await prisma.channelAccount.findUnique({
    where: { id: 'f388287b-6577-498a-b767-4aea812c057b' }
  });
  const token = account.configuration.accessToken;

  const published = await prisma.channelProduct.findMany({
    where: { channelAccountId: account.id, status: 'PUBLISHED' },
    include: {
      product: {
        include: {
          variants: {
            include: {
              inventories: true,
              variantAttributeValues: {
                include: { productAttributeValue: { include: { attributeDefinition: true } } }
              }
            }
          }
        }
      }
    }
  });

  console.log(`Verificando ${published.length} anúncios publicados no Mercado Livre...\n`);

  for (const cp of published) {
    const p = cp.product;
    const meliRes = await fetch(`https://api.mercadolibre.com/items/${cp.externalProductId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meli = await meliRes.json();
    const systemStock = p.variants.reduce((acc, v) => acc + v.inventories.reduce((a, b) => a + b.quantity, 0), 0);
    const meliStock = meli.available_quantity;

    console.log(`--------------------------------------------------`);
    console.log(`[${cp.externalProductId}] ${p.name}`);
    console.log(`Estoque Sistema: ${systemStock} | Estoque Meli: ${meliStock} | Preço Meli: R$ ${meli.price}`);
    console.log(`Variantes no Sistema (${p.variants.length}):`);
    for (const v of p.variants) {
      const vStock = v.inventories.reduce((a, b) => a + b.quantity, 0);
      console.log(`   * ${v.name} (${v.sku}): Estoque ${vStock}`);
    }
    if (meli.variations && meli.variations.length > 0) {
      console.log(`Variantes no Mercado Livre (${meli.variations.length}):`);
      for (const mv of meli.variations) {
        const c = (mv.attribute_combinations || []).map(a => `${a.name}: ${a.value_name}`).join(', ');
        console.log(`   # ID ${mv.id} [${c}] Qtd: ${mv.available_quantity}`);
      }
    } else {
      console.log(`Meli está configurado como anúncio sem variações.`);
    }
  }

  await prisma.$disconnect();
}
run();
