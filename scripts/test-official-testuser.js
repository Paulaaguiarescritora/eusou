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

async function testWithRealTestUser() {
  const buyerUser = 'TESTUSER2075401606';
  // Formatos possíveis de email de test user no Mercado Pago
  const emailsToTest = [
    `${buyerUser}@testuser.com`,
    `test_user_${buyerUser.replace(/\D/g, '')}@testuser.com`
  ];

  for (const email of emailsToTest) {
    console.log(`\n========================================`);
    console.log(`Testando PIX com email: ${email}`);
    console.log(`========================================`);

    const payload = {
      transaction_amount: 10.00,
      description: "Teste Oficial Homologacao F16-B PIX",
      payment_method_id: "pix",
      payer: {
        email: email,
        first_name: "Comprador",
        last_name: "Teste",
        identification: {
          type: "CPF",
          number: "19119119100"
        }
      }
    };

    const idempotencyKey = 'test-official-pix-' + Date.now();

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
    console.log('Payment ID:', data?.id);
    console.log('Status Mercado Pago:', data?.status);
    console.log('Status Detail:', data?.status_detail);
    if (data?.point_of_interaction?.transaction_data) {
      console.log('PIX QR Code gerado:', Boolean(data.point_of_interaction.transaction_data.qr_code));
    }
    if (status >= 400) {
      console.log('Erro retornado:', JSON.stringify(data, null, 2));
    }
  }
}

testWithRealTestUser().catch(e => console.error(e));
