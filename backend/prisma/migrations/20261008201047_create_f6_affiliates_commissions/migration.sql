-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Collection" ADD COLUMN     "ownerAffiliateId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "affiliateCode" TEXT;

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateLink" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "productId" TEXT,
    "catalogId" TEXT,
    "collectionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "affiliateLinkId" TEXT,
    "productId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateConversion" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "affiliateLinkId" TEXT,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "commissionAmount" DECIMAL(10,2) NOT NULL,
    "status" "ConversionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT,
    "productId" TEXT,
    "categoryId" TEXT,
    "nicheId" TEXT,
    "percentage" DECIMAL(5,2) NOT NULL,
    "fixedAmount" DECIMAL(10,2),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- CreateIndex
CREATE INDEX "Affiliate_code_idx" ON "Affiliate"("code");

-- CreateIndex
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLink_code_key" ON "AffiliateLink"("code");

-- CreateIndex
CREATE INDEX "AffiliateLink_affiliateId_idx" ON "AffiliateLink"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateLink_code_idx" ON "AffiliateLink"("code");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateId_idx" ON "AffiliateClick"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateLinkId_idx" ON "AffiliateClick"("affiliateLinkId");

-- CreateIndex
CREATE INDEX "AffiliateClick_createdAt_idx" ON "AffiliateClick"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateConversion_orderId_key" ON "AffiliateConversion"("orderId");

-- CreateIndex
CREATE INDEX "AffiliateConversion_affiliateId_idx" ON "AffiliateConversion"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateConversion_orderId_idx" ON "AffiliateConversion"("orderId");

-- CreateIndex
CREATE INDEX "AffiliateConversion_createdAt_idx" ON "AffiliateConversion"("createdAt");

-- CreateIndex
CREATE INDEX "AffiliateConversion_status_idx" ON "AffiliateConversion"("status");

-- CreateIndex
CREATE INDEX "CommissionRule_affiliateId_idx" ON "CommissionRule"("affiliateId");

-- CreateIndex
CREATE INDEX "CommissionRule_productId_idx" ON "CommissionRule"("productId");

-- CreateIndex
CREATE INDEX "CommissionRule_categoryId_idx" ON "CommissionRule"("categoryId");

-- CreateIndex
CREATE INDEX "CommissionRule_nicheId_idx" ON "CommissionRule"("nicheId");

-- CreateIndex
CREATE INDEX "CommissionRule_priority_idx" ON "CommissionRule"("priority");

-- CreateIndex
CREATE INDEX "Collection_ownerAffiliateId_idx" ON "Collection"("ownerAffiliateId");

-- CreateIndex
CREATE INDEX "Order_affiliateCode_idx" ON "Order"("affiliateCode");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_ownerAffiliateId_fkey" FOREIGN KEY ("ownerAffiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "Catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "AffiliateLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "AffiliateLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_nicheId_fkey" FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;
