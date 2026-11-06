-- Itens que o cliente odeia ("odeio cebola"): o app pergunta ao adicionar à sacola.
ALTER TABLE "users" ADD COLUMN "dislikedItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Cardápio de marmita das lojas de demonstração. Elas só tinham o produto antigo
-- "Marmita média", com carne e extras. Chaves derivadas da loja e do nome: rodar
-- de novo não duplica, e banco sem essas lojas não recebe nada.
WITH lojas AS (
  SELECT id FROM "stores"
  WHERE slug IN (
    'peixaria-e-restaurante-rio-piquiri',
    'cantina-da-nona',
    'restaurante-tempero-mineiro',
    'marmitaria-sabor-do-campo'
  ) AND "deletedAt" IS NULL
)
INSERT INTO "marmita_sizes" ("id", "storeId", "name", "description", "priceCents", "maxMisturas", "sortOrder", "updatedAt")
SELECT 'c' || substr(md5(l.id || t.nome), 1, 24), l.id, t.nome, t.descricao, t.preco, t.misturas, t.ordem, CURRENT_TIMESTAMP
FROM lojas l
CROSS JOIN (VALUES
  ('Pequena', 'Serve 1 pessoa com pouca fome', 1890, 1, 0),
  ('Média', 'Serve 1 pessoa', 2290, 1, 1),
  ('Grande', 'Serve 1 pessoa com muita fome', 2690, 2, 2)
) AS t(nome, descricao, preco, misturas, ordem)
ON CONFLICT DO NOTHING;

WITH lojas AS (
  SELECT id FROM "stores"
  WHERE slug IN (
    'peixaria-e-restaurante-rio-piquiri',
    'cantina-da-nona',
    'restaurante-tempero-mineiro',
    'marmitaria-sabor-do-campo'
  ) AND "deletedAt" IS NULL
)
INSERT INTO "marmita_items" ("id", "storeId", "name", "kind", "groupName", "priceCents", "weekdays", "sortOrder", "updatedAt")
SELECT 'c' || substr(md5(l.id || t.nome), 1, 24), l.id, t.nome, t.tipo::"MarmitaKind", t.grupo, t.preco, t.dias::INTEGER[], t.ordem, CURRENT_TIMESTAMP
FROM lojas l
CROSS JOIN (VALUES
  ('Arroz branco', 'NO_PRATO', 'Base', 0, '{}', 0),
  ('Feijão', 'NO_PRATO', 'Base', 0, '{}', 1),
  ('Farofa', 'NO_PRATO', 'Acompanhamentos', 0, '{}', 2),
  ('Macarrão', 'NO_PRATO', 'Acompanhamentos', 0, '{1,3,5}', 3),
  ('Purê de batata', 'NO_PRATO', 'Acompanhamentos', 0, '{2,4,6}', 4),
  ('Alface', 'NO_PRATO', 'Salada', 0, '{}', 5),
  ('Tomate', 'NO_PRATO', 'Salada', 0, '{}', 6),
  ('Cebola', 'NO_PRATO', 'Salada', 0, '{}', 7),
  ('Frango grelhado', 'MISTURA', NULL, 0, '{}', 0),
  ('Bife acebolado', 'MISTURA', NULL, 0, '{}', 1),
  ('Carne de panela', 'MISTURA', NULL, 0, '{1}', 2),
  ('Frango à parmegiana', 'MISTURA', NULL, 300, '{2}', 3),
  ('Feijoada', 'MISTURA', NULL, 400, '{3,6}', 4),
  ('Costelinha assada', 'MISTURA', NULL, 400, '{4}', 5),
  ('Peixe frito', 'MISTURA', NULL, 300, '{5}', 6),
  ('Churrasco', 'MISTURA', NULL, 500, '{0}', 7),
  ('Ovo frito', 'EXTRA', NULL, 250, '{}', 0),
  ('Batata frita', 'EXTRA', NULL, 500, '{}', 1),
  ('Refrigerante lata', 'EXTRA', NULL, 600, '{}', 2)
) AS t(nome, tipo, grupo, preco, dias, ordem)
ON CONFLICT DO NOTHING;

-- Com a montagem no ar, os produtos antigos dariam dois caminhos para a mesma marmita.
UPDATE "products"
SET "deletedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
WHERE "deletedAt" IS NULL
  AND "name" IN ('Marmita pequena', 'Marmita média', 'Marmita grande')
  AND "storeId" IN (
    SELECT id FROM "stores"
    WHERE slug IN (
      'peixaria-e-restaurante-rio-piquiri',
      'cantina-da-nona',
      'restaurante-tempero-mineiro',
      'marmitaria-sabor-do-campo'
    )
  );
