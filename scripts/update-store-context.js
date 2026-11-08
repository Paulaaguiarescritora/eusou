const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend/src/public-store/public-store.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `    if (!niche) {
      // Fallback para primeiro nicho ativo
      niche = await this.prisma.niche.findFirst({
        where: { status: 'ACTIVE' },
        include: {
          defaultTheme: true,
          catalogs: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: { theme: true },
          },
        },
      });
    }`;

const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = targetStr.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const replacement = `    if (!niche) {
      return {
        brandName: 'KUBO STUDIO',
        nicheId: null,
        nicheSlug: null,
        logoUrl: null,
        faviconUrl: null,
        theme: null,
        catalogs: [],
      };
    }`;
  const updated = normalizedContent.replace(normalizedTarget, replacement);
  fs.writeFileSync(filePath, updated.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated getStoreContext in public-store.service.ts');
} else {
  console.log('Target string not found in public-store.service.ts');
}
