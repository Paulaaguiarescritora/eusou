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

async function check() {
  const account = await prisma.channelAccount.findUnique({
    where: { id: 'f388287b-6577-498a-b767-4aea812c057b' }
  });
  const token = account.configuration.accessToken;

  const items = [
    { name: 'Kit Romance II', id: 'MLB5520983909' },
    { name: 'Kit Romance I', id: 'MLB7951837240' },
    { name: 'Kit Te Amo', id: 'MLB5522018063' },
    { name: 'Kit Chá de Lingerie', id: 'MLB7952537762' }
  ];

  for (const item of items) {
    const r = await fetch(`https://api.mercadolibre.com/items/${item.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    console.log(`\n=== ${item.name} (${item.id}) ===`);
    console.log(`Status: ${d.status} | Sub-status: ${JSON.stringify(d.sub_status)}`);
    console.log(`Preço: R$ ${d.price} | Estoque: ${d.available_quantity}`);
    console.log(`Total de fotos: ${d.pictures?.length}`);
    if (d.pictures?.length) {
      console.log(`Foto de Capa: ${d.pictures[0]?.secure_url || d.pictures[0]?.url}`);
    }
  }
  await prisma.$disconnect();
}
check().catch(console.error);
