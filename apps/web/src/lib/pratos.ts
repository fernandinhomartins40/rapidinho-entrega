import { prisma } from '@rapidinho/database';
import {
  classificarPrato,
  isStoreOpen,
  type ArteDoPrato,
  type PratoDoBaralho,
} from '@rapidinho/shared';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { saborDisponivelAgora } from '@/lib/sabores';

/**
 * Pratos, e não lojas.
 *
 * Quem abre o app sem saber o que quer não pensa em "qual restaurante": pensa
 * em "uma coisa gostosa". Aqui saem os pratos das lojas de comida abertas
 * agora, com o que torna a escolha fácil: quanto custa, quanto demora e se é
 * o que a cidade está pedindo neste horário — medido nos pedidos entregues,
 * não inventado.
 */

export interface PratoNaVitrine extends PratoDoBaralho {
  nome: string;
  descricao: string | null;
  loja: { id: string; nome: string; slug: string };
  /** Sabor de pizza: o preço é "a partir de" (menor tamanho). */
  aPartirDe: boolean;
  href: string;
  imagem: string | null;
  arte: ArteDoPrato;
  /** Entre os mais pedidos da cidade nesta hora do dia. */
  emAlta: boolean;
  /** O cliente já pediu este prato antes. */
  jaPediu: boolean;
}

/** Janela de horário, em horas para cada lado, para medir "o que sai agora". */
const JANELA_DE_HORAS = 1;
/** Quantos dias de pedidos entram na medida. */
const DIAS_DE_HISTORICO = 60;
/** No máximo tantos pratos por loja, para uma loja grande não tomar o baralho. */
const MAXIMO_POR_LOJA = 5;

function horaEmBrasilia(agora: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(agora),
  );
}

/** Pedidos por prato (produto e sabor de pizza) nesta hora do dia. */
async function pedidosNoHorario(cityId: string, hora: number) {
  const [produtos, sabores] = await Promise.all([
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT oi."productId" AS id, count(*)::int AS n
      FROM "order_items" oi
      JOIN "orders" o ON o."id" = oi."orderId"
      WHERE o."cityId" = ${cityId}
        AND o."status" = 'DELIVERED'
        AND o."createdAt" > now() - make_interval(days => ${DIAS_DE_HISTORICO}::int)
        AND oi."productId" IS NOT NULL
        AND least(
          abs(extract(hour from (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int - ${hora}),
          24 - abs(extract(hour from (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int - ${hora})
        ) <= ${JANELA_DE_HORAS}
      GROUP BY 1
    `,
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT f."flavorId" AS id, count(*)::int AS n
      FROM "order_item_pizza_flavors" f
      JOIN "order_items" oi ON oi."id" = f."orderItemId"
      JOIN "orders" o ON o."id" = oi."orderId"
      WHERE o."cityId" = ${cityId}
        AND o."status" = 'DELIVERED'
        AND o."createdAt" > now() - make_interval(days => ${DIAS_DE_HISTORICO}::int)
        AND f."flavorId" IS NOT NULL
        AND least(
          abs(extract(hour from (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int - ${hora}),
          24 - abs(extract(hour from (o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int - ${hora})
        ) <= ${JANELA_DE_HORAS}
      GROUP BY 1
    `,
  ]);

  return new Map<string, number>([
    ...produtos.map((linha) => [`p:${linha.id}`, linha.n] as const),
    ...sabores.map((linha) => [`s:${linha.id}`, linha.n] as const),
  ]);
}

/** O que o cliente já pediu, para marcar "você já pediu". */
async function jaPedidos(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set();
  const itens = await prisma.orderItem.findMany({
    where: { order: { userId, status: 'DELIVERED' } },
    select: { productId: true, flavors: { select: { flavorId: true } } },
    take: 400,
    orderBy: { order: { createdAt: 'desc' } },
  });
  const chaves = new Set<string>();
  for (const item of itens) {
    if (item.productId) chaves.add(`p:${item.productId}`);
    for (const sabor of item.flavors) if (sabor.flavorId) chaves.add(`s:${sabor.flavorId}`);
  }
  return chaves;
}

/**
 * Pratos das lojas de comida abertas agora na cidade, do mais pedido neste
 * horário ao menos. Bebida fica de fora: ninguém resolve a fome com um
 * refrigerante.
 */
export async function pratosDaCidade(
  cityId: string,
  opcoes: { userId?: string | null; agora?: Date; limite?: number } = {},
): Promise<PratoNaVitrine[]> {
  const agora = opcoes.agora ?? new Date();

  const lojas = await prisma.store.findMany({
    where: { cityId, status: 'ACTIVE', deletedAt: null, segment: 'RESTAURANT' },
    select: {
      id: true,
      name: true,
      slug: true,
      avgPrepTimeMinutes: true,
      avgDeliveryTimeMinutes: true,
      isPausedUntil: true,
      pauseReason: true,
      city: { select: { slug: true } },
      hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
      closures: {
        where: { endsAt: { gte: agora } },
        select: { startsAt: true, endsAt: true, reason: true },
      },
      products: {
        where: {
          deletedAt: null,
          isAvailable: true,
          OR: [{ pausedUntil: null }, { pausedUntil: { lte: agora } }],
        },
        select: {
          id: true,
          name: true,
          description: true,
          priceCents: true,
          category: { select: { name: true } },
          image: { select: SELECT_IMAGEM },
        },
      },
      pizzaFlavors: {
        where: saborDisponivelAgora(),
        select: {
          id: true,
          name: true,
          description: true,
          groupName: true,
          image: { select: SELECT_IMAGEM },
          prices: {
            where: { size: { isActive: true } },
            select: { priceCents: true },
            orderBy: { priceCents: 'asc' },
            take: 1,
          },
        },
      },
    },
  });

  const abertas = lojas.filter(
    (loja) =>
      isStoreOpen({
        hours: loja.hours,
        closures: loja.closures,
        pausedUntil: loja.isPausedUntil,
        pauseReason: loja.pauseReason,
      }).isOpen,
  );

  const [contagem, pedidosDoCliente] = await Promise.all([
    pedidosNoHorario(cityId, horaEmBrasilia(agora)),
    jaPedidos(opcoes.userId ?? null),
  ]);
  const maximo = Math.max(1, ...contagem.values());

  const pratos: PratoNaVitrine[] = [];

  for (const loja of abertas) {
    const tempoMin = loja.avgPrepTimeMinutes + loja.avgDeliveryTimeMinutes;
    const daLoja: PratoNaVitrine[] = [];

    for (const produto of loja.products) {
      const arte = classificarPrato(produto.name, produto.category?.name);
      if (arte.tipo === 'bebida') continue;
      const chave = `p:${produto.id}`;
      daLoja.push({
        chave,
        nome: produto.name,
        descricao: produto.description,
        loja: { id: loja.id, nome: loja.name, slug: loja.slug },
        lojaId: loja.id,
        precoCents: produto.priceCents,
        aPartirDe: false,
        tempoMin,
        tipo: arte.tipo,
        paraDividir: arte.paraDividir,
        popularidade: (contagem.get(chave) ?? 0) / maximo,
        href: `/${loja.city.slug}/produto/${produto.id}`,
        imagem: imagemExibivel(produto.image, 'medium').url,
        arte,
        emAlta: false,
        jaPediu: pedidosDoCliente.has(chave),
      });
    }

    for (const sabor of loja.pizzaFlavors) {
      const preco = sabor.prices[0]?.priceCents;
      if (preco == null) continue;
      const arte = classificarPrato(sabor.name, sabor.groupName, true);
      const chave = `s:${sabor.id}`;
      daLoja.push({
        chave,
        nome: `Pizza de ${sabor.name.toLowerCase()}`,
        descricao: sabor.description,
        loja: { id: loja.id, nome: loja.name, slug: loja.slug },
        lojaId: loja.id,
        precoCents: preco,
        aPartirDe: true,
        tempoMin,
        tipo: arte.tipo,
        paraDividir: arte.paraDividir,
        popularidade: (contagem.get(chave) ?? 0) / maximo,
        href: `/${loja.city.slug}/${loja.slug}`,
        imagem: imagemExibivel(sabor.image, 'medium').url,
        arte,
        emAlta: false,
        jaPediu: pedidosDoCliente.has(chave),
      });
    }

    daLoja.sort((a, b) => b.popularidade - a.popularidade);
    pratos.push(...daLoja.slice(0, MAXIMO_POR_LOJA));
  }

  pratos.sort((a, b) => b.popularidade - a.popularidade);

  // "Em alta" só para quem tem pedido de verdade neste horário: o terço de
  // cima entre os que venderam alguma coisa.
  const comPedido = pratos.filter((prato) => prato.popularidade > 0);
  const corte = comPedido[Math.max(0, Math.ceil(comPedido.length / 3) - 1)]?.popularidade ?? 1;
  for (const prato of comPedido) prato.emAlta = prato.popularidade >= corte;

  return opcoes.limite ? pratos.slice(0, opcoes.limite) : pratos;
}
