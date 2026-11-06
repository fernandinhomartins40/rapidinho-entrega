-- CreateTable
CREATE TABLE "store_promotions" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_promotion_products" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "store_promotion_products_pkey" PRIMARY KEY ("promotionId","productId")
);

-- CreateIndex
CREATE INDEX "store_promotions_storeId_isActive_idx" ON "store_promotions"("storeId", "isActive");

-- CreateIndex
CREATE INDEX "store_promotion_products_productId_idx" ON "store_promotion_products"("productId");

-- AddForeignKey
ALTER TABLE "store_promotions" ADD CONSTRAINT "store_promotions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_promotions" ADD CONSTRAINT "store_promotions_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_promotion_products" ADD CONSTRAINT "store_promotion_products_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "store_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_promotion_products" ADD CONSTRAINT "store_promotion_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

