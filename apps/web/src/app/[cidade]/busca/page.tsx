import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { Card, CardContent } from '@rapidinho/ui';
import { formatCents, isStoreOpen } from '@rapidinho/shared';
import { CartaoDeLoja, type LojaNaVitrine } from '@/components/app/cartao-de-loja';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Buscar' };

/**
 * Busca em lojas e produtos.
 *
 * O casamento é feito em SQL cru, e não com `contains` do Prisma, por dois
 * motivos que só aparecem no `EXPLAIN`:
 *
 * 1. Acento. Os índices são sobre `immutable_unaccent(lower(name))`, e
 *    `contains` gera `name ILIKE '%termo%'` — expressão diferente, índice
 *    ignorado e, pior, "acai" deixa de achar "Açaí". Quem digita no celular
 *    pula o acento; a busca precisa não se importar.
 *
 * 2. Plano. Medido no banco de desenvolvimento: `ILIKE` sobre a coluna dá
 *    Seq Scan; a expressão do índice dá Bitmap Index Scan. Com 113 produtos a
 *    diferença não aparece — com a plataforma cheia, aparece na conta da VPS.
 *
 * O SQL devolve só os ids; os dados continuam vindo pelo Prisma, que mantém os
 * filtros de cidade e status na camada de query.
 */

/** Termo pronto para `LIKE`, com os curingas do usuário neutralizados. */
function paraLike(termo: string): string {
  return `%${termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`;
}
async function buscar(citySlug: string, termo: string) {
  const cidade = await prisma.city.findFirst({
    where: { slug: citySlug, isActive: true },
    select: { id: true, name: true },
  });

  if (!cidade) return null;

  if (termo.length < 2) {
    return { cidade, lojas: [], produtos: [] };
  }

  const agora = new Date();
  const alvo = paraLike(termo);

  // Ids primeiro, pelo índice. `$queryRaw` com template interpola como
  // parâmetro preparado — o termo do usuário nunca vira SQL.
  const [idsDeLoja, idsDeProduto] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT s."id"
      FROM "stores" s
      LEFT JOIN "store_categories" c ON c."id" = s."categoryId"
      WHERE s."cityId" = ${cidade.id}
        AND s."status" = 'ACTIVE'
        AND s."deletedAt" IS NULL
        AND (
          immutable_unaccent(lower(s."name")) LIKE immutable_unaccent(lower(${alvo}))
          OR immutable_unaccent(lower(coalesce(s."description", ''))) LIKE immutable_unaccent(lower(${alvo}))
          OR immutable_unaccent(lower(coalesce(c."name", ''))) LIKE immutable_unaccent(lower(${alvo}))
        )
      LIMIT 20
    `,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id"
      FROM "products" p
      JOIN "stores" s ON s."id" = p."storeId"
      WHERE s."cityId" = ${cidade.id}
        AND s."status" = 'ACTIVE'
        AND s."deletedAt" IS NULL
        AND p."deletedAt" IS NULL
        AND p."isAvailable" = true
        AND immutable_unaccent(lower(p."name")) LIKE immutable_unaccent(lower(${alvo}))
      ORDER BY p."soldCount" DESC
      LIMIT 30
    `,
  ]);

  const [lojas, produtos] = await Promise.all([
    prisma.store.findMany({
      where: {
        id: { in: idsDeLoja.map((linha) => linha.id) },
        // Os mesmos filtros do SQL acima, de novo: a regra do projeto é que
        // toda query multi-tenant filtre na camada de query, e uma lista de
        // ids vinda de outra consulta não dispensa isso.
        cityId: cidade.id,
        status: 'ACTIVE',
        deletedAt: null,
      },
      take: 20,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        ratingAverage: true,
        ratingCount: true,
        deliveryFeeMode: true,
        deliveryFeeCents: true,
        minOrderCents: true,
        avgPrepTimeMinutes: true,
        avgDeliveryTimeMinutes: true,
        isPausedUntil: true,
        pauseReason: true,
        category: { select: { name: true, slug: true } },
        logo: { select: SELECT_IMAGEM },
        hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
        closures: {
          where: { endsAt: { gte: agora } },
          select: { startsAt: true, endsAt: true, reason: true },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        id: { in: idsDeProduto.map((linha) => linha.id) },
        deletedAt: null,
        isAvailable: true,
        store: { cityId: cidade.id, status: 'ACTIVE', deletedAt: null },
      },
      take: 30,
      orderBy: { soldCount: 'desc' },
      select: {
        id: true,
        name: true,
        priceCents: true,
        sellingUnit: true,
        store: { select: { name: true, slug: true } },
      },
    }),
  ]);

  const comStatus: LojaNaVitrine[] = lojas.map((loja) => {
    const abertura = isStoreOpen({
      hours: loja.hours,
      closures: loja.closures,
      pausedUntil: loja.isPausedUntil,
      pauseReason: loja.pauseReason,
    });

    return {
      id: loja.id,
      nome: loja.name,
      slug: loja.slug,
      descricao: loja.description,
      categoria: loja.category?.name ?? null,
      categoriaSlug: loja.category?.slug ?? null,
      nota: Number(loja.ratingAverage),
      avaliacoes: loja.ratingCount,
      taxaCents: loja.deliveryFeeMode === 'FREE' ? 0 : loja.deliveryFeeCents,
      taxaGratis: loja.deliveryFeeMode === 'FREE',
      minimoCents: loja.minOrderCents,
      tempoMin: loja.avgPrepTimeMinutes + loja.avgDeliveryTimeMinutes,
      aberta: abertura.isOpen,
      motivoFechada: abertura.reason ?? null,
      imagem: imagemExibivel(loja.logo),
      patrocinada: false,
    };
  });

  return { cidade, lojas: comStatus, produtos };
}

export default async function BuscaPage({
  params,
  searchParams,
}: {
  params: Promise<{ cidade: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { cidade: slug } = await params;
  const { q } = await searchParams;
  const termo = (q ?? '').trim();

  const resultado = await buscar(slug, termo);
  if (!resultado) notFound();

  return (
    <main className="mx-auto max-w-lg px-5 py-5">
      <div className="flex items-center gap-3">
        <Link href={`/${slug}`} aria-label="Voltar" className="shrink-0">
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </Link>

        <form action={`/${slug}/busca`} className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={termo}
            autoFocus
            placeholder="Buscar loja ou produto"
            aria-label="Buscar"
            className="border-input min-h-touch w-full rounded-xl border pl-10 pr-3"
          />
        </form>
      </div>

      {termo.length < 2 ? (
        <p className="text-muted-foreground mt-8 text-center">
          Digite pelo menos duas letras para buscar em {resultado.cidade.name}.
        </p>
      ) : resultado.lojas.length === 0 && resultado.produtos.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-center">
          Nada encontrado para &quot;{termo}&quot;. Tente outra palavra — buscar pelo tipo de loja
          (mercado, farmácia) costuma achar mais.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {resultado.lojas.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-bold">Lojas</h2>
              <ul className="space-y-3">
                {resultado.lojas.map((loja) => (
                  <li key={loja.id}>
                    <CartaoDeLoja loja={loja} cidadeSlug={slug} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {resultado.produtos.length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-bold">Produtos</h2>
              <ul className="space-y-2">
                {resultado.produtos.map((produto) => (
                  <li key={produto.id}>
                    <Link href={`/${slug}/produto/${produto.id}`}>
                      <Card className="hover:border-primary transition-colors">
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{produto.name}</p>
                            <p className="text-muted-foreground truncate text-sm">
                              {produto.store.name}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold">
                            {formatCents(produto.priceCents)}
                            {produto.sellingUnit === 'WEIGHT_KG' ? (
                              <span className="text-muted-foreground text-sm"> /kg</span>
                            ) : null}
                          </span>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
