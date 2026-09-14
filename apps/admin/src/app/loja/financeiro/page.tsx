import { prisma } from '@rapidinho/database';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rapidinho/ui';
import {
  formatCents,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  type OrderStatus,
} from '@rapidinho/shared';
import { TrendingUp, Wallet } from 'lucide-react';
import { Indicador } from '@/components/indicador';
import { getStoreContext } from '@/lib/store-context';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Financeiro' };

/**
 * O que a loja vendeu, o que a plataforma reteve e o que sobra.
 *
 * A conta é mostrada inteira de propósito: comissão que aparece só no extrato
 * final, sem o cliente ver de onde veio, é a origem de metade das brigas entre
 * marketplace e lojista.
 */
async function carregar(storeId: string, mesesAtras: number) {
  const inicio = new Date();
  inicio.setMonth(inicio.getMonth() - mesesAtras, 1);
  inicio.setHours(0, 0, 0, 0);

  const [resumo, pedidos, repasses] = await Promise.all([
    prisma.order.aggregate({
      where: { storeId, status: 'DELIVERED', createdAt: { gte: inicio } },
      _sum: {
        totalCents: true,
        commissionCents: true,
        deliveryFeeCents: true,
        discountCents: true,
      },
      _count: true,
    }),
    prisma.order.findMany({
      where: { storeId, createdAt: { gte: inicio } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        totalCents: true,
        commissionCents: true,
        deliveryFeeCents: true,
        payment: { select: { method: true } },
      },
    }),
    prisma.payout.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, amountCents: true, status: true, createdAt: true, paidAt: true },
    }),
  ]);

  const bruto = resumo._sum.totalCents ?? 0;
  const comissao = resumo._sum.commissionCents ?? 0;
  const entregas = resumo._sum.deliveryFeeCents ?? 0;

  return {
    inicio,
    entregues: resumo._count,
    bruto,
    comissao,
    entregas,
    // O que a loja realmente recebe: o total menos a comissão da plataforma.
    liquido: bruto - comissao,
    ticketMedio: resumo._count > 0 ? Math.round(bruto / resumo._count) : 0,
    pedidos,
    repasses,
  };
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ meses?: string }>;
}) {
  const { store } = await getStoreContext();
  const { meses } = await searchParams;
  const janela = Math.min(12, Math.max(0, Number(meses ?? 0)));
  const dados = await carregar(store.id, janela);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground mt-1">
          Desde {dados.inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          titulo="Vendas (bruto)"
          valor={formatCents(dados.bruto)}
          detalhe={`${dados.entregues} pedidos entregues`}
          icone={TrendingUp}
        />
        <Indicador
          titulo="Comissão da plataforma"
          valor={formatCents(dados.comissao)}
          detalhe="Já descontada do líquido"
          icone={Wallet}
        />
        <Indicador
          titulo="Seu líquido"
          valor={formatCents(dados.liquido)}
          detalhe="Bruto menos comissão"
          icone={Wallet}
        />
        <Indicador
          titulo="Ticket médio"
          valor={formatCents(dados.ticketMedio)}
          detalhe={`Taxas de entrega: ${formatCents(dados.entregas)}`}
          icone={TrendingUp}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Repasses</CardTitle>
        </CardHeader>
        <CardContent>
          {dados.repasses.length === 0 ? (
            <p className="text-muted-foreground">
              Nenhum repasse registrado ainda. Se sua loja recebe direto do cliente (Pix na entrega,
              dinheiro), não há repasse a fazer — a comissão é cobrada à parte.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.repasses.map((repasse) => (
                  <TableRow key={repasse.id}>
                    <TableCell>{repasse.createdAt.toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{formatCents(repasse.amountCents)}</TableCell>
                    <TableCell>
                      <Badge variant={repasse.paidAt ? 'success' : 'secondary'}>
                        {repasse.paidAt ? 'Pago' : repasse.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos pedidos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {dados.pedidos.length === 0 ? (
            <p className="text-muted-foreground">Nenhum pedido neste período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.pedidos.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell className="font-medium">#{pedido.number}</TableCell>
                    <TableCell>{pedido.createdAt.toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      {pedido.payment
                        ? (PAYMENT_METHOD_LABEL[
                            pedido.payment.method as keyof typeof PAYMENT_METHOD_LABEL
                          ] ?? pedido.payment.method)
                        : '—'}
                    </TableCell>
                    <TableCell>{ORDER_STATUS_LABEL[pedido.status as OrderStatus]}</TableCell>
                    <TableCell className="text-right">{formatCents(pedido.totalCents)}</TableCell>
                    <TableCell className="text-right">
                      {formatCents(pedido.commissionCents)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCents(pedido.totalCents - pedido.commissionCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
