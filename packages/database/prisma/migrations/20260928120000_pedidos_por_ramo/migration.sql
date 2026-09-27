-- CreateEnum
CREATE TYPE "PrescriptionRule" AS ENUM ('NONE', 'REQUIRED', 'CONTROLLED');

-- CreateEnum
CREATE TYPE "SubstitutionPolicy" AS ENUM ('SUBSTITUTE_SIMILAR', 'CONTACT_ME', 'REMOVE_ITEM');

-- AlterEnum
ALTER TYPE "MediaContext" ADD VALUE 'PRESCRIPTION';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "ageConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "prescriptionImageId" TEXT,
ADD COLUMN     "substitutionPolicy" "SubstitutionPolicy";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "ageRestricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prescription" "PrescriptionRule" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "cart_item_pizza_extras" (
    "id" TEXT NOT NULL,
    "cartItemId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,

    CONSTRAINT "cart_item_pizza_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_pizza_extras" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "extraId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "order_item_pizza_extras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cart_item_pizza_extras_cartItemId_extraId_key" ON "cart_item_pizza_extras"("cartItemId", "extraId");

-- CreateIndex
CREATE INDEX "order_item_pizza_extras_orderItemId_idx" ON "order_item_pizza_extras"("orderItemId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_prescriptionImageId_fkey" FOREIGN KEY ("prescriptionImageId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_pizza_extras" ADD CONSTRAINT "cart_item_pizza_extras_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_item_pizza_extras" ADD CONSTRAINT "cart_item_pizza_extras_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "pizza_extras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_pizza_extras" ADD CONSTRAINT "order_item_pizza_extras_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_pizza_extras" ADD CONSTRAINT "order_item_pizza_extras_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "pizza_extras"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Borda única (campo antigo) vira o primeiro extra da tabela nova, em
-- carrinhos e pedidos: o código passa a ler só a tabela nova.
INSERT INTO "cart_item_pizza_extras" ("id", "cartItemId", "extraId")
SELECT 'm' || md5(random()::text || ci."id"), ci."id", ci."pizzaExtraId"
FROM "cart_items" ci
WHERE ci."pizzaExtraId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "order_item_pizza_extras" ("id", "orderItemId", "extraId", "name", "kind", "priceCents")
SELECT 'm' || md5(random()::text || oi."id"), oi."id", oi."pizzaExtraId",
       oi."pizzaExtraName", COALESCE(pe."kind", 'EDGE'), COALESCE(oi."pizzaExtraPriceCents", 0)
FROM "order_items" oi
LEFT JOIN "pizza_extras" pe ON pe."id" = oi."pizzaExtraId"
WHERE oi."pizzaExtraName" IS NOT NULL;

-- Bebida alcoólica que já está no ar passa a pedir 18+ (Lei 13.106/15). A
-- loja desmarca no produto se algum caso não for bebida (ex.: "vinagre de
-- vinho" não casa: o padrão exige a palavra inteira no começo do nome).
UPDATE "products"
SET "ageRestricted" = true
WHERE "deletedAt" IS NULL
  AND "name" ~* '^\s*(fardo\s+(de\s+)?)?(cerveja|chope|chopp|vinho|espumante|vodka|cacha[cç]a|whisky|u[ií]sque|gin|rum|tequila|licor|conhaque|aperitivo|sak[eê]|cigarro|narguil[eé]|ess[eê]ncia\s+de\s+narguil[eé])\M';
