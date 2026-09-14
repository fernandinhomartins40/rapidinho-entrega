import Link from 'next/link';
import { AlertTriangle, Clock, Package, ShoppingBag, TrendingUp } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { formatCents } from '@rapidinho/shared';
import { Indicador } from '@/components/indicador';
import { getStoreContext, STATUS_EM_ABERTO } from '@/lib/store-context';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visão geral' };

/**
 * Início do dia do lojista.
 *
 * Mostra o que ele olharia primeiro: o que precisa de ação agora, quanto
 * vendeu hoje e o que está saindo. Nada de gráfico que ninguém lê.
 */
async function carregarResumo(storeId: string) {
  // "Hoje" é do ponto de vista de quem opera a loja, não UTC.
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const [emAberto, doDia, faturado, maisVendidos, produtosPausados, semEstoque] = await Promise.all(
    [
      prisma.order.count({ where: { storeId, status: { in: [...STATUS_EM_ABERTO] } } }),
      prisma.order.count({ where: { storeId, createdAt: { gte: inicioDoDia } } }),
      prisma.order.aggregate({
        where: { storeId, status: 'DELIVERED', createdAt: { gte: inicioDoDia } },
        _sum: { totalCents: true, commissionCents: true },
        _count: true,
      }),
      prisma.orderItem.groupBy({
        by: ['productName'],
        where: {
          order: { storeId, status: 'DELIVERED', createdAt: { gte: inicioDoDia } },
        },
        _sum: { quantity: true, totalCents: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      prisma.product.count({
        where: {
          storeId,
          deletedAt: null,
          OR: [{ isAvailable: false }, { pausedUntil: { gt: new Date() } }],
        },
      }),
      prisma.product.count({ where: { storeId, deletedAt: null, stockQuantity: 0 } }),
    ],
  );

  const entregues = faturado._count;
  const totalCents = faturado._sum.totalCents ?? 0;

  return {
    emAberto,
    doDia,
    entregues,
    totalCents,
    comissaoCents: faturado._sum.commissionCents ?? 0,
    // Ticket médio sobre entregues: incluir cancelado distorce para baixo.
    ticketMedioCents: entregues > 0 ? Math.round(totalCents / entregues) : 0,
    maisVendidos,
    produtosPausados,
    semEstoque,
  };
}

export default async function LojaDashboardPage() {
  const { store, abertura } = await getStoreContext();
  const dados = await carregarResumo(store.id);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
        <p className="text-muted-foreground mt-1">Como está a {store.name} hoje.</p>
      </header>

      {!abertura.isOpen ? (
        <Card className="border-warning bg-warning/10">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="text-warning mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Sua loja está fechada e não recebe pedidos.</p>
              <p className="text-muted-foreground mt-0.5">
                {abertura.reason ?? 'Fora do horário de funcionamento.'}{' '}
                <Link href="/loja/horarios" className="underline">
                  Conferir horários
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {dados.emAberto > 0 ? (
        <Card className="border-primary bg-primary/10">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="font-semibold">
              {dados.emAberto} {dados.emAberto === 1 ? 'pedido aguardando' : 'pedidos aguardando'}{' '}
              você.
            </p>
            <Link href="/loja/pedidos" className="font-semibold underline">
              Abrir pedidos
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Vendas de hoje"
          valor={formatCents(dados.totalCents)}
          detalhe={`${dados.entregues} ${dados.entregues === 1 ? 'pedido entregue' : 'pedidos entregues'}`}
          icone={TrendingUp}
        />
        <Indicador
          titulo="Ticket médio"
          valor={formatCents(dados.ticketMedioCents)}
          detalhe="Por pedido entregue hoje"
          icone={ShoppingBag}
        />
        <Indicador
          titulo="Pedidos hoje"
          valor={String(dados.doDia)}
          detalhe={`${dados.emAberto} em aberto`}
          icone={Clock}
        />
        <Indicador
          titulo="Comissão da plataforma"
          valor={formatCents(dados.comissaoCents)}
          detalhe="Sobre as vendas de hoje"
          icone={TrendingUp}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mais vendidos hoje</CardTitle>
          </CardHeader>
          <CardContent>
            {dados.maisVendidos.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhuma venda concluída hoje ainda. Assim que sair o primeiro pedido, ele aparece
                aqui.
              </p>
            ) : (
              <ul className="space-y-3">
                {dados.maisVendidos.map((item) => (
                  <li key={item.productName} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{item.productName}</span>
                    <span className="text-muted-foreground shrink-0 text-sm">
                      {item._sum.quantity ?? 0}× · {formatCents(item._sum.totalCents ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atenção no cardápio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Package className="text-muted-foreground h-4 w-4" aria-hidden />
                Produtos pausados ou indisponíveis
              </span>
              <Badge variant={dados.produtosPausados > 0 ? 'warning' : 'secondary'}>
                {dados.produtosPausados}
              </Badge>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Package className="text-muted-foreground h-4 w-4" aria-hidden />
                Produtos sem estoque
              </span>
              <Badge variant={dados.semEstoque > 0 ? 'warning' : 'secondary'}>
                {dados.semEstoque}
              </Badge>
            </p>
            <Link href="/loja/produtos" className="inline-block text-sm font-semibold underline">
              Gerenciar produtos
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
