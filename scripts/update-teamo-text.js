const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '../backend/.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
let directUrl = '';
for (const line of lines) {
  if (line.trim().startsWith('DIRECT_URL=')) directUrl = line.split('=')[1].replace(/["']/g, '').trim();
}
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasourceUrl: directUrl });

async function updateTeAmo() {
  const newName = 'Kit Carimbos Para Brigadeiro E Biscoito Te Amo + Cortador'; // 58 chars
  const newDescription = `Transforme pequenos doces em grandes momentos!

O Kit de Carimbos Te Amo da Sensora é perfeito para quem deseja elevar o nível da confeitaria artesanal. Seja para confeiteiras profissionais ou para quem ama surpreender em datas especiais como o Dia dos Namorados, aniversários de namoro, casamentos e comemorações românticas, este kit traz mensagens de afeto e delicadeza para cada detalhe.

Mais do que um carimbo, é a ferramenta ideal para dar personalidade, sofisticação e um acabamento profissional impecável aos seus doces e biscoitos!

✨ O que acompanha o Kit:
5 Carimbos com temas românticos exclusivos:
1. Coração Clássico com Borda Ondulada / Renda
2. Coração Cruzado com Flecha do Cupido
3. Coração Estilizado Fluido
4. Mensagem "Te Amo" com Detalhe de Coração
5. Balão de Diálogo (Mensagem) com Coração

1 Cortador circular exclusivo (medindo aprox. 2,5 cm) para padronizar o tamanho de biscoitos, massas e doces com precisão.

💖 Principais Diferenciais e Benefícios:
- Versatilidade Incrível: Ideal para marcar brigadeiros gourmet, beijinhos, bicho-de-pé, massas de biscoitos, pasta americana e muito mais.
- Design Ergonômico: Cabo anatômico confortável que facilita o manuseio, garantindo uma marcação perfeita sem esforço.
- Resultados Profissionais: Deixe sua produção com um visual de confeitaria fina, encantando clientes e convidados à primeira vista.
- Praticidade e Durabilidade: Material resistente, leve e de fácil higienização, perfeito para o uso frequente na cozinha.

📏 Dimensões Aproximadas:
- Diâmetro da marcação: Aprox. 2,5 cm

💡 Dica de Uso:
Para melhores resultados em brigadeiros, passe levemente o carimbo no cacau em pó ou açúcar antes de pressionar o doce. Em massas de biscoito, utilize o cortador incluso para obter o formato redondo perfeito e aplique o carimbo levemente sobre a massa aberta.

📦 O que você vai receber:
- 05x Carimbos para Doces e Biscoitos (Tema Romance / Te Amo)
- 01x Cortador Circular

Garanta já o seu e deixe seus doces ainda mais especiais e inesquecíveis!`;

  await prisma.product.update({
    where: { id: 'd6847eee-6db9-4c92-b1da-b4129d7aa894' },
    data: {
      name: newName,
      description: newDescription
    }
  });
  console.log('Te Amo product updated with title (58 chars) and formatted description.');
  await prisma.$disconnect();
}
updateTeAmo().catch(console.error);
