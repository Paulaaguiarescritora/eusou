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

async function checkAccountPix() {
  const res = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  console.log('User status:', data.status);
  console.log('User tags:', data.tags);
  console.log('User points:', data.points);
}
checkAccountPix().catch(e => console.error(e));
