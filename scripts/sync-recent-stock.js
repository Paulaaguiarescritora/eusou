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

async function updateMeliStock(token, itemId, newStock, title) {
  const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ available_quantity: newStock })
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✅ [${itemId}] ${title} -> Estoque atualizado no Mercado Livre para ${newStock} unidades.`);
  } else {
    console.error(`❌ [${itemId}] Falha ao atualizar estoque:`, data);
  }
}

async function run() {
  const account = await prisma.channelAccount.findUnique({
    where: { id: 'f388287b-6577-498a-b767-4aea812c057b' }
  });
  const token = account.configuration.accessToken;

  // 1. Kit Doguinho: Total 3 (1 Azul, 1 Rosa, 1 Marrom)
  await updateMeliStock(token, 'MLB5505899587', 3, 'Kit Doguinho Acessórios para Guia');

  // 2. Catnip Roscado: Total 8 (6 Marrom, 2 Azul)
  await updateMeliStock(token, 'MLB5505908459', 8, 'Brinquedo para Erva-do-Gato Roscado');

  // 3. Rato Articulado: Total 5 (3 Marrom, 2 Dourado)
  await updateMeliStock(token, 'MLB7921219190', 5, 'Brinquedo Rato Articulado');

  await prisma.$disconnect();
}
run();
