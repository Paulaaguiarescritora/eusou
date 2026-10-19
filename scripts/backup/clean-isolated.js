/**
 * EuSou - Limpeza do Ambiente Temporário de Restauração
 * F17-A: Disaster Recovery & Backup Strategy
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../../backend/node_modules/@prisma/client'));

function getDatabaseUrl() {
  const envPath = path.resolve(__dirname, '../../backend/.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const directLine = lines.find(l => l.trim().startsWith('DIRECT_URL='));
  const dbLine = lines.find(l => l.trim().startsWith('DATABASE_URL='));
  const chosenLine = directLine || dbLine;
  let val = chosenLine.substring(chosenLine.indexOf('=') + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.substring(1, val.length - 1);
  }
  return val;
}

async function cleanIsolatedSchema(schemaName = 'restore_isolated_f17a') {
  console.log(`[CLEAN] Removendo schema isolado temporário "${schemaName}"...`);
  const dbUrl = getDatabaseUrl();
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ['error']
  });

  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    console.log(`[CLEAN] Schema temporário "${schemaName}" removido com sucesso.`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  cleanIsolatedSchema().catch(err => {
    console.error('[ERRO NA LIMPEZA]:', err);
    process.exit(1);
  });
}

module.exports = { cleanIsolatedSchema };
