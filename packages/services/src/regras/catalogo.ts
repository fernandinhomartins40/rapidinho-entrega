import { prisma, type Prisma } from '@rapidinho/database';
import {
  faixaDeTempo,
  imagemExibivel,
  isStoreOpen,
  marmitaNoCardapioHoje,
  rotuloDoHorario,
  saborDisponivelAgora,
  SELECT_IMAGEM,
  situacaoDoProduto,
  STORE_SEGMENT_LABEL,
} from '@rapidinho/shared';
import type {
  BannerDaVitrine,
  CategoriaDaVitrine,
  LojaDaVitrine,
  LojaDetalhada,
  ProdutoDaVitrine,
  ProdutoDetalhado,
  ProdutoDoCardapio,
  ResultadoDaBusca,
  Segmento,
  Vitrine,
} from '@rapidinho/shared/app-api';
import { pratosDaCidade } from './pratos';

/**
 * Leituras do catálogo.
 *
 * O que decide o que aparece (banner vigente, ordem da vitrine, busca) fica em
 * funções que a página do site também chama. A forma entregue ao app é a do
 * contrato em `@rapidinho/shared/app-api`.
 */

/** Campos da loja que o cartão da vitrine precisa. */
export function selectDaLojaNaVitrine(agora: Date) {
  return {
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
    sellsAtCounterPrice: true,
    segment: true,
    city: { select: { slug: true } },
    category: { select: { name: true, slug: true } },
    logo: { select: SELECT_IMAGEM },
    hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
    closures: {
      where: { endsAt: { gte: agora } },
      select: { startsAt: true, endsAt: true, reason: true },
    },
  } as const;
}

interface LojaDoBanco {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ratingAverage: unknown;
  ratingCount: number;
  deliveryFeeMode: string;
  deliveryFeeCents: number;
  minOrderCents: number;
  avgPrepTimeMinutes: number;
  avgDeliveryTimeMinutes: number;
  isPausedUntil: Date | null;
  pauseReason: string | null;
  sellsAtCounterPrice: boolean;
  category: { name: string; slug: string } | null;
  logo: Parameters<typeof imagemExibivel>[0];
  hours: Parameters<typeof isStoreOpen>[0]['hours'];
  closures: Parameters<typeof isStoreOpen>[0]['closures'];
}

/** Loja como o cartão do site a mostra. */
export function paraLojaNaVitrine(loja: LojaDoBanco, patrocinada = false) {
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
    patrocinada,
    precoDeBalcao: loja.sellsAtCounterPrice,
  };
}

/** Abertas primeiro; dentro delas, patrocinadas, preço de balcão e nota. */
export function compararLojasDaVitrine(
  a: { aberta: boolean; patrocinada: boolean; precoDeBalcao: boolean; nota: number },
  b: { aberta: boolean; patrocinada: boolean; precoDeBalcao: boolean; nota: number },
): number {
  if (a.aberta !== b.aberta) return a.aberta ? -1 : 1;
  if (a.patrocinada !== b.patrocinada) return a.patrocinada ? -1 : 1;
  // Depois do anúncio, quem vende pelo preço do balcão: é o compromisso que
  // mais importa para quem compra mercado e farmácia.
  if (a.precoDeBalcao !== b.precoDeBalcao) return a.precoDeBalcao ? -1 : 1;
  return b.nota - a.nota;
}

/** Banner no ar nesta cidade agora. */
export function filtroDeBannerAtivo(cityId: string, agora: Date): Prisma.BannerWhereInput {
  return {
    isActive: true,
    // Banner sem cidade é da plataforma inteira.
    OR: [{ cityId }, { cityId: null }],
    // Datas são opcionais: sem data significa "vale sempre", então o filtro
    // precisa aceitar null em vez de excluir.
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: agora } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: agora } }] },
    ],
  };
}

/**
 * Lojas com impulsionamento ativo: aparecem em destaque, identificadas como
 * patrocinadas. Esconder isso seria propaganda disfarçada.
 */
export async function lojasPatrocinadas(cityId: string, agora: Date): Promise<Set<string>> {
  const impulsionadas = await prisma.storeBoost.findMany({
    where: {
      status: 'ACTIVE',
      startsAt: { lte: agora },
      endsAt: { gte: agora },
      // O tipo de destaque e o peso vivem no pacote contratado, não no
      // impulsionamento em si.
      package: { placement: 'HOME_HIGHLIGHT' },
      store: { cityId, status: 'ACTIVE', deletedAt: null },
    },
    orderBy: { package: { priority: 'desc' } },
    take: 6,
    select: { storeId: true },
  });

  return new Set(impulsionadas.map((boost) => boost.storeId));
}

/** Código no parâmetro `cupom` do link, que é como o checkout já o recebe. */
function cupomDoLink(linkUrl: string | null): string | null {
  if (!linkUrl) return null;
  try {
    return new URL(linkUrl).searchParams.get('cupom')?.trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

/**
 * Cupons de campanha ainda válidos, entre os citados nos banners.
 *
 * Banner não tem ligação com cupom no banco: a campanha o cita no link. Publicar
 * só o que o link cita, e só enquanto vale, evita expor código reservado de
 * loja (cupom não tem marca de "público") e selo de cupom vencido na vitrine.
 */
async function cuponsValidos(
  cityId: string,
  banners: { linkUrl: string | null; storeId: string | null }[],
  agora: Date,
): Promise<Set<string>> {
  const citados = banners.flatMap(({ linkUrl, storeId }) => {
    const code = cupomDoLink(linkUrl);
    return code ? [{ code, storeId }] : [];
  });
  if (citados.length === 0) return new Set();

  const cupons = await prisma.coupon.findMany({
    where: {
      code: { in: citados.map((citado) => citado.code) },
      isActive: true,
      startsAt: { lte: agora },
      AND: [
        { OR: [{ endsAt: null }, { endsAt: { gte: agora } }] },
        {
          OR: [
            { storeId: { in: citados.flatMap((c) => (c.storeId ? [c.storeId] : [])) } },
            { scope: 'PLATFORM', OR: [{ cityId }, { cityId: null }] },
          ],
        },
      ],
    },
    select: { code: true, usageLimit: true, usageCount: true, scope: true, storeId: true },
  });

  const chave = (code: string, storeId: string | null) => `${code}|${storeId ?? ''}`;
  const validos = new Set<string>();

  for (const citado of citados) {
    const vale = cupons.some(
      (cupom) =>
        cupom.code === citado.code &&
        (cupom.usageLimit == null || cupom.usageCount < cupom.usageLimit) &&
        (cupom.scope === 'PLATFORM' || cupom.storeId === citado.storeId),
    );
    if (vale) validos.add(chave(citado.code, citado.storeId));
  }

  return validos;
}

async function bannersDaVitrine(cityId: string, agora: Date): Promise<BannerDaVitrine[]> {
  const banners = await prisma.banner.findMany({
    where: filtroDeBannerAtivo(cityId, agora),
    orderBy: { sortOrder: 'asc' },
    take: 5,
    select: {
      id: true,
      title: true,
      linkUrl: true,
      storeId: true,
      image: { select: SELECT_IMAGEM },
      store: { select: { slug: true, status: true, deletedAt: true } },
    },
  });

  const validos = await cuponsValidos(cityId, banners, agora);

  return banners.flatMap((banner) => {
    const imagemUrl = imagemExibivel(banner.image, 'large').url;
    // Variante ainda em processamento: o site também pula.
    if (!imagemUrl) return [];

    const noAr = banner.store?.status === 'ACTIVE' && banner.store.deletedAt == null;
    const cupom = cupomDoLink(banner.linkUrl);

    return [
      {
        id: banner.id,
        titulo: banner.title,
        imagemUrl,
        // Loja suspensa não pode ser destino de campanha.
        lojaSlug: noAr ? banner.store!.slug : null,
        linkUrl: banner.linkUrl,
        cupom: cupom && validos.has(`${cupom}|${banner.storeId ?? ''}`) ? cupom : null,
      },
    ];
  });
}

/** Soma uma impressão ou clique; banner fora do ar não conta. */
export async function contarNoBanner(
  id: string,
  campo: 'impressions' | 'clicks',
): Promise<boolean> {
  const { count } = await prisma.banner.updateMany({
    where: { id, isActive: true },
    data: { [campo]: { increment: 1 } },
  });
  return count > 0;
}

function selectDaLojaNoApp(agora: Date) {
  return { ...selectDaLojaNaVitrine(agora), cover: { select: SELECT_IMAGEM } } as const;
}

interface LojaDoApp extends LojaDoBanco {
  segment: string;
  cover: Parameters<typeof imagemExibivel>[0];
}

function paraLojaDoApp(loja: LojaDoApp, patrocinada = false): LojaDaVitrine {
  const abertura = isStoreOpen({
    hours: loja.hours,
    closures: loja.closures,
    pausedUntil: loja.isPausedUntil,
    pauseReason: loja.pauseReason,
  });
  const base = paraLojaNaVitrine(loja, patrocinada);
  const segmento = loja.segment as Segmento;

  return {
    id: base.id,
    slug: base.slug,
    nome: base.nome,
    logoUrl: base.imagem.url,
    capaUrl: imagemExibivel(loja.cover, 'large').url,
    categoria: base.categoria ?? STORE_SEGMENT_LABEL[segmento],
    categoriaSlug: base.categoriaSlug,
    segmento,
    nota: base.nota,
    avaliacoes: base.avaliacoes,
    taxaCents: base.taxaCents,
    taxaGratis: base.taxaGratis,
    ...faixaDeTempo(loja.avgPrepTimeMinutes, loja.avgDeliveryTimeMinutes),
    pedidoMinimoCents: base.minimoCents,
    aberta: base.aberta,
    rotuloHorario: rotuloDoHorario(abertura),
    patrocinada: base.patrocinada,
    precoDeBalcao: base.precoDeBalcao,
  };
}

export async function listarCidades() {
  const cidades = await prisma.city.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true, state: true },
  });
  return cidades.map(({ state, name, ...cidade }) => ({ ...cidade, nome: name, uf: state }));
}

export async function cidadeAtiva(slug: string) {
  return prisma.city.findFirst({
    where: { slug, isActive: true },
    select: { id: true, slug: true, name: true, state: true },
  });
}

export async function vitrineDoApp(slug: string): Promise<Vitrine | null> {
  const cidade = await cidadeAtiva(slug);
  if (!cidade) return null;

  const agora = new Date();

  const [lojas, banners, patrocinadas, pratos] = await Promise.all([
    prisma.store.findMany({
      where: { cityId: cidade.id, status: 'ACTIVE', deletedAt: null },
      orderBy: [{ ratingAverage: 'desc' }, { orderCount: 'desc' }],
      take: 60,
      select: selectDaLojaNoApp(agora),
    }),
    bannersDaVitrine(cidade.id, agora),
    lojasPatrocinadas(cidade.id, agora),
    pratosDaCidade(cidade.id, { agora }),
  ]);

  const categorias = new Map<string, CategoriaDaVitrine>();
  const segmentos = new Map<string, Segmento>();

  for (const loja of lojas) {
    segmentos.set(loja.id, loja.segment as Segmento);
    if (!loja.category) continue;

    const categoria = categorias.get(loja.category.slug);
    if (categoria) categoria.quantidadeDeLojas += 1;
    else {
      categorias.set(loja.category.slug, {
        slug: loja.category.slug,
        nome: loja.category.name,
        segmento: loja.segment as Segmento,
        quantidadeDeLojas: 1,
      });
    }
  }

  // Só produto: sabor de pizza não tem página própria, e o app abre o item.
  const saindoAgora: ProdutoDaVitrine[] = pratos
    .filter((prato) => prato.chave.startsWith('p:'))
    .slice(0, 12)
    .map((prato) => ({
      id: prato.chave.slice(2),
      nome: prato.nome,
      precoCents: prato.precoCents,
      imagemUrl: prato.imagem,
      lojaId: prato.loja.id,
      lojaSlug: prato.loja.slug,
      lojaNome: prato.loja.nome,
      categoriaSlug: prato.loja.categoriaSlug,
      segmento: segmentos.get(prato.loja.id) ?? 'RESTAURANT',
      tempoMin: prato.tempoMin,
      emAlta: prato.emAlta,
    }));

  return {
    cidade: { id: cidade.id, slug: cidade.slug, nome: cidade.name, uf: cidade.state },
    banners,
    categorias: [...categorias.values()].sort(
      (a, b) => b.quantidadeDeLojas - a.quantidadeDeLojas || a.nome.localeCompare(b.nome),
    ),
    saindoAgora,
    lojas: lojas
      .map((loja) => paraLojaDoApp(loja, patrocinadas.has(loja.id)))
      .sort(compararLojasDaVitrine),
  };
}

const SELECT_DO_PRODUTO_NO_CARDAPIO = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  compareAtPriceCents: true,
  sellingUnit: true,
  isAvailable: true,
  pausedUntil: true,
  isFeatured: true,
  productType: true,
  image: { select: SELECT_IMAGEM },
  _count: { select: { complementGroups: true } },
} as const;

const DIAS_DOS_MAIS_PEDIDOS = 90;
const MAIS_PEDIDOS_NA_LOJA = 12;

export async function lojaDoApp(
  citySlug: string,
  storeSlug: string,
  userId: string | null,
): Promise<LojaDetalhada | null> {
  const agora = new Date();

  const loja = await prisma.store.findFirst({
    where: {
      slug: storeSlug,
      status: 'ACTIVE',
      deletedAt: null,
      city: { slug: citySlug, isActive: true },
    },
    select: {
      ...selectDaLojaNoApp(agora),
      phone: true,
      whatsapp: true,
      street: true,
      number: true,
      neighborhood: true,
      freeDeliveryAboveCents: true,
      acceptsPickup: true,
      acceptsPix: true,
      acceptsCashOnDelivery: true,
      acceptsCardOnDelivery: true,
      pizzaPricingRule: true,
      menuCategories: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          products: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: SELECT_DO_PRODUTO_NO_CARDAPIO,
          },
        },
      },
      // Produtos sem categoria não podem sumir do cardápio só porque o lojista
      // não organizou: eles entram numa seção própria.
      products: {
        where: { deletedAt: null, categoryId: null },
        orderBy: { name: 'asc' },
        select: SELECT_DO_PRODUTO_NO_CARDAPIO,
      },
      pizzaSizes: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, description: true, maxFlavors: true, slices: true },
      },
      marmitaSizes: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
        select: { id: true, name: true, description: true, priceCents: true, maxMisturas: true },
      },
      marmitaItems: {
        where: marmitaNoCardapioHoje(agora),
        orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, kind: true, groupName: true, priceCents: true },
      },
      pizzaFlavors: {
        where: saborDisponivelAgora(agora),
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          groupName: true,
          prices: { select: { sizeId: true, priceCents: true } },
        },
      },
      pizzaExtras: {
        where: { isAvailable: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, kind: true, priceCents: true },
      },
    },
  });

  if (!loja) return null;

  const mapear = (produto: (typeof loja.products)[number]): ProdutoDoCardapio => ({
    id: produto.id,
    nome: produto.name,
    descricao: produto.description,
    precoCents: produto.priceCents,
    precoDeCents:
      produto.compareAtPriceCents != null && produto.compareAtPriceCents > produto.priceCents
        ? produto.compareAtPriceCents
        : null,
    porPeso: produto.sellingUnit === 'WEIGHT_KG',
    disponivel:
      produto.isAvailable && (produto.pausedUntil == null || produto.pausedUntil <= agora),
    imagemUrl: imagemExibivel(produto.image).url,
    destaque: produto.isFeatured,
    temOpcoes: produto.productType !== 'SIMPLE' || produto._count.complementGroups > 0,
  });

  // Últimos comentários, bons e ruins: escolher só os elogios seria vitrine, não
  // avaliação. Ocultado pela plataforma fica de fora; do cliente, só o primeiro
  // nome.
  const [comentarios, favorita, promocoes, maisPedidos] = await Promise.all([
    prisma.review.findMany({
      where: { storeId: loja.id, hiddenAt: null, comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        rating: true,
        comment: true,
        replyText: true,
        createdAt: true,
        order: { select: { customerName: true } },
      },
    }),
    userId
      ? prisma.favoriteStore.count({ where: { userId, storeId: loja.id } })
      : Promise.resolve(0),
    prisma.storePromotion.findMany({
      where: {
        storeId: loja.id,
        isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gt: agora } }],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        subtitle: true,
        image: { select: SELECT_IMAGEM },
        products: { orderBy: { sortOrder: 'asc' }, select: { productId: true } },
      },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { not: null },
        order: {
          storeId: loja.id,
          status: 'DELIVERED',
          createdAt: { gt: new Date(agora.getTime() - DIAS_DOS_MAIS_PEDIDOS * 86_400_000) },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: MAIS_PEDIDOS_NA_LOJA,
    }),
  ]);

  return {
    ...paraLojaDoApp(loja),
    descricao: loja.description,
    telefone: loja.phone,
    whatsapp: loja.whatsapp,
    endereco: `${[loja.street, loja.number].filter(Boolean).join(', ')} — ${loja.neighborhood}`,
    aceitaRetirada: loja.acceptsPickup,
    aceitaPix: loja.acceptsPix,
    aceitaDinheiro: loja.acceptsCashOnDelivery,
    aceitaCartaoNaEntrega: loja.acceptsCardOnDelivery,
    entregaGratisAcimaCents: loja.freeDeliveryAboveCents,
    favorita: favorita > 0,
    promocoes: promocoes.map((promocao) => ({
      id: promocao.id,
      titulo: promocao.title,
      subtitulo: promocao.subtitle,
      imagemUrl: imagemExibivel(promocao.image, 'large').url,
      produtoIds: promocao.products.map((item) => item.productId),
    })),
    maisPedidosIds: maisPedidos.flatMap((linha) => (linha.productId ? [linha.productId] : [])),
    secoes: [
      ...loja.menuCategories
        .filter((categoria) => categoria.products.length > 0)
        .map((categoria) => ({
          id: categoria.id,
          nome: categoria.name,
          descricao: categoria.description,
          produtos: categoria.products.map(mapear),
        })),
      ...(loja.products.length > 0
        ? [
            {
              id: 'sem-categoria',
              nome: 'Outros',
              descricao: null,
              produtos: loja.products.map(mapear),
            },
          ]
        : []),
    ],
    pizza:
      loja.pizzaSizes.length === 0
        ? null
        : {
            regra: loja.pizzaPricingRule === 'AVERAGE_PRICE' ? 'AVERAGE_PRICE' : 'HIGHEST_PRICE',
            tamanhos: loja.pizzaSizes.map((tamanho) => ({
              id: tamanho.id,
              nome: tamanho.name,
              descricao: tamanho.description,
              maxSabores: tamanho.maxFlavors,
              fatias: tamanho.slices,
            })),
            sabores: loja.pizzaFlavors.map((sabor) => ({
              id: sabor.id,
              nome: sabor.name,
              descricao: sabor.description,
              grupo: sabor.groupName ?? 'Sabores',
              precos: Object.fromEntries(
                sabor.prices.map((preco) => [preco.sizeId, preco.priceCents]),
              ),
            })),
            extras: loja.pizzaExtras.map((extra) => ({
              id: extra.id,
              nome: extra.name,
              tipo:
                extra.kind === 'CRUST' ? 'CRUST' : extra.kind === 'TOPPING' ? 'TOPPING' : 'EDGE',
              precoCents: extra.priceCents,
            })),
          },
    // Sem mistura hoje não há marmita para montar: o cartão some do cardápio.
    marmita:
      loja.marmitaSizes.length === 0 || !loja.marmitaItems.some((item) => item.kind === 'MISTURA')
        ? null
        : {
            tamanhos: loja.marmitaSizes.map((tamanho) => ({
              id: tamanho.id,
              nome: tamanho.name,
              descricao: tamanho.description,
              precoCents: tamanho.priceCents,
              maxMisturas: tamanho.maxMisturas,
            })),
            itens: loja.marmitaItems.map((item) => ({
              id: item.id,
              nome: item.name,
              tipo: item.kind,
              grupo: item.groupName,
              precoCents: item.priceCents,
            })),
          },
    comentarios: comentarios.map((avaliacao) => ({
      id: avaliacao.id,
      nota: avaliacao.rating,
      comentario: avaliacao.comment ?? '',
      resposta: avaliacao.replyText,
      autor: avaliacao.order.customerName.split(' ')[0] ?? '',
      criadoEm: avaliacao.createdAt.toISOString(),
    })),
  };
}

export async function produtoDoApp(citySlug: string, id: string): Promise<ProdutoDetalhado | null> {
  const agora = new Date();

  const produto = await prisma.product.findFirst({
    where: {
      id,
      deletedAt: null,
      store: { status: 'ACTIVE', deletedAt: null, city: { slug: citySlug, isActive: true } },
    },
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      compareAtPriceCents: true,
      sellingUnit: true,
      weightStepGrams: true,
      minWeightGrams: true,
      isAvailable: true,
      pausedUntil: true,
      stockQuantity: true,
      prescription: true,
      ageRestricted: true,
      image: { select: SELECT_IMAGEM },
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          isPausedUntil: true,
          pauseReason: true,
          hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
          closures: {
            where: { endsAt: { gte: agora } },
            select: { startsAt: true, endsAt: true, reason: true },
          },
        },
      },
      complementGroups: {
        orderBy: { sortOrder: 'asc' },
        select: {
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              isRequired: true,
              minChoices: true,
              maxChoices: true,
              allowRepeat: true,
              isActive: true,
              options: {
                where: { isAvailable: true },
                orderBy: { sortOrder: 'asc' },
                select: { id: true, name: true, description: true, priceCents: true },
              },
            },
          },
        },
      },
    },
  });

  if (!produto) return null;

  const abertura = isStoreOpen({
    hours: produto.store.hours,
    closures: produto.store.closures,
    pausedUntil: produto.store.isPausedUntil,
    pauseReason: produto.store.pauseReason,
  });

  return {
    id: produto.id,
    nome: produto.name,
    descricao: produto.description,
    precoCents: produto.priceCents,
    precoDeCents: produto.compareAtPriceCents,
    porPeso: produto.sellingUnit === 'WEIGHT_KG',
    passoGramas: produto.weightStepGrams ?? 100,
    minimoGramas: produto.minWeightGrams ?? 100,
    ...situacaoDoProduto(produto, agora),
    receita: produto.prescription,
    maiorDeIdade: produto.ageRestricted,
    imagemUrl: imagemExibivel(produto.image, 'large').url,
    loja: {
      id: produto.store.id,
      nome: produto.store.name,
      slug: produto.store.slug,
      aberta: abertura.isOpen,
      motivoFechada: abertura.reason ?? null,
    },
    grupos: produto.complementGroups
      .map((vinculo) => vinculo.group)
      .filter((grupo) => grupo.isActive && grupo.options.length > 0)
      .map((grupo) => ({
        id: grupo.id,
        nome: grupo.name,
        descricao: grupo.description,
        obrigatorio: grupo.isRequired,
        minimo: grupo.minChoices,
        maximo: grupo.maxChoices,
        permiteRepetir: grupo.allowRepeat,
        opcoes: grupo.options.map((opcao) => ({
          id: opcao.id,
          nome: opcao.name,
          descricao: opcao.description,
          precoCents: opcao.priceCents,
        })),
      })),
  };
}

/** Termo pronto para `LIKE`, com os curingas do usuário neutralizados. */
export function paraLike(termo: string): string {
  return `%${termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`;
}

/**
 * Ids da busca, pelos índices sobre `immutable_unaccent(lower(...))`: `contains`
 * do Prisma ignora o índice e faz "acai" deixar de achar "Açaí". Os dados vêm
 * depois pelo Prisma, que mantém os filtros de cidade e status.
 */
export async function idsDaBusca(cityId: string, termo: string) {
  const alvo = paraLike(termo);

  // `$queryRaw` com template interpola como parâmetro preparado: o termo do
  // usuário nunca vira SQL.
  const [lojas, produtos] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT s."id"
      FROM "stores" s
      LEFT JOIN "store_categories" c ON c."id" = s."categoryId"
      WHERE s."cityId" = ${cityId}
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
      WHERE s."cityId" = ${cityId}
        AND s."status" = 'ACTIVE'
        AND s."deletedAt" IS NULL
        AND p."deletedAt" IS NULL
        AND p."isAvailable" = true
        AND immutable_unaccent(lower(p."name")) LIKE immutable_unaccent(lower(${alvo}))
      ORDER BY p."soldCount" DESC
      LIMIT 30
    `,
  ]);

  return {
    idsDeLoja: lojas.map((linha) => linha.id),
    idsDeProduto: produtos.map((linha) => linha.id),
  };
}

export async function buscaDoApp(
  citySlug: string,
  termo: string,
): Promise<ResultadoDaBusca | null> {
  const cidade = await cidadeAtiva(citySlug);
  if (!cidade) return null;

  if (termo.length < 2) return { lojas: [], produtos: [] };

  const agora = new Date();
  const { idsDeLoja, idsDeProduto } = await idsDaBusca(cidade.id, termo);

  const [lojas, produtos] = await Promise.all([
    prisma.store.findMany({
      where: { id: { in: idsDeLoja }, cityId: cidade.id, status: 'ACTIVE', deletedAt: null },
      take: 20,
      select: selectDaLojaNoApp(agora),
    }),
    prisma.product.findMany({
      where: {
        id: { in: idsDeProduto },
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
        image: { select: SELECT_IMAGEM },
        store: { select: { name: true, slug: true } },
      },
    }),
  ]);

  return {
    lojas: lojas.map((loja) => paraLojaDoApp(loja)),
    produtos: produtos.map((produto) => ({
      id: produto.id,
      nome: produto.name,
      precoCents: produto.priceCents,
      porPeso: produto.sellingUnit === 'WEIGHT_KG',
      imagemUrl: imagemExibivel(produto.image).url,
      lojaNome: produto.store.name,
      lojaSlug: produto.store.slug,
    })),
  };
}

export async function favoritosDoApp(userId: string) {
  const favoritos = await prisma.favoriteStore.findMany({
    where: { userId, store: { status: 'ACTIVE', deletedAt: null } },
    orderBy: { createdAt: 'desc' },
    select: { store: { select: selectDaLojaNoApp(new Date()) } },
  });

  return favoritos
    .map(({ store }) => ({ ...paraLojaDoApp(store), cidadeSlug: store.city.slug }))
    .sort((a, b) => Number(b.aberta) - Number(a.aberta));
}
