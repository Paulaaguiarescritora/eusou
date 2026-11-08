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
  const refreshToken = account.configuration.refreshToken;
  console.log('Refreshing using refreshToken:', refreshToken);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.MERCADOLIVRE_CLIENT_ID,
    client_secret: env.MERCADOLIVRE_CLIENT_SECRET,
    refresh_token: refreshToken
  });

  const res = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Refresh error:', data);
    return;
  }

  console.log('Novo token obtido! Expira em:', data.expires_in);
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);
  const updatedConfig = {
    ...account.configuration,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: expiresAt.toISOString(),
    lastRefreshedAt: new Date().toISOString()
  };

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: { configuration: updatedConfig }
  });
  console.log('Banco de dados atualizado com novo token!');

  // Agora vamos testar a consulta dos itens!
  const itemsToCheck = ['MLB5505899587', 'MLB5505908459', 'MLB7921219190'];
  for (const itemId of itemsToCheck) {
    const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    const itemData = await itemRes.json();
    console.log(`\n================ Item ${itemId}: ${itemData.title} ================`);
    console.log(`Status: ${itemData.status} | Total Stock: ${itemData.available_quantity} | Price: ${itemData.price}`);
    if (itemData.variations && itemData.variations.length > 0) {
      console.log(`Variações no Mercado Livre (${itemData.variations.length}):`);
      for (const v of itemData.variations) {
        const attrs = (v.attribute_combinations || []).map(a => `${a.name}: ${a.value_name}`).join(', ');
        console.log(`  - ID: ${v.id} | Atributos: [${attrs}] | Qtd: ${v.available_quantity} | SKU: ${v.seller_custom_field || 'N/A'}`);
      }
    } else {
      console.log('Sem variações cadastradas (anúncio simples). Atributos:', (itemData.attributes || []).filter(a => a.id === 'COLOR').map(a => a.value_name));
    }
  }

  await prisma.$disconnect();
}
run();
