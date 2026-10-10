-- AlterTable
ALTER TABLE "ChannelProduct" ADD COLUMN "externalUserProductId" TEXT;
ALTER TABLE "ChannelProduct" ADD COLUMN "externalFamilyId" TEXT;
ALTER TABLE "ChannelProduct" ADD COLUMN "externalVariationId" TEXT;
ALTER TABLE "ChannelProduct" ADD COLUMN "lastObservedPrice" DECIMAL(10,2);
ALTER TABLE "ChannelProduct" ADD COLUMN "lastObservedStock" INTEGER;
ALTER TABLE "ChannelProduct" ADD COLUMN "lastObservedStatus" TEXT;
ALTER TABLE "ChannelProduct" ADD COLUMN "lastObservedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MarketplaceEvent" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MarketplaceEvent_nextAttemptAt_idx" ON "MarketplaceEvent"("nextAttemptAt");
