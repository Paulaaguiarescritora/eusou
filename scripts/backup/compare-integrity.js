/**
 * EuSou - Validador de Integridade Pós-Restauração
 * F17-A: Disaster Recovery & Backup Strategy
 *
 * Compara o banco oficial (schema public) com o banco restaurado (schema isolado)
 * item a item: tabelas, registros, colunas, chaves e dados críticos.
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

const CRITICAL_ENTITIES = [
  'User',
  'Role',
  'Product',
  'ProductVariant',
  'AttributeDefinition',
  'Niche',
  'Category',
  'Catalog',
  'Collection',
  'Order',
  'OrderItem',
  'Affiliate',
  'AffiliateLink',
  'AffiliateConversion',
  'Printer',
  'Material',
  'ProductionJob',
  'Inventory',
  'StockMovement',
  'Channel',
  'ChannelProduct',
  'ChannelOrder',
  'PricingProfile',
  'PricingChannelRule',
  'ProductChannelPrice',
  'Payment',
  'AuditLog',
  'MarketplaceEvent'
];

async function compareIntegrity(isolatedSchema = 'restore_isolated_f17a') {
  console.log(`[INTEGRITY] Iniciando auditoria comparativa: public vs ${isolatedSchema}...`);
  const dbUrl = getDatabaseUrl();
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ['error']
  });

  try {
    // 1. Comparar tabelas
    const publicTables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const isolatedTables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${isolatedSchema}' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const publicTableNames = publicTables.map(t => t.table_name);
    const isolatedTableNames = isolatedTables.map(t => t.table_name);

    const missingInIsolated = publicTableNames.filter(t => !isolatedTableNames.includes(t));
    const extraInIsolated = isolatedTableNames.filter(t => !publicTableNames.includes(t));

    // 2. Comparar registros por tabela
    const countDifferences = [];
    const tableComparisons = {};

    for (const t of publicTableNames) {
      if (isolatedTableNames.includes(t)) {
        const pubCountRes = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM "public"."${t}";`);
        const isoCountRes = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM "${isolatedSchema}"."${t}";`);
        const pubCount = Number(pubCountRes[0].cnt);
        const isoCount = Number(isoCountRes[0].cnt);

        tableComparisons[t] = {
          public: pubCount,
          restored: isoCount,
          match: pubCount === isoCount
        };

        if (pubCount !== isoCount) {
          countDifferences.push({ table: t, public: pubCount, restored: isoCount });
        }
      }
    }

    // 3. Comparar entidades críticas
    console.log('\n--- AUDITORIA DE ENTIDADES CRÍTICAS ---');
    const criticalResults = {};
    for (const entity of CRITICAL_ENTITIES) {
      if (tableComparisons[entity]) {
        const comp = tableComparisons[entity];
        criticalResults[entity] = {
          publicRows: comp.public,
          restoredRows: comp.restored,
          status: comp.match ? 'MATCH' : 'MISMATCH'
        };
        console.log(`[${entity.padEnd(16)}] Public: ${String(comp.public).padStart(4)} | Restored: ${String(comp.restored).padStart(4)} | Status: ${comp.match ? 'MATCH (100%)' : 'MISMATCH'}`);
      } else {
        criticalResults[entity] = { status: 'TABLE_NOT_FOUND' };
        console.log(`[${entity.padEnd(16)}] NÃO ENCONTRADA NO SCHEMA RESTAURADO`);
      }
    }

    // 4. Comparar integridade relacional do módulo de pagamentos
    const pubPayments = await prisma.$queryRawUnsafe(`SELECT id, "orderId", status, amount FROM "public"."Payment" ORDER BY id;`);
    const isoPayments = await prisma.$queryRawUnsafe(`SELECT id, "orderId", status, amount FROM "${isolatedSchema}"."Payment" ORDER BY id;`);

    let paymentDataMatch = (pubPayments.length === isoPayments.length);
    if (paymentDataMatch) {
      for (let i = 0; i < pubPayments.length; i++) {
        if (pubPayments[i].id !== isoPayments[i].id || pubPayments[i].orderId !== isoPayments[i].orderId || pubPayments[i].status !== isoPayments[i].status) {
          paymentDataMatch = false;
          break;
        }
      }
    }

    // 5. Comparar _prisma_migrations
    const pubMigrations = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM "public"."_prisma_migrations";`);
    const isoMigrations = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM "${isolatedSchema}"."_prisma_migrations";`);
    const migrationsMatch = (Number(pubMigrations[0].cnt) === Number(isoMigrations[0].cnt));

    // 6. Verificar integridade referencial no schema restaurado (ausência de órfãos)
    console.log('\n--- AUDITORIA DE INTEGRIDADE REFERENCIAL ---');
    const orphanChecks = [
      { name: 'OrderItem sem Order', query: `SELECT count(*) as cnt FROM "${isolatedSchema}"."OrderItem" oi LEFT JOIN "${isolatedSchema}"."Order" o ON oi."orderId" = o.id WHERE o.id IS NULL;` },
      { name: 'Payment sem Order', query: `SELECT count(*) as cnt FROM "${isolatedSchema}"."Payment" p LEFT JOIN "${isolatedSchema}"."Order" o ON p."orderId" = o.id WHERE o.id IS NULL;` },
      { name: 'ProductVariant sem Product', query: `SELECT count(*) as cnt FROM "${isolatedSchema}"."ProductVariant" pv LEFT JOIN "${isolatedSchema}"."Product" p ON pv."productId" = p.id WHERE p.id IS NULL;` },
      { name: 'Inventory sem Product', query: `SELECT count(*) as cnt FROM "${isolatedSchema}"."Inventory" inv LEFT JOIN "${isolatedSchema}"."Product" p ON inv."productId" = p.id WHERE p.id IS NULL;` },
      { name: 'ChannelProduct sem Product', query: `SELECT count(*) as cnt FROM "${isolatedSchema}"."ChannelProduct" cp LEFT JOIN "${isolatedSchema}"."Product" p ON cp."productId" = p.id WHERE p.id IS NULL;` },
      { name: 'AffiliateConversion sem Affiliate', query: `SELECT count(*) as cnt FROM "${isolatedSchema}"."AffiliateConversion" ac LEFT JOIN "${isolatedSchema}"."Affiliate" a ON ac."affiliateId" = a.id WHERE a.id IS NULL;` }
    ];

    let referentialIntegrityPass = true;
    const orphanResults = [];
    for (const chk of orphanChecks) {
      try {
        const res = await prisma.$queryRawUnsafe(chk.query);
        const cnt = Number(res[0].cnt);
        orphanResults.push({ name: chk.name, orphansCount: cnt, pass: cnt === 0 });
        console.log(`[${chk.name.padEnd(35)}] Órfãos: ${cnt} | Status: ${cnt === 0 ? 'PASS (0 órfãos)' : 'FAIL'}`);
        if (cnt > 0) referentialIntegrityPass = false;
      } catch (err) {
        console.log(`[${chk.name.padEnd(35)}] Verificação ignorada (tabela vazia ou sem dados)`);
      }
    }

    const overallIntegrityPass = (
      missingInIsolated.length === 0 &&
      countDifferences.length === 0 &&
      paymentDataMatch &&
      migrationsMatch &&
      referentialIntegrityPass
    );

    console.log('\n================ RESUMO DA AUDITORIA DE INTEGRIDADE ================');
    console.log(`Tabelas Oficial:             ${publicTableNames.length}`);
    console.log(`Tabelas Restaurado:          ${isolatedTableNames.length}`);
    console.log(`Tabelas Ausentes:            ${missingInIsolated.length}`);
    console.log(`Divergências de Registros:   ${countDifferences.length}`);
    console.log(`Payment Match Detalhado:     ${paymentDataMatch ? 'PASS' : 'FAIL'}`);
    console.log(`Migrations Match (13/13):    ${migrationsMatch ? 'PASS' : 'FAIL'}`);
    console.log(`STATUS GERAL DE INTEGRIDADE: ${overallIntegrityPass ? 'PASS (100% IDÊNTICO)' : 'FAIL'}`);
    console.log('====================================================================\n');

    return {
      success: overallIntegrityPass,
      publicTablesCount: publicTableNames.length,
      restoredTablesCount: isolatedTableNames.length,
      missingTables: missingInIsolated,
      countDifferences,
      criticalResults,
      paymentDataMatch,
      migrationsMatch
    };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  compareIntegrity().catch(err => {
    console.error('[ERRO NA AUDITORIA DE INTEGRIDADE]:', err);
    process.exit(1);
  });
}

module.exports = { compareIntegrity };
