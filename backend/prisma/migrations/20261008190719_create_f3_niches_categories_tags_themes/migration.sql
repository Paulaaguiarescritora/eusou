-- CreateEnum
CREATE TYPE "NicheStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ThemeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Niche" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "NicheStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "parentId" TEXT,
    "nicheId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TagStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductNiche" (
    "productId" TEXT NOT NULL,
    "nicheId" TEXT NOT NULL,

    CONSTRAINT "ProductNiche_pkey" PRIMARY KEY ("productId","nicheId")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "ProductTag" (
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("productId","tagId")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "ThemeStatus" NOT NULL DEFAULT 'ACTIVE',
    "logo" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#000000',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ffffff',
    "font" TEXT NOT NULL DEFAULT 'Inter',
    "buttonStyle" TEXT NOT NULL DEFAULT 'rounded',
    "cardStyle" TEXT NOT NULL DEFAULT 'elevated',
    "bannerStyle" TEXT NOT NULL DEFAULT 'full-width',
    "productsPerRow" INTEGER NOT NULL DEFAULT 4,
    "showCategories" BOOLEAN NOT NULL DEFAULT true,
    "showHighlights" BOOLEAN NOT NULL DEFAULT true,
    "showNewProducts" BOOLEAN NOT NULL DEFAULT true,
    "showOffers" BOOLEAN NOT NULL DEFAULT true,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Niche_slug_key" ON "Niche"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_nicheId_idx" ON "Category"("nicheId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ProductNiche_productId_idx" ON "ProductNiche"("productId");

-- CreateIndex
CREATE INDEX "ProductNiche_nicheId_idx" ON "ProductNiche"("nicheId");

-- CreateIndex
CREATE INDEX "ProductCategory_productId_idx" ON "ProductCategory"("productId");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

-- CreateIndex
CREATE INDEX "ProductTag_productId_idx" ON "ProductTag"("productId");

-- CreateIndex
CREATE INDEX "ProductTag_tagId_idx" ON "ProductTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_slug_key" ON "Theme"("slug");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductNiche" ADD CONSTRAINT "ProductNiche_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductNiche" ADD CONSTRAINT "ProductNiche_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
