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

async function checkAccount() {
  const res = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Status /users/me:', res.status);
  const data = await res.json();
  console.log('User id:', data.id);
  console.log('Site id:', data.site_id);
  console.log('Country id:', data.country_id);
  console.log('Nickname:', data.nickname);
  console.log('Email:', data.email ? data.email.replace(/(.{3})(.*)(@.*)/, '$1***$3') : null);
}

checkAccount().catch(e => console.error(e));
