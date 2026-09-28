-- CreateEnum
CREATE TYPE "PickStatus" AS ENUM ('PICKED', 'MISSING', 'REPLACED', 'AWAITING_CUSTOMER');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "estimatedTotalCents" INTEGER,
ADD COLUMN     "pickStatus" "PickStatus",
ADD COLUMN     "pickedWeightGrams" INTEGER,
ADD COLUMN     "questionAskedAt" TIMESTAMP(3),
ADD COLUMN     "replacementAccepted" BOOLEAN,
ADD COLUMN     "replacementName" TEXT,
ADD COLUMN     "replacementPriceCents" INTEGER;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "estimatedTotalCents" INTEGER,
ADD COLUMN     "pickedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refundedCents" INTEGER NOT NULL DEFAULT 0;

