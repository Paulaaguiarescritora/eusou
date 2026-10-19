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

async function testTestUserPix() {
  // Cria um usuário de teste comprador
  console.log('1. Criando usuário de teste comprador no Mercado Pago...');
  const createPayerRes = await fetch('https://api.mercadopago.com/users/test_user', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ site_id: 'MLB' })
  });

  const testUser = await createPayerRes.json();
  console.log('Comprador teste criado:', testUser.id, testUser.email);

  // Tenta chamar o PIX usando o email do usuário de teste
  console.log('2. Chamando POST /v1/payments com o usuário de teste...');
  const pixRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': 'pix-testuser-' + Date.now()
    },
    body: JSON.stringify({
      transaction_amount: 10.00,
      description: 'Teste PIX com Test User',
      payment_method_id: 'pix',
      payer: {
        email: testUser.email || 'test_user_12345@testuser.com',
        first_name: 'Test',
        last_name: 'User',
        identification: {
          type: 'CPF',
          number: '19119119100'
        }
      }
    })
  });

  console.log('HTTP Status PIX:', pixRes.status);
  console.log('x-request-id:', pixRes.headers.get('x-request-id'));
  const pixData = await pixRes.json();
  console.log('Response:', JSON.stringify(pixData, null, 2));
}

testTestUserPix().catch(e => console.error(e));
