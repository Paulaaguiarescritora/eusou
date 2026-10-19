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

async function testPixVariations() {
  const variations = [
    {
      name: 'V1: Pix sem Identification (apenas email)',
      payload: {
        transaction_amount: 10.00,
        description: 'Teste V1',
        payment_method_id: 'pix',
        payer: {
          email: 'test_user_123456@testuser.com'
        }
      }
    },
    {
      name: 'V2: Pix com Identification + Nome completo',
      payload: {
        transaction_amount: 10.00,
        description: 'Teste V2',
        payment_method_id: 'pix',
        payer: {
          email: 'test_user_123456@testuser.com',
          first_name: 'Comprador',
          last_name: 'Teste',
          identification: {
            type: 'CPF',
            number: '19119119100'
          }
        }
      }
    },
    {
      name: 'V3: Pix com additional_info items e payer',
      payload: {
        transaction_amount: 10.00,
        description: 'Teste V3',
        payment_method_id: 'pix',
        additional_info: {
          items: [
            {
              id: 'item-1',
              title: 'Produto Teste',
              quantity: 1,
              unit_price: 10.00
            }
          ]
        },
        payer: {
          email: 'test_user_123456@testuser.com',
          first_name: 'Comprador',
          last_name: 'Teste',
          identification: {
            type: 'CPF',
            number: '19119119100'
          }
        }
      }
    }
  ];

  for (const v of variations) {
    console.log(`\n--- Testando ${v.name} ---`);
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': 'var-' + Date.now() + '-' + Math.random()
      },
      body: JSON.stringify(v.payload)
    });

    console.log('HTTP Status:', res.status);
    console.log('x-request-id:', res.headers.get('x-request-id'));
    const body = await res.json().catch(() => null);
    console.log('Body:', JSON.stringify(body));
  }
}

testPixVariations().catch(e => console.error(e));
