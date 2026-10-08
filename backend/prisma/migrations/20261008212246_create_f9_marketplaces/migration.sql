-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('OWN_STORE', 'MERCADO_LIVRE', 'SHOPEE', 'AMAZON', 'MAGALU', 'TIKTOK_SHOP', 'GOOGLE_MERCHANT', 'OTHER');

-- CreateEnum
CREATE TYPE "ChannelAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR', 'DISCONNECTED', 'PENDING');

-- CreateEnum
CREATE TYPE "ChannelProductStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'PAUSED', 'ERROR', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "ChannelSyncOperation" AS ENUM ('PUBLISH', 'UPDATE', 'PRICE', 'STOCK', 'UNPUBLISH', 'SYNC', 'TEST_CONNECTION');

-- CreateEnum
CREATE TYPE "ChannelSyncStatus" AS ENUM ('SUCCESS', 'ERROR', 'PENDING');

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelAccount" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ChannelAccountStatus" NOT NULL DEFAULT 'PENDING',
    "externalAccountId" TEXT,
    "configuration" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "externalProductId" TEXT,
    "externalUrl" TEXT,
    "externalSku" TEXT,
    "priceOverride" DECIMAL(10,2),
    "status" "ChannelProductStatus" NOT NULL DEFAULT 'DRAFT',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "syncPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelCategory" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "externalCategoryId" TEXT NOT NULL,
    "externalCategoryName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelSyncLog" (
    "id" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "channelProductId" TEXT,
    "operation" "ChannelSyncOperation" NOT NULL,
    "status" "ChannelSyncStatus" NOT NULL,
    "message" TEXT,
    "details" JSONB,
    "externalCode" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Channel_type_idx" ON "Channel"("type");

-- CreateIndex
CREATE INDEX "Channel_isActive_idx" ON "Channel"("isActive");

-- CreateIndex
CREATE INDEX "ChannelAccount_channelId_idx" ON "ChannelAccount"("channelId");

-- CreateIndex
CREATE INDEX "ChannelAccount_status_idx" ON "ChannelAccount"("status");

-- CreateIndex
CREATE INDEX "ChannelProduct_productId_idx" ON "ChannelProduct"("productId");

-- CreateIndex
CREATE INDEX "ChannelProduct_channelAccountId_idx" ON "ChannelProduct"("channelAccountId");

-- CreateIndex
CREATE INDEX "ChannelProduct_status_idx" ON "ChannelProduct"("status");

-- CreateIndex
CREATE INDEX "ChannelProduct_externalProductId_idx" ON "ChannelProduct"("externalProductId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelProduct_productId_channelAccountId_key" ON "ChannelProduct"("productId", "channelAccountId");

-- CreateIndex
CREATE INDEX "ChannelCategory_channelId_idx" ON "ChannelCategory"("channelId");

-- CreateIndex
CREATE INDEX "ChannelCategory_categoryId_idx" ON "ChannelCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCategory_channelId_categoryId_key" ON "ChannelCategory"("channelId", "categoryId");

-- CreateIndex
CREATE INDEX "ChannelSyncLog_channelAccountId_idx" ON "ChannelSyncLog"("channelAccountId");

-- CreateIndex
CREATE INDEX "ChannelSyncLog_channelProductId_idx" ON "ChannelSyncLog"("channelProductId");

-- CreateIndex
CREATE INDEX "ChannelSyncLog_operation_idx" ON "ChannelSyncLog"("operation");

-- CreateIndex
CREATE INDEX "ChannelSyncLog_status_idx" ON "ChannelSyncLog"("status");

-- CreateIndex
CREATE INDEX "ChannelSyncLog_createdAt_idx" ON "ChannelSyncLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ChannelAccount" ADD CONSTRAINT "ChannelAccount_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelProduct" ADD CONSTRAINT "ChannelProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelProduct" ADD CONSTRAINT "ChannelProduct_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCategory" ADD CONSTRAINT "ChannelCategory_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCategory" ADD CONSTRAINT "ChannelCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSyncLog" ADD CONSTRAINT "ChannelSyncLog_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSyncLog" ADD CONSTRAINT "ChannelSyncLog_channelProductId_fkey" FOREIGN KEY ("channelProductId") REFERENCES "ChannelProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
