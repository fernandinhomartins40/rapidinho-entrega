import Link from 'next/link';
import { MessageSquare, Star } from 'lucide-react';
import { prisma, type Prisma } from '@rapidinho/database';
import { cn } from '@rapidinho/ui';
import { Indicador } from '@/components/indicador';
import { ondeParaResponder } from '@/lib/avaliacoes';
import { getStoreContext } from '@/lib/store-context';
import { ListaDeAvaliacoes, type AvaliacaoNaTela } from './lista';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Avaliações' };

const POR_PAGINA = 30;

const FILTROS = {
  responder: 'Para responder',
  baixas: 'Notas baixas',
  todas: 'Todas',
} as const;

type Filtro = keyof typeof FILTROS;

/**
 * O que os clientes acharam, com a resposta da loja no mesmo lugar.
 *
 * Abre em "Para responder" quando há o que responder: é a lista de trabalho.
 * Sem pendências, abre em "Todas" — a tela não deve parecer vazia para quem
 * está em dia.
 */
export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; ver?: string }>;
}) {
  const { store } = await getStoreContext();
  const params = await searchParams;

  const [paraResponder, resumo] = await Promise.all([
    prisma.review.count({ where: ondeParaResponder(store.id) }),
    prisma.review.aggregate({
      where: { storeId: store.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  const filtro: Filtro =
    params.filtro && params.filtro in FILTROS
      ? (params.filtro as Filtro)
      : paraResponder > 0
        ? 'responder'
        : 'todas';
  const limite = Math.min(Math.max(Number(params.ver) || POR_PAGINA, POR_PAGINA), 300);

  const where: Prisma.ReviewWhereInput =
    filtro === 'responder'
      ? ondeParaResponder(store.id)
      : filtro === 'baixas'
        ? { storeId: store.id, rating: { lte: 2 } }
        : { storeId: store.id };

  const avaliacoes = await prisma.review.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limite + 1,
    select: {
      id: true,
      rating: true,
      comment: true,
      replyText: true,
      repliedAt: true,
      hiddenAt: true,
      createdAt: true,
      order: {
        select: {
          number: true,
          customerName: true,
          items: { select: { productName: true }, take: 4, orderBy: { id: 'asc' } },
        },
      },
    },
  });

  const temMais = avaliacoes.length > limite;

  const naTela: AvaliacaoNaTela[] = avaliacoes.slice(0, limite).map((avaliacao) => ({
    id: avaliacao.id,
    nota: avaliacao.rating,
    comentario: avaliacao.comment,
    resposta: avaliacao.replyText,
    respondidaEm: avaliacao.repliedAt?.toISOString() ?? null,
    oculta: avaliacao.hiddenAt != null,
    criadaEm: avaliacao.createdAt.toISOString(),
    pedido: avaliacao.order.number,
    // Primeiro nome basta para a loja reconhecer o cliente na resposta.
    cliente: avaliacao.order.customerName.split(' ')[0] ?? 'Cliente',
    itens: avaliacao.order.items.map((item) => item.productName),
  }));

  const media = resumo._avg.rating ?? 0;
  const total = resumo._count._all;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Avaliações</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          O que os clientes acharam de cada pedido. Responder uma nota baixa costuma trazer o
          cliente de volta — e ele recebe a sua resposta no celular.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Indicador
          titulo="Nota média"
          valor={total > 0 ? media.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}
          detalhe={`${total} ${total === 1 ? 'avaliação' : 'avaliações'}`}
          icone={Star}
        />
        <Indicador
          titulo="Para responder"
          valor={String(paraResponder)}
          detalhe="Com comentário ou nota até 3"
          icone={MessageSquare}
        />
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar avaliações">
        {(Object.keys(FILTROS) as Filtro[]).map((chave) => (
          <Link
            key={chave}
            href={`/loja/avaliacoes?filtro=${chave}`}
            aria-current={filtro === chave ? 'page' : undefined}
            className={cn(
              'min-h-touch inline-flex items-center rounded-full border px-4 text-sm font-medium',
              filtro === chave
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input',
            )}
          >
            {FILTROS[chave]}
            {chave === 'responder' && paraResponder > 0 ? ` (${paraResponder})` : ''}
          </Link>
        ))}
      </nav>

      <ListaDeAvaliacoes
        avaliacoes={naTela}
        vazio={
          filtro === 'responder'
            ? 'Tudo respondido. Quando chegar uma avaliação com comentário ou nota baixa, ela aparece aqui.'
            : filtro === 'baixas'
              ? 'Nenhuma nota 1 ou 2. Continue assim.'
              : 'Ainda não há avaliações. Elas chegam depois que os pedidos são entregues.'
        }
      />

      {temMais ? (
        <Link
          href={`/loja/avaliacoes?filtro=${filtro}&ver=${limite + POR_PAGINA}`}
          className="inline-block text-sm font-semibold underline"
          scroll={false}
        >
          Ver mais avaliações
        </Link>
      ) : null}
    </div>
  );
}
