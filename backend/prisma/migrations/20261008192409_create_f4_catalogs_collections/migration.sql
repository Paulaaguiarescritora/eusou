-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CatalogType" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "CatalogRuleType" AS ENUM ('NICHE', 'CATEGORY', 'TAG');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "CatalogType" NOT NULL DEFAULT 'MANUAL',
    "nicheId" TEXT,
    "themeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogRule" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "type" "CatalogRuleType" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverMediaId" TEXT,
    "status" "CollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCollection" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Catalog_slug_key" ON "Catalog"("slug");

-- CreateIndex
CREATE INDEX "Catalog_nicheId_idx" ON "Catalog"("nicheId");

-- CreateIndex
CREATE INDEX "Catalog_themeId_idx" ON "Catalog"("themeId");

-- CreateIndex
CREATE INDEX "CatalogItem_catalogId_idx" ON "CatalogItem"("catalogId");

-- CreateIndex
CREATE INDEX "CatalogItem_productId_idx" ON "CatalogItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_catalogId_productId_key" ON "CatalogItem"("catalogId", "productId");

-- CreateIndex
CREATE INDEX "CatalogRule_catalogId_idx" ON "CatalogRule"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionItem_productId_idx" ON "CollectionItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collectionId_productId_key" ON "CollectionItem"("collectionId", "productId");

-- CreateIndex
CREATE INDEX "CatalogCollection_catalogId_idx" ON "CatalogCollection"("catalogId");

-- CreateIndex
CREATE INDEX "CatalogCollection_collectionId_idx" ON "CatalogCollection"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollection_catalogId_collectionId_key" ON "CatalogCollection"("catalogId", "collectionId");

-- AddForeignKey
ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Catalog" ADD CONSTRAINT "Catalog_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogRule" ADD CONSTRAINT "CatalogRule_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollection" ADD CONSTRAINT "CatalogCollection_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollection" ADD CONSTRAINT "CatalogCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
