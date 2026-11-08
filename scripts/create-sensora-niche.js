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
  const themes = await prisma.theme.findMany();
  console.log('Temas:', themes.map(t => ({ id: t.id, name: t.name, slug: t.slug })));

  // Check if Sensora Íntima already exists
  let niche = await prisma.niche.findFirst({
    where: {
      OR: [
        { slug: 'sensora-intima' },
        { name: { equals: 'Sensora Íntima', mode: 'insensitive' } }
      ]
    }
  });

  const logoRelativeUrl = '/uploads/logos/sensora-intima-logo.png';

  if (!niche) {
    niche = await prisma.niche.create({
      data: {
        name: 'Sensora Íntima',
        slug: 'sensora-intima',
        description: 'Linha exclusiva de bem-estar íntimo e autocuidado Sensora Íntima.',
        status: 'ACTIVE',
        brandName: 'Sensora Íntima',
        logoUrl: logoRelativeUrl
      }
    });
    console.log('✅ Nicho criado com sucesso:', niche);
  } else {
    niche = await prisma.niche.update({
      where: { id: niche.id },
      data: {
        brandName: 'Sensora Íntima',
        logoUrl: logoRelativeUrl,
        status: 'ACTIVE'
      }
    });
    console.log('✅ Nicho atualizado com sucesso:', niche);
  }

  await prisma.$disconnect();
}
run();
