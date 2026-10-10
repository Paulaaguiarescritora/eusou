-- CreateEnum
CREATE TYPE "RoundingRule" AS ENUM ('NONE', 'DECIMAL_TWO', 'ENDS_90', 'ENDS_99');

-- CreateEnum
CREATE TYPE "PriceCalculationMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateTable
CREATE TABLE "PricingProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultTargetMargin" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.04,
    "packagingCost" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "roundingRule" "RoundingRule" NOT NULL DEFAULT 'ENDS_90',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingChannelRule" (
    "id" TEXT NOT NULL,
    "pricingProfileId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelType" "ChannelType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "targetMargin" DECIMAL(5,4),
    "commissionPercent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "fixedCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fixedCostPercent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "otherPercent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "otherFixedCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "orderFixedCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentFeePercent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingChannelRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRuleTier" (
    "id" TEXT NOT NULL,
    "pricingChannelRuleId" TEXT NOT NULL,
    "name" TEXT,
    "minPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maxPrice" DECIMAL(10,2) NOT NULL DEFAULT 999999.00,
    "commissionPercent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "fixedCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fixedCostPercent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "otherPercent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "otherFixedCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRuleTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductChannelPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "channelId" TEXT NOT NULL,
    "pricingProfileId" TEXT,
    "mode" "PriceCalculationMode" NOT NULL DEFAULT 'AUTOMATIC',
    "costBasis" DECIMAL(10,2) NOT NULL,
    "calculatedPrice" DECIMAL(10,2) NOT NULL,
    "manualPrice" DECIMAL(10,2),
    "effectivePrice" DECIMAL(10,2) NOT NULL,
    "netProfit" DECIMAL(10,2) NOT NULL,
    "netMargin" DECIMAL(5,4) NOT NULL,
    "appliedRuleTierId" TEXT,
    "calculationDetails" JSONB,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductChannelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingProfile_slug_key" ON "PricingProfile"("slug");

-- CreateIndex
CREATE INDEX "PricingProfile_isActive_idx" ON "PricingProfile"("isActive");

-- CreateIndex
CREATE INDEX "PricingProfile_isDefault_idx" ON "PricingProfile"("isDefault");

-- CreateIndex
CREATE INDEX "PricingChannelRule_channelId_idx" ON "PricingChannelRule"("channelId");

-- CreateIndex
CREATE INDEX "PricingChannelRule_pricingProfileId_idx" ON "PricingChannelRule"("pricingProfileId");

-- CreateIndex
CREATE INDEX "PricingChannelRule_channelType_idx" ON "PricingChannelRule"("channelType");

-- CreateIndex
CREATE UNIQUE INDEX "PricingChannelRule_pricingProfileId_channelId_key" ON "PricingChannelRule"("pricingProfileId", "channelId");

-- CreateIndex
CREATE INDEX "PricingRuleTier_pricingChannelRuleId_idx" ON "PricingRuleTier"("pricingChannelRuleId");

-- CreateIndex
CREATE INDEX "PricingRuleTier_minPrice_maxPrice_idx" ON "PricingRuleTier"("minPrice", "maxPrice");

-- CreateIndex
CREATE INDEX "ProductChannelPrice_productId_idx" ON "ProductChannelPrice"("productId");

-- CreateIndex
CREATE INDEX "ProductChannelPrice_variantId_idx" ON "ProductChannelPrice"("variantId");

-- CreateIndex
CREATE INDEX "ProductChannelPrice_channelId_idx" ON "ProductChannelPrice"("channelId");

-- CreateIndex
CREATE INDEX "ProductChannelPrice_pricingProfileId_idx" ON "ProductChannelPrice"("pricingProfileId");

-- CreateIndex
CREATE INDEX "ProductChannelPrice_mode_idx" ON "ProductChannelPrice"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductChannelPrice_productId_channelId_variantId_key" ON "ProductChannelPrice"("productId", "channelId", "variantId");

-- AddForeignKey
ALTER TABLE "PricingChannelRule" ADD CONSTRAINT "PricingChannelRule_pricingProfileId_fkey" FOREIGN KEY ("pricingProfileId") REFERENCES "PricingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingChannelRule" ADD CONSTRAINT "PricingChannelRule_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRuleTier" ADD CONSTRAINT "PricingRuleTier_pricingChannelRuleId_fkey" FOREIGN KEY ("pricingChannelRuleId") REFERENCES "PricingChannelRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChannelPrice" ADD CONSTRAINT "ProductChannelPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChannelPrice" ADD CONSTRAINT "ProductChannelPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChannelPrice" ADD CONSTRAINT "ProductChannelPrice_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChannelPrice" ADD CONSTRAINT "ProductChannelPrice_pricingProfileId_fkey" FOREIGN KEY ("pricingProfileId") REFERENCES "PricingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
