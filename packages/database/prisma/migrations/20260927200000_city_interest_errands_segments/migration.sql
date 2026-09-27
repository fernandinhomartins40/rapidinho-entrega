-- CreateEnum
CREATE TYPE "CityInterestProfile" AS ENUM ('CUSTOMER', 'STORE', 'COURIER');

-- CreateEnum
CREATE TYPE "ErrandStatus" AS ENUM ('OPEN', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "segments" "StoreSegment"[] DEFAULT ARRAY[]::"StoreSegment"[];

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "counterPriceSince" TIMESTAMP(3),
ADD COLUMN     "sellsAtCounterPrice" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "city_interests" (
    "id" TEXT NOT NULL,
    "cityKey" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "profile" "CityInterestProfile" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "businessName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "city_interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "errands" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "courierId" TEXT,
    "status" "ErrandStatus" NOT NULL DEFAULT 'OPEN',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "street" TEXT NOT NULL,
    "number" TEXT,
    "neighborhood" TEXT NOT NULL,
    "referencePoint" TEXT,
    "notes" TEXT,
    "feeCents" INTEGER NOT NULL,
    "collectCents" INTEGER,
    "createdById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "errands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "city_interests_cityKey_idx" ON "city_interests"("cityKey");

-- CreateIndex
CREATE UNIQUE INDEX "city_interests_cityKey_phone_profile_key" ON "city_interests"("cityKey", "phone", "profile");

-- CreateIndex
CREATE INDEX "errands_cityId_status_idx" ON "errands"("cityId", "status");

-- CreateIndex
CREATE INDEX "errands_storeId_createdAt_idx" ON "errands"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "errands_courierId_status_idx" ON "errands"("courierId", "status");

-- AddForeignKey
ALTER TABLE "errands" ADD CONSTRAINT "errands_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "errands" ADD CONSTRAINT "errands_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "errands" ADD CONSTRAINT "errands_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Cobrança híbrida por segmento: os planos com comissão ficam para
-- restaurante; mercado, farmácia e outros ganham planos de mensalidade sem
-- comissão (criados pelo seed). O plano "Mercado" (5% + mensalidade) passa a
-- ser o plano profissional de restaurante — o nome só muda se ainda for o
-- original, para não atropelar edição feita no painel.
UPDATE "plans" SET "segments" = ARRAY['RESTAURANT']::"StoreSegment"[]
  WHERE "slug" IN ('gratis', 'essencial', 'mercado');
UPDATE "plans" SET "name" = 'Profissional'
  WHERE "slug" = 'mercado' AND "name" = 'Mercado';
