import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { isStoreOpen } from '@rapidinho/shared';
import { Logotipo } from '@/components/marca/logo';
import { CartaoDeLoja, type LojaNaVitrine } from '@/components/app/cartao-de-loja';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ cidade: string }> }) {
  const { cidade } = await params;
  const encontrada = await prisma.city.findFirst({
    where: { slug: cidade, isActive: true },
    select: { name: true, state: true },
  });

  if (!encontrada) return { title: 'Cidade não encontrada' };

  return {
    title: `Delivery em ${encontrada.name}`,
    description: `Mercados, farmácias e restaurantes de ${encontrada.name}/${encontrada.state} entregando na sua porta.`,
  };
}

/**
 * Vitrine da cidade.
 *
 * As lojas abertas vêm primeiro, e as fechadas continuam visíveis mais abaixo:
 * esconder a loja fechada faz o cliente achar que ela saiu da plataforma, e
 * ver o cardápio fora do horário é o que traz ele de volta amanhã.
 */
async function carregarVitrine(citySlug: string) {
  const cidade = await prisma.city.findFirst({
    where: { slug: citySlug, isActive: true },
    select: { id: true, name: true, state: true },
  });

  if (!cidade) return null;

  const agora = new Date();

  const [categorias, lojas, banners, impulsionadas] = await Promise.all([
    prisma.storeCategory.findMany({
      where: {
        isActive: true,
        stores: { some: { cityId: cidade.id, status: 'ACTIVE', deletedAt: null } },
      },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, slug: true, iconName: true },
    }),
    prisma.store.findMany({
      where: { cityId: cidade.id, status: 'ACTIVE', deletedAt: null },
      orderBy: [{ ratingAverage: 'desc' }, { orderCount: 'desc' }],
      take: 60,
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
    prisma.banner.findMany({
      where: {
        isActive: true,
        // Banner sem cidade é da plataforma inteira.
        OR: [{ cityId: cidade.id }, { cityId: null }],
        // Datas são opcionais: sem data significa "vale sempre", então o
        // filtro precisa aceitar null em vez de excluir.
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: agora } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: agora } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      take: 5,
      select: { id: true, title: true, linkUrl: true, image: { select: SELECT_IMAGEM } },
    }),
    // Lojas com impulsionamento ativo aparecem em destaque, identificadas
    // como patrocinadas — esconder isso seria propaganda disfarçada.
    prisma.storeBoost.findMany({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: agora },
        endsAt: { gte: agora },
        // O tipo de destaque e o peso vivem no pacote contratado, não no
        // impulsionamento em si.
        package: { placement: 'HOME_HIGHLIGHT' },
        store: { cityId: cidade.id, status: 'ACTIVE', deletedAt: null },
      },
      orderBy: { package: { priority: 'desc' } },
      take: 6,
      select: { storeId: true },
    }),
  ]);

  const idsImpulsionados = new Set(impulsionadas.map((boost) => boost.storeId));

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
      patrocinada: idsImpulsionados.has(loja.id),
    };
  });

  return {
    cidade,
    categorias,
    banners: banners.map((banner) => ({
      id: banner.id,
      titulo: banner.title,
      link: banner.linkUrl,
      imagem: imagemExibivel(banner.image, 'large'),
    })),
    // Abertas primeiro; dentro delas, as patrocinadas no topo.
    lojas: [...comStatus].sort((a, b) => {
      if (a.aberta !== b.aberta) return a.aberta ? -1 : 1;
      if (a.patrocinada !== b.patrocinada) return a.patrocinada ? -1 : 1;
      return b.nota - a.nota;
    }),
  };
}

export default async function CidadePage({
  params,
  searchParams,
}: {
  params: Promise<{ cidade: string }>;
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { cidade: slug } = await params;
  const { categoria: filtro } = await searchParams;
  const dados = await carregarVitrine(slug);

  if (!dados) notFound();

  const lojas = filtro ? dados.lojas.filter((loja) => loja.categoriaSlug === filtro) : dados.lojas;

  const abertas = lojas.filter((loja) => loja.aberta);
  const fechadas = lojas.filter((loja) => !loja.aberta);

  return (
    <main>
      <header className="bg-brand-deep relative overflow-hidden px-5 pb-6 pt-5">
        <div className="bg-radial-glow absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-3">
            <Logotipo className="h-8 w-auto" priority />
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              {dados.cidade.name}
            </Link>
          </div>

          <Link
            href={`/${slug}/busca`}
            className="min-h-touch text-muted-foreground mt-4 flex items-center gap-3 rounded-xl bg-white px-4"
          >
            <Search className="h-5 w-5" aria-hidden />
            Buscar loja ou produto
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-5 py-6">
        {dados.categorias.length > 0 ? (
          <section aria-labelledby="categorias">
            <h2 id="categorias" className="sr-only">
              Categorias
            </h2>
            <ul className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              <li>
                <Link
                  href={`/${slug}`}
                  aria-current={!filtro ? 'true' : undefined}
                  className={`min-h-touch flex items-center whitespace-nowrap rounded-full border-2 px-4 text-sm font-semibold ${
                    !filtro ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                  }`}
                >
                  Tudo
                </Link>
              </li>
              {dados.categorias.map((categoria) => (
                <li key={categoria.id}>
                  <Link
                    href={`/${slug}?categoria=${categoria.slug}`}
                    aria-current={filtro === categoria.slug ? 'true' : undefined}
                    className={`min-h-touch flex items-center whitespace-nowrap rounded-full border-2 px-4 text-sm font-semibold ${
                      filtro === categoria.slug
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input'
                    }`}
                  >
                    {categoria.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {abertas.length > 0 ? (
          <section aria-labelledby="abertas">
            <h2 id="abertas" className="mb-3 text-lg font-bold">
              Abertas agora
            </h2>
            <ul className="space-y-3">
              {abertas.map((loja) => (
                <li key={loja.id}>
                  <CartaoDeLoja loja={loja} cidadeSlug={slug} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-muted-foreground rounded-xl border p-5 text-center">
            Nenhuma loja aberta agora. As de baixo abrem em breve — dá para ver o cardápio e voltar
            depois.
          </p>
        )}

        {fechadas.length > 0 ? (
          <section aria-labelledby="fechadas">
            <h2 id="fechadas" className="mb-3 text-lg font-bold">
              Fechadas no momento
            </h2>
            <ul className="space-y-3">
              {fechadas.map((loja) => (
                <li key={loja.id}>
                  <CartaoDeLoja loja={loja} cidadeSlug={slug} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
