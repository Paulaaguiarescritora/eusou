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
  const medias = await prisma.media.findMany({
    include: { product: { select: { id: true, name: true, sku: true, status: true } } }
  });

  console.log(`Verificando existência em disco de ${medias.length} mídias...`);
  
  let missingFiles = [];
  let existingFiles = 0;
  let externalUrls = 0;

  for (const m of medias) {
    if (m.url.startsWith('http://') || m.url.startsWith('https://')) {
      externalUrls++;
      continue;
    }

    // URL is usually /uploads/products/...
    const relativePath = m.url.replace(/^\//, '');
    const fullPathBackend = path.resolve(__dirname, '../backend', relativePath);
    const fullPathRoot = path.resolve(__dirname, '..', relativePath);
    const fullPathFrontend = path.resolve(__dirname, '../frontend/public', relativePath);

    const existsInRoot = fs.existsSync(fullPathRoot);
    const existsInBackend = fs.existsSync(fullPathBackend);
    const existsInFrontend = fs.existsSync(fullPathFrontend);

    if (existsInRoot) {
      existingFiles++;
      console.log('Root:', relativePath);
    } else if (existsInBackend) {
      existingFiles++;
      console.log('Backend:', relativePath);
    } else if (existsInFrontend) {
      existingFiles++;
      console.log('Frontend:', relativePath);
    } else {
      missingFiles.push({
        id: m.id,
        product: m.product?.name,
        sku: m.product?.sku,
        status: m.product?.status,
        url: m.url,
        attemptedPathRoot: fullPathRoot
      });
    }
  }

  console.log(`Arquivos locais encontrados: ${existingFiles}`);
  console.log(`URLs externas (YouTube etc): ${externalUrls}`);
  console.log(`Arquivos FALTANDO NO DISCO (404 em potencial): ${missingFiles.length}`);

  if (missingFiles.length > 0) {
    console.log('\n--- LISTA DE FOTOS COM ARQUIVO AUSENTE NO DISCO ---');
    missingFiles.forEach(f => {
      console.log(`- Produto: [${f.status}] ${f.product} (${f.sku}) -> URL: ${f.url}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
