import Link from 'next/link';
import { Building2, Clock, ShoppingBag, TrendingUp, Users, XCircle } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { formatCents } from '@rapidinho/shared';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Visão geral' };

/**
 * Painel analítico da plataforma.
 *
 * As contas usam o mês corrente: é o horizonte que importa para decidir
 * (quanto entrou, o que precisa de aprovação, onde está vendendo).
 */
async function carregarIndicadores() {
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const [
    cidadesAtivas,
    lojasAtivas,
    lojasPendentes,
    clientes,
    entregadoresPendentes,
    pedidosDoMes,
    faturamento,
    cancelados,
    porCidade,
    topLojas,
  ] = await Promise.all([
    prisma.city.count({ where: { isActive: true } }),
    prisma.store.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    prisma.store.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.user.count({ where: { role: 'CUSTOMER', status: 'ACTIVE' } }),
    prisma.courier.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.order.count({ where: { createdAt: { gte: inicioDoMes } } }),

    // GMV e comissão só contam pedido entregue: pedido cancelado não é receita.
    prisma.order.aggregate({
      where: { createdAt: { gte: inicioDoMes }, status: 'DELIVERED' },
      _sum: { totalCents: true, commissionCents: true },
    }),

    prisma.order.count({
      where: { createdAt: { gte: inicioDoMes }, status: { in: ['CANCELLED', 'REJECTED'] } },
    }),

    prisma.city.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        state: true,
        _count: {
          select: {
            stores: { where: { status: 'ACTIVE', deletedAt: null } },
            orders: { where: { createdAt: { gte: inicioDoMes } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),

    prisma.store.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, orderCount: true, ratingAverage: true },
      orderBy: { orderCount: 'desc' },
      take: 5,
    }),
  ]);

  const gmvCents = faturamento._sum.totalCents ?? 0;
  const comissaoCents = faturamento._sum.commissionCents ?? 0;

  return {
    cidadesAtivas,
    lojasAtivas,
    lojasPendentes,
    clientes,
    entregadoresPendentes,
    pedidosDoMes,
    gmvCents,
    comissaoCents,
    ticketMedioCents: pedidosDoMes > 0 ? Math.round(gmvCents / pedidosDoMes) : 0,
    taxaCancelamento: pedidosDoMes > 0 ? (cancelados / pedidosDoMes) * 100 : 0,
    porCidade,
    topLojas,
  };
}

function Indicador({
  titulo,
  valor,
  detalhe,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{titulo}</p>
          <p className="mt-1 truncate text-2xl font-bold">{valor}</p>
          {detalhe ? <p className="text-muted-foreground mt-0.5 text-xs">{detalhe}</p> : null}
        </div>
        <Icone className="text-primary h-6 w-6 shrink-0" aria-hidden />
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const dados = await carregarIndicadores();

  const pendencias = dados.lojasPendentes + dados.entregadoresPendentes;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <p className="text-muted-foreground">Números do mês corrente.</p>
      </header>

      {pendencias > 0 ? (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div>
              <p className="font-semibold">Você tem cadastros esperando aprovação</p>
              <p className="text-muted-foreground text-sm">
                {dados.lojasPendentes > 0
                  ? `${dados.lojasPendentes} ${dados.lojasPendentes === 1 ? 'loja' : 'lojas'}`
                  : null}
                {dados.lojasPendentes > 0 && dados.entregadoresPendentes > 0 ? ' e ' : null}
                {dados.entregadoresPendentes > 0
                  ? `${dados.entregadoresPendentes} ${
                      dados.entregadoresPendentes === 1 ? 'entregador' : 'entregadores'
                    }`
                  : null}
              </p>
            </div>
            <div className="flex gap-2">
              {dados.lojasPendentes > 0 ? (
                <Link href="/admin/lojas?status=PENDING_APPROVAL" className="underline">
                  Ver lojas
                </Link>
              ) : null}
              {dados.entregadoresPendentes > 0 ? (
                <Link href="/admin/entregadores?status=PENDING_APPROVAL" className="underline">
                  Ver entregadores
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Faturamento (GMV)"
          valor={formatCents(dados.gmvCents)}
          detalhe="Pedidos entregues no mês"
          icone={TrendingUp}
        />
        <Indicador
          titulo="Comissão da plataforma"
          valor={formatCents(dados.comissaoCents)}
          detalhe="A receber dos lojistas"
          icone={TrendingUp}
        />
        <Indicador
          titulo="Pedidos no mês"
          valor={String(dados.pedidosDoMes)}
          detalhe={`Ticket médio ${formatCents(dados.ticketMedioCents)}`}
          icone={ShoppingBag}
        />
        <Indicador
          titulo="Cancelamento"
          valor={`${dados.taxaCancelamento.toFixed(1)}%`}
          detalhe="Cancelados ou recusados"
          icone={XCircle}
        />
        <Indicador
          titulo="Lojas ativas"
          valor={String(dados.lojasAtivas)}
          detalhe={
            dados.lojasPendentes > 0 ? `${dados.lojasPendentes} aguardando` : 'Nenhuma pendente'
          }
          icone={Building2}
        />
        <Indicador
          titulo="Clientes"
          valor={String(dados.clientes)}
          detalhe="Contas ativas"
          icone={Users}
        />
        <Indicador titulo="Cidades ativas" valor={String(dados.cidadesAtivas)} icone={Clock} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pedidos por cidade</CardTitle>
          </CardHeader>
          <CardContent>
            {dados.porCidade.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhuma cidade ativa.{' '}
                <Link href="/admin/cidades" className="underline">
                  Abrir uma cidade
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {dados.porCidade.map((cidade) => (
                  <li key={cidade.id} className="flex items-center justify-between py-3">
                    <span>
                      <span className="font-medium">
                        {cidade.name} — {cidade.state}
                      </span>
                      <span className="text-muted-foreground block text-sm">
                        {cidade._count.stores}{' '}
                        {cidade._count.stores === 1 ? 'loja ativa' : 'lojas ativas'}
                      </span>
                    </span>
                    <Badge variant="secondary">{cidade._count.orders} pedidos</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lojas que mais vendem</CardTitle>
          </CardHeader>
          <CardContent>
            {dados.topLojas.length === 0 ? (
              <p className="text-muted-foreground">Ainda não há vendas registradas.</p>
            ) : (
              <ul className="divide-y">
                {dados.topLojas.map((loja) => (
                  <li key={loja.id} className="flex items-center justify-between gap-3 py-3">
                    <Link
                      href={`/admin/lojas/${loja.id}`}
                      className="min-w-0 truncate font-medium hover:underline"
                    >
                      {loja.name}
                    </Link>
                    <span className="text-muted-foreground shrink-0 text-sm">
                      {loja.orderCount} {loja.orderCount === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
