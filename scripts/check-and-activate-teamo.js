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
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: env.DIRECT_URL });

async function checkItem() {
  const account = await prisma.channelAccount.findUnique({
    where: { id: 'f388287b-6577-498a-b767-4aea812c057b' }
  });
  const token = account.configuration.accessToken;

  const res = await fetch('https://api.mercadolibre.com/items/MLB5522018063', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('=== MLB5522018063 ===');
  console.log('Title:', data.title);
  console.log('Price:', data.price);
  console.log('Status:', data.status, '| Sub-status:', data.sub_status);
  console.log('Available quantity:', data.available_quantity);
  console.log('Total pictures:', data.pictures?.length);
  if (data.pictures?.length) {
    data.pictures.forEach((p, idx) => {
      console.log(`[${idx}] id: ${p.id} | size: ${p.size} | max_size: ${p.max_size} | url: ${p.url || p.secure_url}`);
    });
  }

  // If status is paused and no picture issues, let's try activating
  if (data.status === 'paused') {
    console.log('\nTentando ativar anúncio no Mercado Livre...');
    const putRes = await fetch('https://api.mercadolibre.com/items/MLB5522018063', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'active' })
    });
    const putData = await putRes.json();
    console.log('Resposta da ativação:', putRes.status, putData.status, putData.sub_status);
  }

  await prisma.$disconnect();
}
checkItem().catch(console.error);
