-- Busca de lojas e produtos.
--
-- Duas estratégias combinadas, porque o público digita rápido e com erro:
--  - full-text (tsvector) para "pizza calabresa" achar "Pizza de Calabresa";
--  - trigrama (pg_trgm) para "piza" e "açai" ainda acharem o item certo.
--
-- `unaccent` não é IMMUTABLE por padrão e por isso não pode entrar em índice.
-- O wrapper abaixo fixa o dicionário e permite indexar.

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT public.unaccent('public.unaccent', $1)
$$;

-- Produtos ------------------------------------------------------------------
CREATE INDEX "products_fulltext_idx" ON "products"
USING GIN (
  to_tsvector(
    'portuguese',
    immutable_unaccent(coalesce("name", '') || ' ' || coalesce("description", ''))
  )
);

CREATE INDEX "products_name_trgm_idx" ON "products"
USING GIN (immutable_unaccent(lower("name")) gin_trgm_ops);

-- Lojas ---------------------------------------------------------------------
CREATE INDEX "stores_fulltext_idx" ON "stores"
USING GIN (
  to_tsvector(
    'portuguese',
    immutable_unaccent(coalesce("name", '') || ' ' || coalesce("description", ''))
  )
);

CREATE INDEX "stores_name_trgm_idx" ON "stores"
USING GIN (immutable_unaccent(lower("name")) gin_trgm_ops);

-- Sabores de pizza ----------------------------------------------------------
CREATE INDEX "pizza_flavors_name_trgm_idx" ON "pizza_flavors"
USING GIN (immutable_unaccent(lower("name")) gin_trgm_ops);

-- Pedido por loja e status é a consulta mais quente do painel do lojista:
-- a tela de pedidos abertos roda a cada evento de realtime.
CREATE INDEX "orders_store_active_idx" ON "orders" ("storeId", "createdAt" DESC)
WHERE "status" NOT IN ('DELIVERED', 'CANCELLED', 'REJECTED');
