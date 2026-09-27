-- CreateTable
CREATE TABLE "favorite_stores" (
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_stores_pkey" PRIMARY KEY ("userId","storeId")
);

-- CreateIndex
CREATE INDEX "favorite_stores_storeId_idx" ON "favorite_stores"("storeId");

-- AddForeignKey
ALTER TABLE "favorite_stores" ADD CONSTRAINT "favorite_stores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_stores" ADD CONSTRAINT "favorite_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
