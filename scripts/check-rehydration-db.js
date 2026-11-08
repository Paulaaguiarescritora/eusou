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

async function main() {
  try {
    const count = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int as count FROM product_media_files');
    console.log('Total de arquivos em product_media_files:', count[0]?.count);

    const medias = await prisma.media.findMany({ select: { url: true, product: { select: { name: true, sku: true } } } });
    const fileNames = medias.map(m => path.basename(m.url)).filter(Boolean);

    const foundInDb = await prisma.$queryRawUnsafe(
      `SELECT file_name FROM product_media_files WHERE file_name = ANY($1)`,
      fileNames
    );
    const foundSet = new Set(foundInDb.map(r => r.file_name));

    console.log(`Mídias no Media: ${medias.length}`);
    console.log(`Mídias presentes no product_media_files: ${foundSet.size}`);
    
    const missingInDbAndDisk = [];
    for (const m of medias) {
      if (m.url.startsWith('http')) continue;
      const fn = path.basename(m.url);
      const inMediaDb = foundSet.has(fn);
      const inDiskRoot = fs.existsSync(path.resolve(__dirname, '..', m.url.replace(/^\//, '')));
      const inDiskBackend = fs.existsSync(path.resolve(__dirname, '../backend', m.url.replace(/^\//, '')));
      if (!inMediaDb && !inDiskRoot && !inDiskBackend) {
        missingInDbAndDisk.push({
          sku: m.product?.sku,
          product: m.product?.name,
          url: m.url
        });
      }
    }

    console.log(`Arquivos que NÃO estão nem no disco nem no banco de reidratação: ${missingInDbAndDisk.length}`);
    if (missingInDbAndDisk.length > 0) {
      console.log('Primeiros 10 faltando totalmente:');
      console.log(missingInDbAndDisk.slice(0, 10));
    }
  } catch (err) {
    console.error('Erro ao verificar product_media_files:', err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
