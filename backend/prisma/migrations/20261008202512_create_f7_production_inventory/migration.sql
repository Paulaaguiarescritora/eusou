-- CreateEnum
CREATE TYPE "PrinterStatus" AS ENUM ('AVAILABLE', 'PRINTING', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PLA', 'PETG', 'ABS', 'RESIN', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialUnit" AS ENUM ('GRAM', 'KILOGRAM', 'METER', 'PIECE');

-- CreateEnum
CREATE TYPE "ProductionMode" AS ENUM ('STOCK', 'MAKE_TO_ORDER');

-- CreateEnum
CREATE TYPE "ProductionJobStatus" AS ENUM ('QUEUED', 'PRINTING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'RESERVATION', 'RELEASE');

-- CreateEnum
CREATE TYPE "MaterialMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Printer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "PrinterStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location" TEXT,
    "machineCostPerHour" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL DEFAULT 'PLA',
    "color" TEXT,
    "unit" "MaterialUnit" NOT NULL DEFAULT 'GRAM',
    "costPerUnit" DECIMAL(10,4) NOT NULL,
    "currentQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minimumQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionProfile" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "productionMode" "ProductionMode" NOT NULL DEFAULT 'STOCK',
    "productionTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "materialWeightGrams" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "powerConsumptionWatts" INTEGER NOT NULL DEFAULT 0,
    "finishingTimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "finishingCost" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "packagingCost" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "laborCost" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionMaterial" (
    "id" TEXT NOT NULL,
    "productionProfileId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" "MaterialUnit" NOT NULL DEFAULT 'GRAM',
    "percentage" DECIMAL(5,2),
    "notes" TEXT,

    CONSTRAINT "ProductionMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyCostConfig" (
    "id" TEXT NOT NULL,
    "costPerKwh" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnergyCostConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionJob" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "printerId" TEXT NOT NULL,
    "status" "ProductionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "plannedQuantity" INTEGER NOT NULL DEFAULT 1,
    "producedQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "estimatedCost" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "actualCost" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "minimumQuantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialMovement" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "MaterialMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Printer_status_idx" ON "Printer"("status");

-- CreateIndex
CREATE INDEX "Material_type_idx" ON "Material"("type");

-- CreateIndex
CREATE INDEX "Material_isActive_idx" ON "Material"("isActive");

-- CreateIndex
CREATE INDEX "ProductionProfile_productId_idx" ON "ProductionProfile"("productId");

-- CreateIndex
CREATE INDEX "ProductionProfile_variantId_idx" ON "ProductionProfile"("variantId");

-- CreateIndex
CREATE INDEX "ProductionProfile_isActive_idx" ON "ProductionProfile"("isActive");

-- CreateIndex
CREATE INDEX "ProductionMaterial_productionProfileId_idx" ON "ProductionMaterial"("productionProfileId");

-- CreateIndex
CREATE INDEX "ProductionMaterial_materialId_idx" ON "ProductionMaterial"("materialId");

-- CreateIndex
CREATE INDEX "EnergyCostConfig_isActive_idx" ON "EnergyCostConfig"("isActive");

-- CreateIndex
CREATE INDEX "ProductionJob_status_idx" ON "ProductionJob"("status");

-- CreateIndex
CREATE INDEX "ProductionJob_printerId_idx" ON "ProductionJob"("printerId");

-- CreateIndex
CREATE INDEX "ProductionJob_productId_idx" ON "ProductionJob"("productId");

-- CreateIndex
CREATE INDEX "ProductionJob_createdAt_idx" ON "ProductionJob"("createdAt");

-- CreateIndex
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Inventory_variantId_idx" ON "Inventory"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_variantId_key" ON "Inventory"("productId", "variantId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE INDEX "StockMovement_variantId_idx" ON "StockMovement"("variantId");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_referenceId_idx" ON "StockMovement"("referenceId");

-- CreateIndex
CREATE INDEX "MaterialMovement_materialId_idx" ON "MaterialMovement"("materialId");

-- CreateIndex
CREATE INDEX "MaterialMovement_createdAt_idx" ON "MaterialMovement"("createdAt");

-- CreateIndex
CREATE INDEX "MaterialMovement_referenceId_idx" ON "MaterialMovement"("referenceId");

-- AddForeignKey
ALTER TABLE "ProductionProfile" ADD CONSTRAINT "ProductionProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionProfile" ADD CONSTRAINT "ProductionProfile_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterial" ADD CONSTRAINT "ProductionMaterial_productionProfileId_fkey" FOREIGN KEY ("productionProfileId") REFERENCES "ProductionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionMaterial" ADD CONSTRAINT "ProductionMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_printerId_fkey" FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
