-- AlterEnum
ALTER TYPE "MediaContext" ADD VALUE 'PIX_PROOF';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "pixProofImageId" TEXT;

-- AlterTable
ALTER TABLE "stores" ADD COLUMN "suspendedForNonPaymentAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_pixProofImageId_fkey" FOREIGN KEY ("pixProofImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
