const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Atualizar materiais existentes com valores corretos de 4 casas decimais
  await prisma.material.updateMany({
    where: { name: { contains: 'BAMBU LAB', mode: 'insensitive' } },
    data: { costPerUnit: 0.1160, category: 'PRODUCTION', unit: 'GRAM' },
  });

  await prisma.material.updateMany({
    where: { name: { contains: 'ROSA CLARO', mode: 'insensitive' } },
    data: { costPerUnit: 0.0900, category: 'PRODUCTION', unit: 'GRAM' },
  });

  await prisma.material.updateMany({
    where: { name: { contains: 'VERMELHO', mode: 'insensitive' } },
    data: { costPerUnit: 0.0900, category: 'PRODUCTION', unit: 'GRAM' },
  });

  // 2. Garantir componentes e embalagens reais no banco
  let argola = await prisma.material.findFirst({
    where: { name: { contains: 'Argola', mode: 'insensitive' } },
  });
  if (!argola) {
    argola = await prisma.material.create({
      data: {
        name: 'Argola de chaveiro',
        type: 'OTHER',
        category: 'COMPONENT',
        unit: 'PIECE',
        costPerUnit: 0.35,
        currentQuantity: 500,
        minimumQuantity: 50,
        isActive: true,
      },
    });
  } else {
    await prisma.material.update({
      where: { id: argola.id },
      data: { costPerUnit: 0.35, category: 'COMPONENT', unit: 'PIECE', isActive: true },
    });
  }

  let saquinho = await prisma.material.findFirst({
    where: { name: { contains: 'Saquinho', mode: 'insensitive' } },
  });
  if (!saquinho) {
    saquinho = await prisma.material.create({
      data: {
        name: 'Saquinho plástico',
        type: 'OTHER',
        category: 'PACKAGING',
        unit: 'PIECE',
        costPerUnit: 0.18,
        currentQuantity: 1000,
        minimumQuantity: 100,
        isActive: true,
      },
    });
  } else {
    await prisma.material.update({
      where: { id: saquinho.id },
      data: { costPerUnit: 0.18, category: 'PACKAGING', unit: 'PIECE', isActive: true },
    });
  }

  let etiqueta = await prisma.material.findFirst({
    where: { name: { contains: 'Etiqueta', mode: 'insensitive' } },
  });
  if (!etiqueta) {
    etiqueta = await prisma.material.create({
      data: {
        name: 'Etiqueta Felinodelia',
        type: 'OTHER',
        category: 'PACKAGING',
        unit: 'PIECE',
        costPerUnit: 0.12,
        currentQuantity: 1000,
        minimumQuantity: 100,
        isActive: true,
      },
    });
  } else {
    await prisma.material.update({
      where: { id: etiqueta.id },
      data: { costPerUnit: 0.12, category: 'PACKAGING', unit: 'PIECE', isActive: true },
    });
  }

  // 3. Atualizar taxa horária da Bambu Lab A1 Mini para R$ 0,35
  const printer = await prisma.printer.findFirst({
    where: { model: { contains: 'A1 Mini', mode: 'insensitive' } },
  });
  if (printer) {
    await prisma.printer.update({
      where: { id: printer.id },
      data: { machineCostPerHour: 0.35 },
    });
  }

  const allMats = await prisma.material.findMany({ orderBy: { name: 'asc' } });
  console.log('Materiais no banco:');
  for (const m of allMats) {
    console.log(` - ${m.name} | Cat: ${m.category} | Unidade: ${m.unit} | Custo: R$ ${Number(m.costPerUnit).toFixed(4)} | Ativo: ${m.isActive}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
