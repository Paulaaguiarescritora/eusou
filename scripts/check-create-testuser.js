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

async function checkCreateUser() {
  const res = await fetch('https://api.mercadopago.com/users/test_user', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ site_id: 'MLB' })
  });
  console.log('Status /users/test_user:', res.status);
  const text = await res.text();
  console.log('Body:', text);
}

checkCreateUser().catch(e => console.error(e));
