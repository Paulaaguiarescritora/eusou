const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../backend/.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
let directUrl = '';
for (const line of lines) {
  if (line.trim().startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].replace(/["']/g, '').trim();
}
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: directUrl });

async function check() {
  const niches = await prisma.niche.findMany({
    include: {
      categories: true,
      catalogs: true,
      products: { include: { product: true } }
    }
  });
  console.log('=== NICHES ===');
  for (const n of niches) {
    console.log(`- Niche: ${n.name} (id: ${n.id}, slug: ${n.slug})`);
    console.log(`  Products count: ${n.products.length}`);
    console.log(`  Catalogs count: ${n.catalogs.length}`);
  }

  const catalogs = await prisma.catalog.findMany({
    include: { niche: true, items: true }
  });
  console.log('\n=== CATALOGS ===');
  for (const c of catalogs) {
    console.log(`- Catalog: ${c.name} (id: ${c.id}, slug: ${c.slug}, niche: ${c.niche?.name || 'none'}) | items: ${c.items.length}`);
  }

  const channels = await prisma.channel.findMany();
  console.log('\n=== CHANNELS ===');
  for (const ch of channels) {
    console.log(`- Channel: ${ch.name} (type: ${ch.type})`);
  }

  const affiliates = await prisma.affiliate.findMany({
    include: { links: true }
  });
  console.log('\n=== AFFILIATES ===');
  for (const a of affiliates) {
    console.log(`- Affiliate: ${a.name} (code: ${a.affiliateCode}) | links: ${a.links.length}`);
    a.links.forEach(l => console.log(`   link: slug=${l.slug}, prodId=${l.productId}, catId=${l.catalogId}`));
  }

  await prisma.$disconnect();
}
check().catch(console.error);
