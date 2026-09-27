import { notFound } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { isStoreOpen } from '@rapidinho/shared';
import { MontadorDePizza, type DadosDaPizzaria } from './montador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Monte sua pizza' };

/**
 * Montar pizza: tamanho, sabores (inteira, meio a meio, 3 ou 4), borda,
 * massa e adicionais — o pedido mais particular de todos os ramos.
 *
 * O parâmetro é o id da loja (é o link do cardápio, "Monte sua pizza"); o
 * tamanho vem pré-escolhido quando o cliente tocou num tamanho específico.
 */
export default async function PizzaPage({
  params,
  searchParams,
}: {
  params: Promise<{ cidade: string; loja: string }>;
  searchParams: Promise<{ tamanho?: string }>;
}) {
  const { cidade, loja: storeId } = await params;
  const { tamanho } = await searchParams;
  const agora = new Date();

  const loja = await prisma.store.findFirst({
    where: {
      id: storeId,
      status: 'ACTIVE',
      deletedAt: null,
      city: { slug: cidade, isActive: true },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      pizzaPricingRule: true,
      isPausedUntil: true,
      pauseReason: true,
      hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
      closures: {
        where: { endsAt: { gte: agora } },
        select: { startsAt: true, endsAt: true, reason: true },
      },
      pizzaSizes: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, description: true, maxFlavors: true, slices: true },
      },
      pizzaFlavors: {
        where: { isAvailable: true },
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

  if (!loja || loja.pizzaSizes.length === 0) notFound();

  const abertura = isStoreOpen({
    hours: loja.hours,
    closures: loja.closures,
    pausedUntil: loja.isPausedUntil,
    pauseReason: loja.pauseReason,
  });

  const dados: DadosDaPizzaria = {
    loja: { id: loja.id, nome: loja.name, slug: loja.slug },
    regra: loja.pizzaPricingRule === 'AVERAGE_PRICE' ? 'AVERAGE_PRICE' : 'HIGHEST_PRICE',
    aberta: abertura.isOpen,
    motivoFechada: abertura.reason ?? null,
    tamanhos: loja.pizzaSizes.map((tamanhoDaLoja) => ({
      id: tamanhoDaLoja.id,
      nome: tamanhoDaLoja.name,
      descricao: tamanhoDaLoja.description,
      maxSabores: tamanhoDaLoja.maxFlavors,
      fatias: tamanhoDaLoja.slices,
    })),
    sabores: loja.pizzaFlavors.map((sabor) => ({
      id: sabor.id,
      nome: sabor.name,
      descricao: sabor.description,
      grupo: sabor.groupName ?? 'Sabores',
      precos: Object.fromEntries(sabor.prices.map((preco) => [preco.sizeId, preco.priceCents])),
    })),
    extras: loja.pizzaExtras.map((extra) => ({
      id: extra.id,
      nome: extra.name,
      tipo: extra.kind === 'CRUST' ? 'CRUST' : extra.kind === 'TOPPING' ? 'TOPPING' : 'EDGE',
      precoCents: extra.priceCents,
    })),
  };

  const inicial = dados.tamanhos.find((opcao) => opcao.id === tamanho)?.id ?? dados.tamanhos[0]!.id;

  return (
    <main className="mx-auto max-w-lg pb-40">
      <MontadorDePizza cidadeSlug={cidade} dados={dados} tamanhoInicial={inicial} />
    </main>
  );
}
