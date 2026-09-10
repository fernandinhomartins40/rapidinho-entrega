import Link from 'next/link';
import { prisma } from '@rapidinho/database';
import { formatCents } from '@rapidinho/shared';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@rapidinho/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Financeiro' };

/**
 * Financeiro da plataforma.
 *
 * O corte é o mês corrente. "A receber" é a comissão dos pedidos entregues que
 * ainda não viraram fatura; inadimplência é fatura vencida e não paga.
 */
async function carregar() {
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const agora = new Date();

  const [resumoMes, porLoja, faturasVencidas, repassesPendentes, receitaBoost] = await Promise.all([
    prisma.order.aggregate({
      where: { status: 'DELIVERED', deliveredAt: { gte: inicioDoMes } },
      _sum: { totalCents: true, commissionCents: true, deliveryFeeCents: true },
      _count: true,
    }),

    prisma.order.groupBy({
      by: ['storeId'],
      where: { status: 'DELIVERED', deliveredAt: { gte: inicioDoMes } },
      _sum: { totalCents: true, commissionCents: true },
      _count: true,
      orderBy: { _sum: { commissionCents: 'desc' } },
      take: 20,
    }),

    prisma.planInvoice.findMany({
      where: { status: { in: ['OPEN', 'OVERDUE'] }, dueDate: { lt: agora } },
      include: { store: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 20,
    }),

    prisma.payout.aggregate({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      _sum: { amountCents: true },
      _count: true,
    }),

    prisma.storeBoost.aggregate({
      where: { createdAt: { gte: inicioDoMes } },
      _sum: { paidCents: true },
    }),
  ]);

  const lojas = await prisma.store.findMany({
    where: { id: { in: porLoja.map((linha) => linha.storeId) } },
    select: { id: true, name: true },
  });

  const nomePorLoja = new Map(lojas.map((loja) => [loja.id, loja.name]));

  return {
    gmvCents: resumoMes._sum.totalCents ?? 0,
    comissaoCents: resumoMes._sum.commissionCents ?? 0,
    entregaCents: resumoMes._sum.deliveryFeeCents ?? 0,
    pedidos: resumoMes._count,
    boostCents: receitaBoost._sum.paidCents ?? 0,
    porLoja: porLoja.map((linha) => ({
      storeId: linha.storeId,
      nome: nomePorLoja.get(linha.storeId) ?? 'Loja removida',
      pedidos: linha._count,
      gmvCents: linha._sum.totalCents ?? 0,
      comissaoCents: linha._sum.commissionCents ?? 0,
    })),
    faturasVencidas,
    repassesPendentes: {
      total: repassesPendentes._sum.amountCents ?? 0,
      quantidade: repassesPendentes._count,
    },
  };
}

export default async function FinanceiroPage() {
  const dados = await carregar();

  const inadimplenciaCents = dados.faturasVencidas.reduce(
    (soma, fatura) => soma + fatura.amountCents + fatura.commissionCents,
    0,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground">Mês corrente, considerando pedidos entregues.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-sm">Faturamento (GMV)</p>
            <p className="mt-1 text-2xl font-bold">{formatCents(dados.gmvCents)}</p>
            <p className="text-muted-foreground text-xs">{dados.pedidos} pedidos entregues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-sm">Comissão a receber</p>
            <p className="text-success mt-1 text-2xl font-bold">
              {formatCents(dados.comissaoCents)}
            </p>
            <p className="text-muted-foreground text-xs">Sobre a mercadoria, não sobre a entrega</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-sm">Repasses a fazer</p>
            <p className="mt-1 text-2xl font-bold">{formatCents(dados.repassesPendentes.total)}</p>
            <p className="text-muted-foreground text-xs">
              {dados.repassesPendentes.quantidade} em aberto
            </p>
          </CardContent>
        </Card>
        <Card className={inadimplenciaCents > 0 ? 'border-destructive/40' : undefined}>
          <CardContent className="pt-5">
            <p className="text-muted-foreground text-sm">Inadimplência</p>
            <p
              className={
                inadimplenciaCents > 0
                  ? 'text-destructive mt-1 text-2xl font-bold'
                  : 'mt-1 text-2xl font-bold'
              }
            >
              {formatCents(inadimplenciaCents)}
            </p>
            <p className="text-muted-foreground text-xs">
              {dados.faturasVencidas.length} faturas vencidas
            </p>
          </CardContent>
        </Card>
      </section>

      <p className="text-muted-foreground text-sm">
        Receita de impulsionamento no mês:{' '}
        <strong className="text-foreground">{formatCents(dados.boostCents)}</strong> · Taxas de
        entrega movimentadas: {formatCents(dados.entregaCents)}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Comissão por loja</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Faturamento</TableHead>
                <TableHead>Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.porLoja.length === 0 ? (
                <TableEmpty colSpan={4}>Nenhum pedido entregue neste mês.</TableEmpty>
              ) : (
                dados.porLoja.map((linha) => (
                  <TableRow key={linha.storeId}>
                    <TableCell>
                      <Link
                        href={`/admin/lojas/${linha.storeId}`}
                        className="font-medium hover:underline"
                      >
                        {linha.nome}
                      </Link>
                    </TableCell>
                    <TableCell>{linha.pedidos}</TableCell>
                    <TableCell>{formatCents(linha.gmvCents)}</TableCell>
                    <TableCell className="font-medium">
                      {formatCents(linha.comissaoCents)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturas vencidas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Mensalidade</TableHead>
                <TableHead>Comissão do período</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.faturasVencidas.length === 0 ? (
                <TableEmpty colSpan={5}>Nenhuma fatura vencida. Tudo em dia.</TableEmpty>
              ) : (
                dados.faturasVencidas.map((fatura) => (
                  <TableRow key={fatura.id}>
                    <TableCell>
                      <Link
                        href={`/admin/lojas/${fatura.store.id}`}
                        className="font-medium hover:underline"
                      >
                        {fatura.store.name}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {fatura.dueDate.toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>{formatCents(fatura.amountCents)}</TableCell>
                    <TableCell>{formatCents(fatura.commissionCents)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">Vencida</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
