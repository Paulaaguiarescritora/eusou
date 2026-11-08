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
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: env.DIRECT_URL });

async function setupMultiStore() {
  console.log('=== 1. Atualizando marcas e descrições dos Nichos ===');
  
  // 1. Felinodélia
  const petNiche = await prisma.niche.update({
    where: { slug: 'pet-shop' },
    data: {
      brandName: 'Felinodélia',
      description: 'Design inovador, brinquedos interativos e acessórios exclusivos para cães e gatos.'
    }
  });
  console.log('Pet Niche atualizado:', petNiche.brandName);

  // 2. Romance
  const romanceNiche = await prisma.niche.update({
    where: { slug: 'romance' },
    data: {
      name: 'Romance',
      brandName: 'Romance',
      description: 'Carimbos marcadores e cortadores para confeitaria artesanal, brigadeiros gourmet e biscoitos.'
    }
  });
  console.log('Romance Niche atualizado:', romanceNiche.brandName);

  // 3. Sensora Íntima
  const intimaNiche = await prisma.niche.update({
    where: { slug: 'sensora-intima' },
    data: {
      brandName: 'Sensora Íntima',
      description: 'Linha exclusiva de autocuidado, bem-estar íntimo e experiências sensoriais.'
    }
  });
  console.log('Sensora Íntima Niche atualizado:', intimaNiche.brandName);

  console.log('\n=== 2. Configurando Catálogos por Loja ===');
  // Atribuir nicho aos catálogos pet existentes
  await prisma.catalog.updateMany({
    where: { slug: { in: ['vitrine-pet-design', 'catalogo-inteligente-pet', 'vitrine-pet-design-copia'] } },
    data: { nicheId: petNiche.id }
  });
  console.log('Catálogos Pet associados ao Nicho Pet.');

  // Criar ou atualizar catálogo Romance
  let romanceCatalog = await prisma.catalog.findFirst({
    where: { slug: 'catalogo-confeitaria-romance' }
  });
  if (!romanceCatalog) {
    romanceCatalog = await prisma.catalog.create({
      data: {
        name: 'Catálogo Confeitaria Romance',
        slug: 'catalogo-confeitaria-romance',
        description: 'Linha completa de carimbos marcadores e cortadores para brigadeiros e doces decorados.',
        type: 'MANUAL',
        status: 'ACTIVE',
        nicheId: romanceNiche.id
      }
    });
    console.log('Catálogo Romance criado:', romanceCatalog.id);
  } else {
    romanceCatalog = await prisma.catalog.update({
      where: { id: romanceCatalog.id },
      data: {
        name: 'Catálogo Confeitaria Romance',
        description: 'Linha completa de carimbos marcadores e cortadores para brigadeiros e doces decorados.',
        status: 'ACTIVE',
        nicheId: romanceNiche.id
      }
    });
    console.log('Catálogo Romance atualizado:', romanceCatalog.id);
  }

  // Associar os 3 produtos Romance ao catálogo Romance
  const romanceProducts = await prisma.product.findMany({
    where: { niches: { some: { nicheId: romanceNiche.id } } }
  });
  console.log(`Associando ${romanceProducts.length} produtos ao Catálogo Romance...`);
  for (let i = 0; i < romanceProducts.length; i++) {
    const prod = romanceProducts[i];
    const exists = await prisma.catalogItem.findFirst({
      where: { catalogId: romanceCatalog.id, productId: prod.id }
    });
    if (!exists) {
      await prisma.catalogItem.create({
        data: {
          catalogId: romanceCatalog.id,
          productId: prod.id,
          position: i + 1
        }
      });
    }
  }

  // Criar ou atualizar catálogo Sensora Íntima
  let intimaCatalog = await prisma.catalog.findFirst({
    where: { slug: 'catalogo-sensora-intima' }
  });
  if (!intimaCatalog) {
    intimaCatalog = await prisma.catalog.create({
      data: {
        name: 'Catálogo Sensora Íntima',
        slug: 'catalogo-sensora-intima',
        description: 'Catálogo oficial de bem-estar, autocuidado e rotinas sensoriais Sensora Íntima.',
        type: 'MANUAL',
        status: 'ACTIVE',
        nicheId: intimaNiche.id
      }
    });
    console.log('Catálogo Sensora Íntima criado:', intimaCatalog.id);
  } else {
    intimaCatalog = await prisma.catalog.update({
      where: { id: intimaCatalog.id },
      data: {
        status: 'ACTIVE',
        nicheId: intimaNiche.id
      }
    });
    console.log('Catálogo Sensora Íntima atualizado:', intimaCatalog.id);
  }

  console.log('\n=== 3. Atualizando Preço da Loja Própria dos Produtos Romance para R$ 18,90 ===');
  const ownStore = await prisma.channel.findFirst({ where: { type: 'OWN_STORE' } });
  if (ownStore) {
    for (const prod of romanceProducts) {
      // 1. Garantir que ProductChannel está habilitado
      const pc = await prisma.productChannel.findFirst({
        where: { productId: prod.id, channelId: ownStore.id }
      });
      if (!pc) {
        await prisma.productChannel.create({
          data: { productId: prod.id, channelId: ownStore.id, isEnabled: true }
        });
      } else if (!pc.isEnabled) {
        await prisma.productChannel.update({
          where: { id: pc.id },
          data: { isEnabled: true }
        });
      }

      // 2. Garantir que ProductChannelPrice está em 18.90
      const pcp = await prisma.productChannelPrice.findFirst({
        where: { productId: prod.id, channelId: ownStore.id, variantId: null }
      });
      if (pcp) {
        await prisma.productChannelPrice.update({
          where: { id: pcp.id },
          data: {
            mode: 'MANUAL',
            manualPrice: 18.90,
            effectivePrice: 18.90
          }
        });
      } else {
        await prisma.productChannelPrice.create({
          data: {
            productId: prod.id,
            channelId: ownStore.id,
            mode: 'MANUAL',
            manualPrice: 18.90,
            effectivePrice: 18.90
          }
        });
      }
    }
    console.log('Preço de R$ 18,90 e canal Loja Própria configurados para os 3 produtos de Romance!');
  }

  // 4. Criar categorias para Sensora Íntima se não existirem
  console.log('\n=== 4. Categorias para Sensora Íntima ===');
  const intimaCategories = [
    { name: 'Velas & Óleos', slug: 'velas-oleos', description: 'Velas aromáticas e óleos de massagem hidratantes' },
    { name: 'Cosméticos & Lubrificantes', slug: 'cosmeticos-lubrificantes', description: 'Géis lubrificantes, hidratação e cuidados especiais' },
    { name: 'Acessórios & Bem-Estar', slug: 'acessorios-bem-estar', description: 'Acessórios pessoais e autocuidado' }
  ];
  for (const catData of intimaCategories) {
    let cat = await prisma.category.findFirst({
      where: { slug: catData.slug }
    });
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          name: catData.name,
          slug: catData.slug,
          description: catData.description,
          status: 'ACTIVE',
          nicheId: intimaNiche.id
        }
      });
      console.log('Criada categoria para Sensora Íntima:', cat.name);
    } else {
      await prisma.category.update({
        where: { id: cat.id },
        data: { nicheId: intimaNiche.id, status: 'ACTIVE' }
      });
      console.log('Atualizada categoria para Sensora Íntima:', cat.name);
    }
  }

  // 5. Cadastrar os 3 produtos modelo da Sensora Íntima para que a loja já tenha produtos ativos!
  console.log('\n=== 5. Produtos Iniciais para a Loja Sensora Íntima ===');
  const sampleIntimaProducts = [
    {
      name: 'Vela de Massagem Beijável Morango Sensora',
      slug: 'vela-de-massagem-beijavel-morango-sensora',
      sku: 'SEN-INT-VEL-MOR-001',
      brand: 'Sensora Íntima',
      basePrice: 39.90,
      cost: 15.00,
      stock: 15,
      shortDescription: 'Vela aromática hidratante beijável sabor morango com chantilly para massagem corporal.',
      description: 'Transforme momentos especiais em experiências sensoriais únicas!\n\nA Vela de Massagem Beijável Morango da Sensora Íntima foi formulada com óleos vegetais nobres e manteigas hidratantes. Ao acender, transforma-se em um óleo de massagem morno, perfumado e delicioso ao toque e ao beijo.\n\n✨ Benefícios:\n- Fórmula 100% segura para a pele\n- Hidratação profunda sem resíduos pegajosos\n- Aroma envolvente de morango suave\n\n💡 Modo de usar: Acenda o pavio por 5 minutos até formar uma leve camada líquida morna. Apague e derrame suavemente sobre a pele massageando com movimentos circulares.',
      categorySlug: 'velas-oleos'
    },
    {
      name: 'Gel Lubrificante Íntimo Hidratante Neutro 100ml',
      slug: 'gel-lubrificante-intimo-hidratante-neutro-100ml',
      sku: 'SEN-INT-LUB-NEU-001',
      brand: 'Sensora Íntima',
      basePrice: 29.90,
      cost: 10.50,
      stock: 20,
      shortDescription: 'Lubrificante íntimo à base de água de longa duração, hipoalergênico e que não mancha.',
      description: 'O Gel Lubrificante Íntimo Neutro Sensora Íntima oferece deslizamento suave e hidratação prolongada. Desenvolvido à base de água, respeita o pH natural e proporciona conforto e naturalidade.\n\n✨ Diferenciais:\n- Base aquosa de fácil remoção\n- Não mancha tecidos\n- Compatível com preservativos e acessórios\n- Sem fragrância e hipoalergênico.',
      categorySlug: 'cosmeticos-lubrificantes'
    },
    {
      name: 'Vibrador Cápsula Bullet Pocket Velvet',
      slug: 'vibrador-capsula-bullet-pocket-velvet',
      sku: 'SEN-INT-BUL-VEL-001',
      brand: 'Sensora Íntima',
      basePrice: 59.90,
      cost: 22.00,
      stock: 10,
      shortDescription: 'Vibrador bullet compacto com 10 estágios de vibração em silicone com toque aveludado.',
      description: 'Design discreto, potente e sofisticado. O Bullet Pocket Velvet da Sensora Íntima é confeccionado em silicone macio com acabamento aveludado, resistente à água e recarregável via USB.\n\n✨ Diferenciais:\n- 10 estágios de vibração\n- Motor potente e ultra silencioso\n- Recarregável via cabo magnético USB incluso\n- Compacto para levar na bolsa ou necessaire.',
      categorySlug: 'acessorios-bem-estar'
    }
  ];

  for (const item of sampleIntimaProducts) {
    let p = await prisma.product.findUnique({ where: { slug: item.slug } });
    const cat = await prisma.category.findUnique({ where: { slug: item.categorySlug } });
    
    if (!p) {
      p = await prisma.product.create({
        data: {
          name: item.name,
          slug: item.slug,
          sku: item.sku,
          brand: item.brand,
          status: 'ACTIVE',
          basePrice: item.basePrice,
          manualCost: item.cost,
          shortDescription: item.shortDescription,
          description: item.description,
          niches: { create: { nicheId: intimaNiche.id } },
          categories: cat ? { create: { categoryId: cat.id } } : undefined,
          inventories: {
            create: {
              quantity: item.stock,
              reservedQuantity: 0,
              minimumQuantity: 1
            }
          }
        }
      });
      console.log('Produto Sensora Íntima cadastrado:', p.name);
    }

    // Configurar canal Loja Própria e preço
    if (ownStore) {
      const pc = await prisma.productChannel.findFirst({
        where: { productId: p.id, channelId: ownStore.id }
      });
      if (!pc) {
        await prisma.productChannel.create({
          data: { productId: p.id, channelId: ownStore.id, isEnabled: true }
        });
      }
      const pcp = await prisma.productChannelPrice.findFirst({
        where: { productId: p.id, channelId: ownStore.id, variantId: null }
      });
      if (!pcp) {
        await prisma.productChannelPrice.create({
          data: {
            productId: p.id,
            channelId: ownStore.id,
            mode: 'MANUAL',
            costBasis: item.cost,
            calculatedPrice: item.basePrice,
            manualPrice: item.basePrice,
            effectivePrice: item.basePrice,
            netProfit: item.basePrice - item.cost,
            netMargin: (item.basePrice - item.cost) / item.basePrice
          }
        });
      }
    }

    // Adicionar ao Catálogo Sensora Íntima
    const existsInCat = await prisma.catalogItem.findFirst({
      where: { catalogId: intimaCatalog.id, productId: p.id }
    });
    if (!existsInCat) {
      await prisma.catalogItem.create({
        data: {
          catalogId: intimaCatalog.id,
          productId: p.id,
          position: 1
        }
      });
    }
  }

  console.log('\nConfiguração do Banco de Dados concluída com sucesso!');
  await prisma.$disconnect();
}

setupMultiStore().catch(console.error);
