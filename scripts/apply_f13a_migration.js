const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '..', 'backend', 'node_modules', '@prisma/client'));
const fs = require('fs');
const crypto = require('crypto');

async function applyF13AMigration() {
  const prisma = new PrismaClient();
  try {
    console.log('Connecting to database...');
    const migrationName = '20261010000000_create_f13a_marketplace_hub_core';
    
    // Check if migration is already recorded
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, migration_name, finished_at FROM _prisma_migrations WHERE migration_name = $1`,
      migrationName
    );
    
    if (existing && existing.length > 0 && existing[0].finished_at) {
      console.log(`Migration ${migrationName} is already applied!`);
      return;
    }

    const migrationSqlPath = path.join(__dirname, '..', 'backend', 'prisma', 'migrations', migrationName, 'migration.sql');
    const sqlContent = fs.readFileSync(migrationSqlPath, 'utf8');

    console.log(`Executing migration SQL statements...`);
    // Split into individual SQL statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.startsWith('--')) {
        // May contain comments followed by statement
        const cleanStmt = stmt.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim();
        if (!cleanStmt) continue;
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await prisma.$executeRawUnsafe(cleanStmt);
      } else {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await prisma.$executeRawUnsafe(stmt);
      }
    }

    console.log('Recording migration in _prisma_migrations...');
    const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');
    const migrationId = crypto.randomUUID();
    const now = new Date();

    await prisma.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      migrationId,
      checksum,
      now,
      migrationName,
      null,
      null,
      now,
      statements.length
    );

    console.log(`Migration ${migrationName} successfully applied and recorded!`);
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyF13AMigration();
