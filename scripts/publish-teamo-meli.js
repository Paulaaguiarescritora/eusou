const { NestFactory } = require('../backend/node_modules/@nestjs/core');
const { AppModule } = require('../backend/dist/app.module');
const { MarketplaceService } = require('../backend/dist/marketplace/marketplace.service');
const { PrismaService } = require('../backend/dist/prisma.service');

async function main() {
  console.log('Inicializando contexto NestJS para publicação do Kit Te Amo...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const marketplaceService = app.get(MarketplaceService);
  const prisma = app.get(PrismaService);

  const productId = 'd6847eee-6db9-4c92-b1da-b4129d7aa894';
  const channelAccountId = 'f388287b-6577-498a-b767-4aea812c057b';

  console.log('Publicando Kit Carimbos Te Amo no Mercado Livre Oficial...');
  const result = await marketplaceService.publishProduct(
    {
      productId,
      channelAccountId,
      priceOverride: 18.90
    },
    'system-admin'
  );

  console.log('\n================ RESULTADO DA PUBLICAÇÃO ================');
  console.log('Sucesso:', result.result.success);
  console.log('Status do Anúncio:', result.channelProduct.status);
  console.log('ID no Mercado Livre (MLB):', result.channelProduct.externalProductId);
  console.log('Link Oficial (Permalink):', result.channelProduct.externalUrl);
  if (result.result.message) {
    console.log('Mensagem:', result.result.message);
  }
  if (result.result.rawResponse) {
    console.log('Preço publicado:', result.result.rawResponse.price);
    console.log('Status no MeLi:', result.result.rawResponse.status);
    console.log('Sub-status no MeLi:', result.result.rawResponse.sub_status);
    console.log('Total de fotos enviadas:', result.result.rawResponse.pictures?.length);
  }

  await app.close();
}

main().catch(err => {
  console.error('Erro na publicação:', err);
  process.exit(1);
});
