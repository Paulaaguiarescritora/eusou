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

async function testPix() {
  const payload = {
    transaction_amount: 10.00,
    description: "Teste de Homologacao F16-B PIX",
    payment_method_id: "pix",
    payer: {
      email: "test_user_123456@testuser.com",
      first_name: "Test",
      last_name: "User",
      identification: {
        type: "CPF",
        number: "19119119100"
      }
    }
  };

  const idempotencyKey = 'test-pix-' + Date.now();

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  const xRequestId = res.headers.get('x-request-id');
  const status = res.status;
  const data = await res.json().catch(() => null);

  console.log('HTTP Status:', status);
  console.log('x-request-id:', xRequestId);
  console.log('Response Status:', data ? data.status : null);
  console.log('Response Detail:', data ? data.status_detail : null);
  console.log('Payment ID:', data ? data.id : null);
  if (data && data.point_of_interaction) {
    console.log('PIX QR Code exists:', Boolean(data.point_of_interaction.transaction_data?.qr_code));
  }
  if (status >= 400) {
    console.log('Error Data:', JSON.stringify(data, null, 2));
  }
}

testPix().catch(e => console.error(e));
