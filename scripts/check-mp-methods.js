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

async function checkPaymentMethods() {
  const res = await fetch('https://api.mercadopago.com/v1/payment_methods', {
    headers: { Authorization: 'Bearer ' + token }
  });
  console.log('Status /v1/payment_methods:', res.status);
  const data = await res.json();
  console.log('Payment methods count:', Array.isArray(data) ? data.length : 'not array');
  if (Array.isArray(data)) {
    const pix = data.find(m => m.id === 'pix');
    console.log('PIX method details:', pix);
    const cc = data.filter(m => m.payment_type_id === 'credit_card').map(m => m.id);
    console.log('Credit card methods:', cc);
  } else {
    console.log('Data:', data);
  }
}

checkPaymentMethods().catch(e => console.error(e));
