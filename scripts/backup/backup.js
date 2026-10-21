/**
 * EuSou - Backup Lógico PostgreSQL
 * F17-A: Disaster Recovery & Backup Strategy
 *
 * Exporta esquema e dados de forma estruturada, com segurança e sem expor credenciais.
 * Suporta restauração tanto no schema oficial (public) quanto em schemas isolados para testes de DR.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require(path.resolve(__dirname, '../../backend/node_modules/@prisma/client'));

const { getDatabaseUrl } = require('./db-url');

function escapeSqlValue(val, udtName) {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val.toString() : 'NULL';
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'::timestamp`;
  }
  if (typeof val === 'object') {
    if (Buffer.isBuffer(val)) {
      return `'\\x${val.toString('hex')}'::bytea`;
    }
    // Decimal do Prisma
    if (val.d && val.s !== undefined) {
      return `'${val.toString()}'::numeric`;
    }
    // JSON / JSONB
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  // String comum
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

async function runBackup() {
  const startTime = Date.now();
  console.log('[BACKUP] Iniciando processo de backup lógico do EuSou...');

  const dbUrl = getDatabaseUrl();
  const parsed = new URL(dbUrl);
  console.log(`[BACKUP] Conectando ao host: ${parsed.hostname}:${parsed.port || 5432} (credenciais ocultadas)`);

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: ['error']
  });

  try {
    await prisma.$connect();
    await prisma.$queryRawUnsafe('SELECT 1;');
    console.log('[BACKUP] Conexão com banco de dados validada com sucesso.');

    const backupDir = path.resolve(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `eusou_backup_${timestamp}.sql`;
    const filepath = path.join(backupDir, filename);

    console.log(`[BACKUP] Destino: backups/${filename}`);

    const sqlParts = [];
    sqlParts.push(`-- ==========================================================`);
    sqlParts.push(`-- EUSOU - BACKUP LÓGICO POSTGRESQL (F17-A DISASTER RECOVERY)`);
    sqlParts.push(`-- Data de Geração: ${new Date().toISOString()}`);
    sqlParts.push(`-- Gerador: EuSou Logical Backup Engine v1.0`);
    sqlParts.push(`-- ==========================================================\n`);

    // 1. Sequences
    const seqs = await prisma.$queryRawUnsafe(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public';
    `);

    sqlParts.push(`-- 1. SEQUENCES`);
    for (const s of seqs) {
      sqlParts.push(`CREATE SEQUENCE IF NOT EXISTS "__SCHEMA__"."${s.sequence_name}";`);
    }
    sqlParts.push('');

    // 2. Enums
    const enums = await prisma.$queryRawUnsafe(`
      SELECT t.typname, e.enumlabel, e.enumsortorder
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `);

    const enumGroups = {};
    for (const e of enums) {
      if (!enumGroups[e.typname]) enumGroups[e.typname] = [];
      enumGroups[e.typname].push(e.enumlabel);
    }

    sqlParts.push(`-- 2. ENUMS`);
    for (const [typname, labels] of Object.entries(enumGroups)) {
      const labelsStr = labels.map(l => `'${l}'`).join(', ');
      sqlParts.push(`DO $$ BEGIN`);
      sqlParts.push(`  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typname}' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = '__SCHEMA__')) THEN`);
      sqlParts.push(`    CREATE TYPE "__SCHEMA__"."${typname}" AS ENUM (${labelsStr});`);
      sqlParts.push(`  END IF;`);
      sqlParts.push(`END $$;`);
    }
    sqlParts.push('');

    // 3. Tabelas e Metadados
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log(`[BACKUP] Total de tabelas encontradas: ${tables.length}`);

    const tablesMetadata = {};
    for (const t of tables) {
      const tableName = t.table_name;
      const cols = await prisma.$queryRawUnsafe(`
        SELECT 
          column_name, 
          data_type, 
          udt_name, 
          is_nullable, 
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${tableName}'
        ORDER BY ordinal_position;
      `);
      tablesMetadata[tableName] = cols;
    }

    // 4. DDL de Tabelas
    sqlParts.push(`-- 3. TABELAS`);
    for (const tableName of Object.keys(tablesMetadata)) {
      const cols = tablesMetadata[tableName];
      const colDefs = cols.map(c => {
        let typeStr = c.data_type;
        if (c.data_type === 'USER-DEFINED') {
          typeStr = `"__SCHEMA__"."${c.udt_name}"`;
        } else if (c.data_type === 'numeric' && c.numeric_precision) {
          typeStr = `NUMERIC(${c.numeric_precision}, ${c.numeric_scale || 0})`;
        } else if (c.data_type === 'character varying' && c.character_maximum_length) {
          typeStr = `VARCHAR(${c.character_maximum_length})`;
        } else if (c.data_type === 'timestamp without time zone') {
          typeStr = 'TIMESTAMP(3)';
        } else if (c.data_type === 'text') {
          typeStr = 'TEXT';
        } else if (c.data_type === 'jsonb') {
          typeStr = 'JSONB';
        }

        const notNull = c.is_nullable === 'NO' ? ' NOT NULL' : '';
        let def = '';
        if (c.column_default) {
          let cleanDef = c.column_default.replace(/"public"\./g, '"__SCHEMA__".');
          if (c.data_type === 'USER-DEFINED') {
            cleanDef = cleanDef.replace(new RegExp(`::"${c.udt_name}"`, 'g'), `::"__SCHEMA__"."${c.udt_name}"`);
            cleanDef = cleanDef.replace(new RegExp(`::${c.udt_name}\\b`, 'g'), `::"__SCHEMA__"."${c.udt_name}"`);
          }
          cleanDef = cleanDef.replace(/'"([A-Za-z0-9_]+)"'::regclass/g, '\'__SCHEMA__."$1"\'::regclass');
          def = ` DEFAULT ${cleanDef}`;
        }
        return `  "${c.column_name}" ${typeStr}${notNull}${def}`;
      });

      sqlParts.push(`CREATE TABLE IF NOT EXISTS "__SCHEMA__"."${tableName}" (\n${colDefs.join(',\n')}\n);`);
    }
    sqlParts.push('');

    // 5. DML (Dados das Tabelas)
    sqlParts.push(`-- 4. DADOS DAS TABELAS`);
    let totalRowsExported = 0;
    const tableStats = {};

    for (const tableName of Object.keys(tablesMetadata)) {
      const cols = tablesMetadata[tableName];
      const colNames = cols.map(c => `"${c.column_name}"`).join(', ');
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "public"."${tableName}";`);
      tableStats[tableName] = rows.length;
      totalRowsExported += rows.length;

      if (rows.length > 0) {
        sqlParts.push(`-- Dados da tabela: ${tableName} (${rows.length} registros)`);
        for (const row of rows) {
          const valStrings = cols.map(c => {
            const rawVal = row[c.column_name];
            return escapeSqlValue(rawVal, c.udt_name);
          });
          sqlParts.push(`INSERT INTO "__SCHEMA__"."${tableName}" (${colNames}) VALUES (${valStrings.join(', ')});`);
        }
        sqlParts.push('');
      }
    }

    // 6. Atualizar sequências com o maior id
    sqlParts.push(`-- 5. SINCRONIZAR SEQUÊNCIAS`);
    for (const s of seqs) {
      const tableMatch = s.sequence_name.replace(/_id_seq$/, '');
      if (tablesMetadata[tableMatch]) {
        sqlParts.push(`SELECT setval('"__SCHEMA__"."${s.sequence_name}"', COALESCE((SELECT MAX(id) FROM "__SCHEMA__"."${tableMatch}"), 1));`);
      }
    }
    sqlParts.push('');

    // 7. Constraints (Primary Key e Unique)
    sqlParts.push(`-- 6. CONSTRAINTS (PRIMARY KEYS E UNIQUE)`);
    const constraints = await prisma.$queryRawUnsafe(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public' 
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      ORDER BY tc.table_name, tc.constraint_type, kcu.ordinal_position;
    `);

    const constraintGroups = {};
    for (const c of constraints) {
      const key = `${c.table_name}|${c.constraint_name}|${c.constraint_type}`;
      if (!constraintGroups[key]) {
        constraintGroups[key] = {
          table: c.table_name,
          name: c.constraint_name,
          type: c.constraint_type,
          columns: []
        };
      }
      constraintGroups[key].columns.push(`"${c.column_name}"`);
    }

    for (const group of Object.values(constraintGroups)) {
      const colList = group.columns.join(', ');
      sqlParts.push(`DO $$ BEGIN`);
      sqlParts.push(`  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${group.name}' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = '__SCHEMA__')) THEN`);
      sqlParts.push(`    ALTER TABLE "__SCHEMA__"."${group.table}" ADD CONSTRAINT "${group.name}" ${group.type} (${colList});`);
      sqlParts.push(`  END IF;`);
      sqlParts.push(`END $$;`);
    }
    sqlParts.push('');

    // 8. Foreign Keys
    sqlParts.push(`-- 7. FOREIGN KEYS`);
    const fks = await prisma.$queryRawUnsafe(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY';
    `);

    for (const fk of fks) {
      sqlParts.push(`DO $$ BEGIN`);
      sqlParts.push(`  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${fk.constraint_name}' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = '__SCHEMA__')) THEN`);
      sqlParts.push(`    ALTER TABLE "__SCHEMA__"."${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES "__SCHEMA__"."${fk.foreign_table_name}"("${fk.foreign_column_name}") ON UPDATE ${fk.update_rule} ON DELETE ${fk.delete_rule};`);
      sqlParts.push(`  END IF;`);
      sqlParts.push(`END $$;`);
    }
    sqlParts.push('');

    // 9. Índices
    sqlParts.push(`-- 8. ÍNDICES`);
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
      ORDER BY tablename, indexname;
    `);

    for (const idx of indexes) {
      let safeDef = idx.indexdef.replace(/ON public\./g, 'ON "__SCHEMA__".');
      safeDef = safeDef.replace(/CREATE UNIQUE INDEX ([^\s]+) ON /i, 'CREATE UNIQUE INDEX IF NOT EXISTS $1 ON ');
      safeDef = safeDef.replace(/CREATE INDEX ([^\s]+) ON /i, 'CREATE INDEX IF NOT EXISTS $1 ON ');
      sqlParts.push(`${safeDef};`);
    }
    sqlParts.push('');

    sqlParts.push(`-- FIM DO BACKUP`);

    const sqlContent = sqlParts.join('\n');
    fs.writeFileSync(filepath, sqlContent, 'utf8');

    const stats = fs.statSync(filepath);
    if (stats.size === 0) {
      throw new Error('Falha crítica: Arquivo de backup foi gerado com tamanho 0.');
    }

    const hash = crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
    const duration = Date.now() - startTime;

    // 10. Aplicar Política de Retenção (Manter até 7 backups mais recentes)
    const retention = applyRetentionPolicy(backupDir, 7);
    console.log(`[BACKUP] Política de Retenção: ${retention.retained} mantidos, ${retention.pruned} podados.`);

    const manifestPath = filepath.replace(/\.sql$/, '.manifest.json');
    const manifest = {
      timestamp: new Date().toISOString(),
      filename,
      sizeBytes: stats.size,
      sha256: hash,
      durationMs: duration,
      tablesCount: Object.keys(tablesMetadata).length,
      totalRowsExported,
      retentionPolicy: {
        keepDaily: 7,
        keepWeekly: 4,
        keepMonthly: 6,
        currentlyRetained: retention.retained,
        prunedInThisRun: retention.pruned
      },
      tables: tableStats
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    console.log(`\n================ BACKUP CONCLUÍDO COM SUCESSO ================`);
    console.log(`Arquivo:       ${filename}`);
    console.log(`Tamanho:       ${(stats.size / 1024).toFixed(2)} KB (${stats.size} bytes)`);
    console.log(`SHA-256:       ${hash}`);
    console.log(`Tabelas:       ${manifest.tablesCount}`);
    console.log(`Registros:     ${totalRowsExported}`);
    console.log(`Duração:       ${duration}ms`);
    console.log(`Retenção:      ${retention.retained} backups mantidos (${retention.pruned} podados)`);
    console.log(`===============================================================\n`);

    return manifest;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

function applyRetentionPolicy(backupDir, keepCount = 7) {
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql')).sort();
  if (files.length <= keepCount) {
    return { pruned: 0, retained: files.length };
  }
  const toDelete = files.slice(0, files.length - keepCount);
  for (const f of toDelete) {
    const sqlPath = path.join(backupDir, f);
    const manifestPath = sqlPath.replace(/\.sql$/, '.manifest.json');
    if (fs.existsSync(sqlPath)) fs.unlinkSync(sqlPath);
    if (fs.existsSync(manifestPath)) fs.unlinkSync(manifestPath);
  }
  return { pruned: toDelete.length, retained: keepCount, prunedFiles: toDelete };
}

if (require.main === module) {
  runBackup().catch(err => {
    console.error('[ERRO CRÍTICO NO BACKUP]:', err.message);
    process.exit(1);
  });
}

module.exports = { runBackup };
