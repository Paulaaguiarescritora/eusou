const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.resolve(__dirname, '../backend/.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const parts = line.trim().split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').replace(/["']/g, '').trim();
    env[key] = val;
  }
}

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasourceUrl: env.DIRECT_URL });

function decrypt(ciphertext, key) {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(dataHex, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function encrypt(text, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'utf8'), iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc}`;
}

async function getValidToken() {
  const account = await prisma.channelAccount.findFirst({
    where: { channel: { type: 'MERCADO_LIVRE' } }
  });
  const encKey = env.MERCADOLIVRE_ENCRYPTION_KEY || '12345678901234567890123456789012';
  const config = account.configuration;
  
  let accessToken = '';
  if (config.encAccessToken) {
    try {
      accessToken = decrypt(config.encAccessToken, encKey);
    } catch (e) {
      console.log('Error decrypting accessToken:', e.message);
    }
  }

  const expiresAt = new Date(config.expiresAt || 0);
  const isExpired = Date.now() >= expiresAt.getTime() - 60000;
  console.log('Token expiresAt:', expiresAt, 'Is expired?', isExpired);

  if (isExpired && config.encRefreshToken) {
    console.log('Refreshing token...');
    const refreshToken = decrypt(config.encRefreshToken, encKey);
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.MERCADOLIVRE_CLIENT_ID,
      client_secret: env.MERCADOLIVRE_CLIENT_SECRET,
      refresh_token: refreshToken
    });
    const resp = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('Failed to refresh token:', data);
      return accessToken;
    }
    console.log('Token refreshed successfully! Expires in:', data.expires_in);
    accessToken = data.access_token;
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    const updatedConfig = {
      ...config,
      encAccessToken: encrypt(data.access_token, encKey),
      encRefreshToken: encrypt(data.refresh_token, encKey),
      expiresAt: newExpiresAt.toISOString(),
      lastRefreshedAt: new Date().toISOString()
    };
    await prisma.channelAccount.update({
      where: { id: account.id },
      data: { configuration: updatedConfig }
    });
  }

  return accessToken;
}

async function checkItem(token, itemId) {
  const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`\n================ Item ${itemId}: ${data.title} ================`);
  console.log(`Status: ${data.status} | Total Stock: ${data.available_quantity} | Price: ${data.price}`);
  if (data.variations && data.variations.length > 0) {
    console.log(`Variações no Mercado Livre (${data.variations.length}):`);
    for (const v of data.variations) {
      const attrs = (v.attribute_combinations || []).map(a => `${a.name}: ${a.value_name}`).join(', ');
      console.log(`  - ID: ${v.id} | Atributos: [${attrs}] | Qtd: ${v.available_quantity} | SKU: ${v.seller_custom_field || 'N/A'}`);
    }
  } else {
    console.log('Sem variações cadastradas (anúncio simples).');
  }
}

async function main() {
  const token = await getValidToken();
  if (token) {
    await checkItem(token, 'MLB5505899587'); // Kit Doguinho
    await checkItem(token, 'MLB5505908459'); // Catnip Roscado
    await checkItem(token, 'MLB7921219190'); // Rato articulado
  }
  await prisma.$disconnect();
}
main();
