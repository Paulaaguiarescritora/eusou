const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../backend/.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
let token = '';

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('MERCADOPAGO_ACCESS_TOKEN=')) {
    token = trimmed.split('=')[1].replace(/["']/g, '').trim();
  }
}

async function checkAccountDetails() {
  console.log('1. Verificando /v1/account/pix/keys ...');
  try {
    const r1 = await fetch('https://api.mercadopago.com/v1/account/pix/keys', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('Pix keys:', r1.status, await r1.text());
  } catch (e) {
    console.log('Pix keys err:', e.message);
  }

  console.log('2. Verificando /v1/identification_types ...');
  try {
    const r2 = await fetch('https://api.mercadopago.com/v1/identification_types', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('ID types:', r2.status, await r2.json());
  } catch (e) {
    console.log('ID types err:', e.message);
  }
}

checkAccountDetails().catch(e => console.error(e));
