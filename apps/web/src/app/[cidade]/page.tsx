import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronDown, ChevronRight, MapPin, Search, Sparkles } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { isStoreOpen } from '@rapidinho/shared';
import { cn } from '@rapidinho/ui';
import { Logotipo } from '@/components/marca/logo';
import { CartaoDeLoja, type LojaNaVitrine } from '@/components/app/cartao-de-loja';
import { LembrarCidade } from '@/components/app/lembrar-cidade';
import { PecaDeNovo, type PedidoParaRepetir } from '@/components/app/peca-de-novo';
import { MEDIDAS_DA_LANDING } from '@/components/landing/medidas';
import { GRUPOS_DE_CATEGORIA, pertenceAoGrupo } from '@/lib/grupos-de-categoria';
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

  const [lojas, banners, impulsionadas] = await Promise.all([
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

/**
 * O que a vitrine sabe do cliente logado: o endereço padrão nesta cidade
 * ("Rua Principal, 123 - Centro") e os últimos pedidos para repetir.
 */
async function contextoDoCliente(cityId: string) {
  const user = await getCurrentUser();
  if (!user) return { endereco: null, paraRepetir: [] };

  const [endereco, ultimos] = await Promise.all([
    enderecoDeEntrega(user.id, cityId),
    prisma.order.findMany({
      where: {
        userId: user.id,
        cityId,
        status: 'DELIVERED',
        store: { status: 'ACTIVE', deletedAt: null },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 12,
      select: {
        id: true,
        storeId: true,
        totalCents: true,
        store: { select: { name: true, logo: { select: SELECT_IMAGEM } } },
        items: { select: { productName: true, quantity: true }, take: 4 },
      },
    }),
  ]);

  // Um cartão por loja, o pedido mais recente dela.
  const vistas = new Set<string>();
  const paraRepetir: PedidoParaRepetir[] = [];
  for (const pedido of ultimos) {
    if (vistas.has(pedido.storeId) || paraRepetir.length >= 4) continue;
    vistas.add(pedido.storeId);
    paraRepetir.push({
      id: pedido.id,
      loja: pedido.store.name,
      imagem: imagemExibivel(pedido.store.logo).url,
      resumo: pedido.items.map((item) => `${item.quantity}× ${item.productName}`).join(', '),
      totalCents: pedido.totalCents,
    });
  }

  return { endereco, paraRepetir };
}

async function enderecoDeEntrega(userId: string, cityId: string) {
  const endereco = await prisma.address.findFirst({
    where: { userId, cityId, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: { street: true, number: true, neighborhood: true },
  });

  if (!endereco) return null;
  return `${endereco.street}${endereco.number ? `, ${endereco.number}` : ''} - ${endereco.neighborhood}`;
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

  const { endereco, paraRepetir } = await contextoDoCliente(dados.cidade.id);
  const grupo = GRUPOS_DE_CATEGORIA.find((candidato) => candidato.chave === filtro);

  const lojas = grupo
    ? dados.lojas.filter((loja) => pertenceAoGrupo(grupo.chave, loja.categoriaSlug))
    : dados.lojas;

  const abertas = lojas.filter((loja) => loja.aberta);
  const fechadas = lojas.filter((loja) => !loja.aberta);

  return (
    <main className="mx-auto max-w-lg">
      <LembrarCidade slug={slug} />

      <header className="px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex justify-center">
          <Logotipo className="h-11 w-auto" priority />
        </div>

        {/* "Entregar em": com endereço salvo, é ele; sem, é a cidade — e o
            toque leva a quem resolve (endereços ou troca de cidade). */}
        <Link
          href={endereco ? '/enderecos' : '/app?trocar=1'}
          className="mt-4 flex items-center gap-2.5 rounded-xl py-1"
        >
          <MapPin className="text-primary h-7 w-7 shrink-0" strokeWidth={2.2} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground block text-xs leading-tight">Entregar em</span>
            <span className="flex items-center gap-1 font-semibold leading-snug">
              <span className="truncate">
                {endereco ?? `${dados.cidade.name}/${dados.cidade.state}`}
              </span>
              <ChevronDown className="text-primary h-4 w-4 shrink-0" aria-hidden />
            </span>
          </span>
        </Link>

        <Link
          href={`/${slug}/busca`}
          className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 text-[15px] text-neutral-500 shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
        >
          <Search className="h-5 w-5 text-neutral-700" aria-hidden />O que você precisa hoje?
        </Link>
      </header>

      <div className="space-y-7 px-5 pt-4">
        <section aria-labelledby="categorias">
          <h2 id="categorias" className="sr-only">
            Categorias
          </h2>
          <ul className="grid grid-cols-3 gap-3">
            {GRUPOS_DE_CATEGORIA.map((atalho) => {
              const ativo = atalho.chave === grupo?.chave;
              return (
                <li key={atalho.chave}>
                  <Link
                    // Tocar de novo no atalho ativo volta para "tudo".
                    href={ativo ? `/${slug}` : `/${slug}?categoria=${atalho.chave}`}
                    aria-current={ativo ? 'true' : undefined}
                    scroll={false}
                    className={cn(
                      'flex aspect-[1/0.92] flex-col items-center justify-center gap-2 rounded-2xl bg-white px-1 text-center shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition-transform active:scale-95',
                      ativo && 'ring-primary ring-4',
                    )}
                  >
                    <span className="flex h-12 items-center justify-center">
                      <Image
                        src={`/landing/${atalho.imagem}`}
                        {...MEDIDAS_DA_LANDING[atalho.imagem]}
                        alt=""
                        className="max-h-12 w-auto"
                      />
                    </span>
                    <span className="text-[13px] font-semibold text-neutral-900">
                      {atalho.nome}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Faixa da arte: é também a porta do pedido por lista. */}
        <Link
          href={`/${slug}/pedir`}
          className="relative flex min-h-[8.5rem] items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#141416] via-[#1a1a1d] to-[#2a2010] p-5"
        >
          <span className="relative z-10 max-w-[60%]">
            <span className="block text-[17px] font-bold leading-snug">
              Tudo o que você precisa, <span className="text-primary">a um toque</span> de
              distância.
            </span>
            <span className="text-primary mt-2 inline-flex items-center gap-1 text-sm font-semibold">
              <Sparkles className="h-4 w-4" aria-hidden />
              Pedir por lista
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          </span>
          <Image
            src="/landing/motoboy.webp"
            {...MEDIDAS_DA_LANDING['motoboy.webp']}
            alt=""
            sizes="200px"
            className="absolute -bottom-3 -right-4 h-auto w-[50%] drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
          />
        </Link>

        {paraRepetir.length > 0 ? <PecaDeNovo pedidos={paraRepetir} /> : null}

        {dados.banners.some((banner) => banner.imagem.url) ? (
          <section aria-label="Destaques">
            <ul className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5">
              {dados.banners.map((banner) =>
                banner.imagem.url ? (
                  <li key={banner.id} className="w-[85%] shrink-0 snap-start">
                    <Link href={banner.link ?? `/${slug}`} className="block">
                      <Image
                        src={banner.imagem.url}
                        alt={banner.titulo}
                        width={640}
                        height={260}
                        className="aspect-[64/26] w-full rounded-2xl object-cover"
                      />
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        ) : null}

        {grupo ? (
          <p className="text-muted-foreground -mb-3 text-sm">
            Mostrando <strong className="text-foreground">{grupo.nome}</strong> ·{' '}
            <Link href={`/${slug}`} scroll={false} className="text-primary-text font-semibold">
              ver tudo
            </Link>
          </p>
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
          <p className="text-muted-foreground bg-card rounded-2xl border p-5 text-center">
            {lojas.length === 0
              ? 'Ainda não há lojas nesta categoria na sua cidade.'
              : 'Nenhuma loja aberta agora. As de baixo abrem em breve — dá para ver o cardápio e voltar depois.'}
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
