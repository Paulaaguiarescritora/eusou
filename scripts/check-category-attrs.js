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

  // Let's inspect item MLB5505899587 details
  const itemRes = await fetch('https://api.mercadolibre.com/items/MLB5505899587', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const item = await itemRes.json();
  console.log('Category ID:', item.category_id);

  // Check category attributes
  const catRes = await fetch(`https://api.mercadolibre.com/categories/${item.category_id}/attributes`);
  const catAttrs = await catRes.json();
  const colorAttr = catAttrs.find(a => a.id === 'COLOR');
  console.log('Category COLOR attr tags:', colorAttr?.tags);
  console.log('Allow variations?', colorAttr?.tags?.allow_variations);

  await prisma.$disconnect();
}
run();
