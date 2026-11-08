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

async function checkItem(token, itemId) {
  const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`\n================ Item ${itemId}: ${data.title} ================`);
  console.log(`Status: ${data.status} | Total Stock: ${data.available_quantity} | Price: ${data.price}`);
  if (data.variations && data.variations.length > 0) {
    console.log(`Variações no Mercado Livre (${data.variations.length}):`);
    for (const v of data.variations) {
      const attrs = v.attribute_combinations.map(a => `${a.name}: ${a.value_name}`).join(', ');
      console.log(`  - ID: ${v.id} | Atributos: [${attrs}] | Qtd: ${v.available_quantity} | SKU: ${v.seller_custom_field || 'N/A'}`);
    }
  } else {
    console.log('Sem variações cadastradas (anúncio simples).');
  }
}

async function main() {
  const account = await prisma.channelAccount.findFirst({
    where: { channel: { type: 'MERCADO_LIVRE' }, status: 'ACTIVE' }
  });
  if (!account) {
    console.log('Nenhuma conta do Mercado Livre ativa encontrada.');
    return;
  }
  const token = account.configuration.accessToken;

  await checkItem(token, 'MLB5505899587'); // Kit Doguinho
  await checkItem(token, 'MLB5505908459'); // Catnip Roscado
  await checkItem(token, 'MLB7921219190'); // Rato articulado

  await prisma.$disconnect();
}
main();
