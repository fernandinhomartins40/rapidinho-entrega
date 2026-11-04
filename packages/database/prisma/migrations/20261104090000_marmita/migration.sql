-- CreateEnum
CREATE TYPE "MarmitaKind" AS ENUM ('NO_PRATO', 'MISTURA', 'EXTRA');

-- CreateEnum
CREATE TYPE "MarmitaAjuste" AS ENUM ('SEM', 'POUCO', 'MAIS', 'ESCOLHIDO');

-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'MARMITA';

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "marmitaSizeId" TEXT;

-- CreateTable
CREATE TABLE "marmita_sizes" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "maxMisturas" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marmita_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marmita_items" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MarmitaKind" NOT NULL DEFAULT 'NO_PRATO',
    "groupName" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "pausedUntil" TIMESTAMP(3),
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marmita_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_item_marmita" (
    "id" TEXT NOT NULL,
    "cartItemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ajuste" "MarmitaAjuste" NOT NULL,

    CONSTRAINT "cart_item_marmita_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marmita_sizes_storeId_sortOrder_idx" ON "marmita_sizes"("storeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "marmita_sizes_storeId_name_key" ON "marmita_sizes"("storeId", "name");

-- CreateIndex
CREATE INDEX "marmita_items_storeId_kind_sortOrder_idx" ON "marmita_items"("storeId", "kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_marmita_cartItemId_itemId_key" ON "cart_item_marmita"("cartItemId", "itemId");

-- AddForeignKey
ALTER TABLE "marmita_sizes" ADD CONSTRAINT "marmita_sizes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marmita_items" ADD CONSTRAINT "marmita_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_marmita" ADD CONSTRAINT "cart_item_marmita_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_marmita" ADD CONSTRAINT "cart_item_marmita_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "marmita_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_marmitaSizeId_fkey" FOREIGN KEY ("marmitaSizeId") REFERENCES "marmita_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

