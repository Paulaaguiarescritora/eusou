-- CreateEnum
CREATE TYPE "MarketplaceEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "MarketplaceEvent" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "resource" TEXT,
    "payload" JSONB NOT NULL,
    "status" "MarketplaceEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelOrder" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "externalBuyerId" TEXT,
    "externalStatus" TEXT NOT NULL,
    "externalTotal" DECIMAL(10,2) NOT NULL,
    "externalCurrency" TEXT NOT NULL DEFAULT 'BRL',
    "commissionFee" DECIMAL(10,2),
    "shippingFee" DECIMAL(10,2),
    "rawPayload" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelAttributeMapping" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalCategoryId" TEXT,
    "attributeDefinitionId" TEXT NOT NULL,
    "externalAttributeId" TEXT NOT NULL,
    "externalAttributeName" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" TEXT,
    "valueMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelAttributeMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceEvent_channelId_externalEventId_key" ON "MarketplaceEvent"("channelId", "externalEventId");

-- CreateIndex
CREATE INDEX "MarketplaceEvent_channelId_idx" ON "MarketplaceEvent"("channelId");

-- CreateIndex
CREATE INDEX "MarketplaceEvent_status_idx" ON "MarketplaceEvent"("status");

-- CreateIndex
CREATE INDEX "MarketplaceEvent_topic_idx" ON "MarketplaceEvent"("topic");

-- CreateIndex
CREATE INDEX "MarketplaceEvent_receivedAt_idx" ON "MarketplaceEvent"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelOrder_orderId_key" ON "ChannelOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelOrder_channelId_externalOrderId_key" ON "ChannelOrder"("channelId", "externalOrderId");

-- CreateIndex
CREATE INDEX "ChannelOrder_channelId_idx" ON "ChannelOrder"("channelId");

-- CreateIndex
CREATE INDEX "ChannelOrder_channelAccountId_idx" ON "ChannelOrder"("channelAccountId");

-- CreateIndex
CREATE INDEX "ChannelOrder_externalOrderId_idx" ON "ChannelOrder"("externalOrderId");

-- CreateIndex
CREATE INDEX "ChannelOrder_externalStatus_idx" ON "ChannelOrder"("externalStatus");

-- CreateIndex
CREATE INDEX "ChannelOrder_syncedAt_idx" ON "ChannelOrder"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelAttributeMapping_channelId_externalCategoryId_attributeDefinitionId_key" ON "ChannelAttributeMapping"("channelId", "externalCategoryId", "attributeDefinitionId");

-- CreateIndex
CREATE INDEX "ChannelAttributeMapping_channelId_idx" ON "ChannelAttributeMapping"("channelId");

-- CreateIndex
CREATE INDEX "ChannelAttributeMapping_externalCategoryId_idx" ON "ChannelAttributeMapping"("externalCategoryId");

-- CreateIndex
CREATE INDEX "ChannelAttributeMapping_attributeDefinitionId_idx" ON "ChannelAttributeMapping"("attributeDefinitionId");

-- CreateIndex
CREATE INDEX "ChannelAttributeMapping_externalAttributeId_idx" ON "ChannelAttributeMapping"("externalAttributeId");

-- AddForeignKey
ALTER TABLE "MarketplaceEvent" ADD CONSTRAINT "MarketplaceEvent_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOrder" ADD CONSTRAINT "ChannelOrder_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOrder" ADD CONSTRAINT "ChannelOrder_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOrder" ADD CONSTRAINT "ChannelOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAttributeMapping" ADD CONSTRAINT "ChannelAttributeMapping_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAttributeMapping" ADD CONSTRAINT "ChannelAttributeMapping_attributeDefinitionId_fkey" FOREIGN KEY ("attributeDefinitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
