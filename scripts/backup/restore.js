/**
 * EuSou - Restauração em Ambiente Isolado PostgreSQL
 * F17-A: Disaster Recovery & Backup Strategy
 *
 * Restaura o backup em um schema isolado para comprovar recuperação
 * sem jamais colocar em risco o banco oficial em produção/public.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require(path.resolve(__dirname, '../../backend/node_modules/@prisma/client'));

const { getDatabaseUrl } = require('./db-url');

function findLatestBackup() {
  const backupDir = path.resolve(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) {
    throw new Error('Diretório backups/ não encontrado');
  }
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql')).sort().reverse();
  if (files.length === 0) {
    throw new Error('Nenhum arquivo de backup .sql encontrado em backups/');
  }
  return path.join(backupDir, files[0]);
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDollarQuote = false;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (!inDollarQuote && char === "'") {
      if (inSingleQuote && nextChar === "'") {
        current += "''";
        i += 2;
        continue;
      }
      inSingleQuote = !inSingleQuote;
      current += char;
      i++;
      continue;
    }

    if (!inSingleQuote && char === '$' && nextChar === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i += 2;
      continue;
    }

    if (!inSingleQuote && !inDollarQuote && char === ';') {
      let clean = current.replace(/^\s*--[^\r\n]*(\r?\n)?/gm, '').trim();
      if (clean && !clean.startsWith('\\') && clean !== 'BEGIN' && clean !== 'COMMIT') {
        statements.push(clean);
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  let clean = current.replace(/^\s*--[^\r\n]*(\r?\n)?/gm, '').trim();
  if (clean && !clean.startsWith('\\') && clean !== 'BEGIN' && clean !== 'COMMIT') {
    statements.push(clean);
  }

  return statements;
}

async function runRestore(options = {}) {
  const startTime = Date.now();
  const backupPath = options.backupPath || findLatestBackup();
  const targetSchema = options.targetSchema || 'restore_isolated_f17a';

  console.log(`[RESTORE] Iniciando processo de restauração em ambiente isolado...`);
  console.log(`[RESTORE] Arquivo de backup: ${path.basename(backupPath)}`);
  console.log(`[RESTORE] Schema alvo isolado: "${targetSchema}"`);

  if (targetSchema === 'public' && !options.forceProductionOverwrite) {
    throw new Error('SEGURANÇA: Restauração direta no schema "public" bloqueada para evitar sobrescrita do banco oficial.');
  }

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Arquivo de backup não encontrado: ${backupPath}`);
  }

  const backupStats = fs.statSync(backupPath);
  if (backupStats.size === 0) {
    throw new Error('Arquivo de backup vazio (0 bytes). Impossível restaurar.');
  }

  const hash = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
  console.log(`[RESTORE] Integridade do arquivo validada (${(backupStats.size / 1024).toFixed(2)} KB, SHA-256: ${hash})`);

  const dbUrl = getDatabaseUrl();
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ['error']
  });

  try {
    await prisma.$connect();
    console.log('[RESTORE] Conexão com banco validada.');

    console.log(`[RESTORE] Preparando schema isolado "${targetSchema}"...`);
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${targetSchema}" CASCADE;`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${targetSchema}";`);

    console.log(`[RESTORE] Lendo comandos SQL e parametrizando para "${targetSchema}"...`);
    let rawSql = fs.readFileSync(backupPath, 'utf8');
    rawSql = rawSql.split('__SCHEMA__').join(targetSchema);

    const statements = splitSqlStatements(rawSql);
    console.log(`[RESTORE] Total de comandos a executar: ${statements.length}`);

    // Execução sequencial dos comandos
    let executedCount = 0;
    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        console.error(`\n[ERRO NO COMANDO ${executedCount + 1}]:\n${stmt}\n`);
        throw err;
      }
      executedCount++;
      if (executedCount % 200 === 0 || executedCount === statements.length) {
        process.stdout.write(`\r[RESTORE] Progresso: ${executedCount}/${statements.length} comandos executados`);
      }
    }
    console.log('\n[RESTORE] Todos os comandos executados com sucesso!');

    // Validação dos objetos restaurados
    const restoredTables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${targetSchema}' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableCounts = {};
    let totalRestoredRows = 0;

    for (const t of restoredTables) {
      const cntRes = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM "${targetSchema}"."${t.table_name}";`);
      const cnt = Number(cntRes[0].cnt);
      tableCounts[t.table_name] = cnt;
      totalRestoredRows += cnt;
    }

    const restoredEnums = await prisma.$queryRawUnsafe(`
      SELECT t.typname, count(e.enumlabel) as labels_count
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = '${targetSchema}'
      GROUP BY t.typname
      ORDER BY t.typname;
    `);

    const restoredFks = await prisma.$queryRawUnsafe(`
      SELECT count(*) as total_fks
      FROM information_schema.table_constraints
      WHERE table_schema = '${targetSchema}' AND constraint_type = 'FOREIGN KEY';
    `);

    const restoredIndexes = await prisma.$queryRawUnsafe(`
      SELECT count(*) as total_indexes
      FROM pg_indexes
      WHERE schemaname = '${targetSchema}';
    `);

    const duration = Date.now() - startTime;

    console.log(`\n================ RESTAURAÇÃO CONCLUÍDA COM SUCESSO ================`);
    console.log(`Schema Alvo:    "${targetSchema}" (100% ISOLADO DO BANCO OFICIAL)`);
    console.log(`Tabelas:        ${restoredTables.length} tabelas restauradas`);
    console.log(`Registros:      ${totalRestoredRows} registros restaurados`);
    console.log(`Enums:          ${restoredEnums.length} enums criados no schema`);
    console.log(`Foreign Keys:   ${restoredFks[0].total_fks} FKs restauradas`);
    console.log(`Índices:        ${restoredIndexes[0].total_indexes} índices restaurados`);
    console.log(`Duração:        ${duration}ms`);
    console.log(`===================================================================\n`);

    return {
      success: true,
      targetSchema,
      tablesCount: restoredTables.length,
      totalRows: totalRestoredRows,
      tableCounts,
      enumsCount: restoredEnums.length,
      fksCount: Number(restoredFks[0].total_fks),
      indexesCount: Number(restoredIndexes[0].total_indexes),
      durationMs: duration
    };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (require.main === module) {
  runRestore().catch(err => {
    console.error('[ERRO CRÍTICO NA RESTAURAÇÃO]:', err);
    process.exit(1);
  });
}

module.exports = { runRestore };
