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

  // Let's test checking if PUT /items/MLB5505908459 with available_quantity: 8 works
  const res = await fetch('https://api.mercadolibre.com/items/MLB5505908459', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ available_quantity: 8 })
  });
  const data = await res.json();
  console.log('Update stock result for MLB5505908459:', res.status, data.available_quantity || data);

  await prisma.$disconnect();
}
run();
