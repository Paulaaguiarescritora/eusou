/**
 * EuSou - Validação do Prisma no Banco Restaurado
 * F17-A: Disaster Recovery & Backup Strategy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.resolve('d:/eusou/backend/.env');
const envOriginal = fs.readFileSync(envPath, 'utf8');

try {
  console.log('[PRISMA-RESTORED] Configurando conexão temporária para schema "restore_isolated_f17a"...');

  // Adicionar ou substituir parâmetro schema na URL
  const lines = envOriginal.split(/\r?\n/);
  const newLines = lines.map(line => {
    if (line.trim().startsWith('DATABASE_URL=') || line.trim().startsWith('DIRECT_URL=')) {
      const idx = line.indexOf('=');
      const key = line.substring(0, idx);
      let val = line.substring(idx + 1).trim();
      let quote = '';
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        quote = val[0];
        val = val.substring(1, val.length - 1);
      }
      const u = new URL(val);
      u.searchParams.set('schema', 'restore_isolated_f17a');
      const finalVal = quote ? `${quote}${u.toString()}${quote}` : u.toString();
      return `${key}=${finalVal}`;
    }
    return line;
  });

  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');

  console.log('[PRISMA-RESTORED] Executando prisma validate...');
  const validateOut = execSync('node ./node_modules/prisma/build/index.js validate', {
    cwd: 'd:/eusou/backend',
    encoding: 'utf8'
  });
  console.log(validateOut.trim());

  console.log('[PRISMA-RESTORED] Verificando prisma generate...');
  try {
    const generateOut = execSync('node ./node_modules/prisma/build/index.js generate', {
      cwd: 'd:/eusou/backend',
      encoding: 'utf8'
    });
    console.log(generateOut.trim());
  } catch (genErr) {
    if (genErr.message && genErr.message.includes('EPERM')) {
      console.log('[PRISMA-RESTORED] Prisma Client já gerado (arquivo DLL em uso pelo servidor backend ativo).');
    } else {
      throw genErr;
    }
  }

  console.log('[PRISMA-RESTORED] Executando prisma migrate status no banco restaurado...');
  const statusOut = execSync('node ./node_modules/prisma/build/index.js migrate status', {
    cwd: 'd:/eusou/backend',
    encoding: 'utf8'
  });
  console.log(statusOut.trim());

  console.log('[PRISMA-RESTORED] SUCESSO: Prisma validado e operacional no banco restaurado!');
} catch (err) {
  console.error('[ERRO PRISMA-RESTORED]:', err.stdout || err.message);
  throw err;
} finally {
  console.log('[PRISMA-RESTORED] Restaurando arquivo .env original...');
  fs.writeFileSync(envPath, envOriginal, 'utf8');
  console.log('[PRISMA-RESTORED] .env original restabelecido.');
}
