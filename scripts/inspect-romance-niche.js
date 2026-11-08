const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync(path.resolve('backend/.env'), 'utf8').split('\n');
let directUrl = '';
for (const line of lines) {
  if (line.trim().startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].replace(/["']/g, '').trim();
}
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: directUrl });

async function main() {
  const cat = await prisma.category.findMany({ where: { nicheId: '510eb44f-8cca-4bc9-a7d0-093abe0abf2d' } });
  console.log('Categorias no nicho Romance:', cat);
  const channels = await prisma.channel.findMany({ include: { accounts: true } });
  console.log('Canais:', channels.map(c => ({ id: c.id, name: c.name, type: c.type, accounts: c.accounts.map(a => ({ id: a.id, name: a.name })) })));
  const existingProd = await prisma.product.findFirst({
    where: {
      OR: [
        { name: { contains: 'Carimbo', mode: 'insensitive' } },
        { name: { contains: 'Romance', mode: 'insensitive' } },
        { sku: { contains: 'ROM', mode: 'insensitive' } }
      ]
    }
  });
  console.log('Produto já existe no banco?', existingProd ? existingProd.name : 'Não');
  await prisma.$disconnect();
}
main();
