const fs = require('fs');
const path = require('path');

function getDatabaseUrl() {
  if (process.env.DIRECT_URL && process.env.DIRECT_URL.trim()) {
    return process.env.DIRECT_URL.trim();
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return process.env.DATABASE_URL.trim();
  }

  const envPath = path.resolve(__dirname, '../../backend/.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    const directLine = lines.find(l => l.trim().startsWith('DIRECT_URL='));
    const dbLine = lines.find(l => l.trim().startsWith('DATABASE_URL='));
    
    const chosenLine = directLine || dbLine;
    if (chosenLine) {
      let val = chosenLine.substring(chosenLine.indexOf('=') + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      return val;
    }
  }

  throw new Error('Nenhuma URL de banco encontrada em DIRECT_URL, DATABASE_URL ou no arquivo backend/.env');
}

module.exports = { getDatabaseUrl };
