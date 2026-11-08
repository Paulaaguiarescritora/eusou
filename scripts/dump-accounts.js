const fs = require('fs');
const path = require('path');
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

async function run() {
  const accounts = await prisma.channelAccount.findMany({
    include: { channel: true }
  });
  for (const a of accounts) {
    console.log('Account ID:', a.id, 'Channel:', a.channel.type, 'Status:', a.status);
    console.log('Config:', JSON.stringify(a.configuration, null, 2));
  }
  await prisma.$disconnect();
}
run();
