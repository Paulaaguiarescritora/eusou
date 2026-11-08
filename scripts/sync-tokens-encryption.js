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
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: env.DIRECT_URL });

function getEncryptionKey() {
  const rawKey = env.MERCADOLIVRE_ENCRYPTION_KEY || env.JWT_SECRET || 'fallback-secret-key-32-chars-long!!';
  return crypto.createHash('sha256').update(rawKey).digest();
}

function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    tag: tag.toString('hex')
  };
}

async function fixCredentials() {
  const acc = await prisma.channelAccount.findUnique({
    where: { id: 'f388287b-6577-498a-b767-4aea812c057b' }
  });
  const currentRefreshToken = acc.configuration.refreshToken;
  console.log('Refreshing token using:', currentRefreshToken);

  const resRefresh = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.MERCADOLIVRE_CLIENT_ID,
      client_secret: env.MERCADOLIVRE_CLIENT_SECRET,
      refresh_token: currentRefreshToken
    })
  });
  const data = await resRefresh.json();
  if (!resRefresh.ok) {
    console.error('Refresh error:', data);
    return;
  }

  console.log('Got fresh token! Validating with /users/me...');
  const meRes = await fetch('https://api.mercadolibre.com/users/me', {
    headers: { Authorization: `Bearer ${data.access_token}` }
  });
  const me = await meRes.json();
  console.log('MeLi User:', me.id, me.nickname);

  const encAccess = encrypt(data.access_token);
  const encRefresh = encrypt(data.refresh_token);

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await prisma.channelAccount.update({
    where: { id: acc.id },
    data: {
      configuration: {
        ...acc.configuration,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        encAccessToken: encAccess,
        encRefreshToken: encRefresh,
        expiresAt: expiresAt,
        lastRefreshedAt: new Date().toISOString()
      }
    }
  });

  console.log('ChannelAccount configuration updated and re-encrypted successfully!');
  await prisma.$disconnect();
}
fixCredentials().catch(console.error);
