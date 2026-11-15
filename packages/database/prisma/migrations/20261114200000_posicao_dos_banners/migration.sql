-- Banner ganha posição própria no app. Antes usava o enum dos pacotes de
-- impulsionamento, e o app ignorava o campo: todo banner ia para o carrossel
-- do topo. Os existentes ficam no topo, que é onde já apareciam.
CREATE TYPE "BannerPlacement" AS ENUM ('TOP', 'HOME_STRIP', 'CATEGORY', 'ORDERS');

ALTER TABLE "banners" ALTER COLUMN "placement" DROP DEFAULT;
ALTER TABLE "banners" ALTER COLUMN "placement" TYPE "BannerPlacement" USING 'TOP'::"BannerPlacement";
ALTER TABLE "banners" ALTER COLUMN "placement" SET DEFAULT 'TOP';

ALTER TABLE "banners" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "banners" ADD CONSTRAINT "banners_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "store_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
