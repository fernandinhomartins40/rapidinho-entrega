import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import {
  DELIVERY_FEE_MODE_LABEL,
  formatCents,
  formatDocument,
  formatPhoneBR,
  minuteToTime,
  STORE_SEGMENT_LABEL,
  weekdayLabel,
} from '@rapidinho/shared';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { AcoesDaLoja } from './acoes-da-loja';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loja = await prisma.store.findUnique({ where: { id }, select: { name: true } });
  return { title: loja?.name ?? 'Loja' };
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{rotulo}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default async function LojaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const loja = await prisma.store.findUnique({
    where: { id },
    include: {
      city: { select: { name: true, state: true } },
      category: { select: { name: true } },
      subscription: { include: { plan: { select: { name: true, commissionRate: true } } } },
      hours: { orderBy: [{ weekday: 'asc' }, { opensAt: 'asc' }] },
      staff: {
        include: { user: { select: { id: true, name: true, phone: true, role: true } } },
        orderBy: { role: 'asc' },
      },
      documents: { include: { file: { select: { mediumKey: true } } } },
      _count: { select: { products: true, orders: true, couriers: true } },
    },
  });

  if (!loja) notFound();

  const dono = loja.staff.find((membro) => membro.role === 'OWNER');

  const [faturamento, ultimosPedidos] = await Promise.all([
    prisma.order.aggregate({
      where: { storeId: loja.id, status: 'DELIVERED' },
      _sum: { totalCents: true, commissionCents: true },
    }),
    prisma.order.findMany({
      where: { storeId: loja.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, number: true, status: true, totalCents: true, createdAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/lojas"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Todas as lojas
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{loja.name}</h1>
          <p className="text-muted-foreground">
            {loja.category?.name ?? STORE_SEGMENT_LABEL[loja.segment]} · {loja.city.name} —{' '}
            {loja.city.state}
          </p>
        </div>

        <AcoesDaLoja
          loja={{
            id: loja.id,
            nome: loja.name,
            status: loja.status,
            donoId: dono?.user.id ?? null,
            donoNome: dono?.user.name ?? null,
          }}
        />
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cadastro</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Documento">
                {formatDocument(loja.document)}
                <span className="text-muted-foreground ml-1 text-xs">({loja.documentType})</span>
              </Campo>
              <Campo rotulo="Razão social">{loja.legalName ?? '—'}</Campo>
              <Campo rotulo="Telefone">{formatPhoneBR(loja.phone)}</Campo>
              <Campo rotulo="WhatsApp">{loja.whatsapp ? formatPhoneBR(loja.whatsapp) : '—'}</Campo>
              <Campo rotulo="E-mail">{loja.email ?? '—'}</Campo>
              <Campo rotulo="Cadastrada em">{loja.createdAt.toLocaleDateString('pt-BR')}</Campo>
              <div className="sm:col-span-2">
                <Campo rotulo="Endereço">
                  {loja.street}
                  {loja.number ? `, ${loja.number}` : ' (sem número)'} — {loja.neighborhood}
                  {loja.referencePoint ? (
                    <span className="text-muted-foreground block text-sm font-normal">
                      Referência: {loja.referencePoint}
                    </span>
                  ) : null}
                </Campo>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operação</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Plano">
                {loja.subscription?.plan.name ?? 'Sem plano'}
                {loja.subscription ? (
                  <span className="text-muted-foreground block text-sm font-normal">
                    Comissão {Number(loja.subscription.plan.commissionRate).toFixed(1)}%
                  </span>
                ) : null}
              </Campo>
              <Campo rotulo="Cobrança de entrega">
                {DELIVERY_FEE_MODE_LABEL[loja.deliveryFeeMode]}
                <span className="text-muted-foreground block text-sm font-normal">
                  {formatCents(loja.deliveryFeeCents)}
                  {loja.deliveryFeeMode === 'BY_DISTANCE'
                    ? ` + ${formatCents(loja.pricePerKmCents)}/km`
                    : null}
                </span>
              </Campo>
              <Campo rotulo="Pedido mínimo">{formatCents(loja.minOrderCents)}</Campo>
              <Campo rotulo="Tempo de preparo">{loja.avgPrepTimeMinutes} min</Campo>
              <Campo rotulo="Produtos">{loja._count.products}</Campo>
              <Campo rotulo="Pedidos">{loja._count.orders}</Campo>
              <Campo rotulo="Faturamento entregue">
                {formatCents(faturamento._sum.totalCents ?? 0)}
              </Campo>
              <Campo rotulo="Comissão gerada">
                {formatCents(faturamento._sum.commissionCents ?? 0)}
              </Campo>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horário de funcionamento</CardTitle>
          </CardHeader>
          <CardContent>
            {loja.hours.length === 0 ? (
              <p className="text-muted-foreground">
                Nenhum horário cadastrado — a loja aparece sempre fechada.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {loja.hours.map((faixa) => (
                  <li key={faixa.id} className="flex justify-between py-2">
                    <span className="capitalize">{weekdayLabel(faixa.weekday)}</span>
                    <span className="text-muted-foreground">
                      {minuteToTime(faixa.opensAt)} às {minuteToTime(faixa.closesAt)}
                      {faixa.closesAt > 1440 ? ' (do dia seguinte)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {loja.staff.map((membro) => (
                <li key={membro.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-medium">{membro.user.name ?? 'Sem nome'}</span>
                    <span className="text-muted-foreground block text-xs">
                      {membro.user.phone ? formatPhoneBR(membro.user.phone) : '—'}
                    </span>
                  </span>
                  <Badge variant={membro.role === 'OWNER' ? 'default' : 'secondary'}>
                    {membro.role === 'OWNER'
                      ? 'Dono'
                      : membro.role === 'MANAGER'
                        ? 'Gerente'
                        : 'Operador'}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Últimos pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {ultimosPedidos.length === 0 ? (
              <p className="text-muted-foreground">Esta loja ainda não recebeu pedidos.</p>
            ) : (
              <ul className="divide-y text-sm">
                {ultimosPedidos.map((pedido) => (
                  <li key={pedido.id} className="flex items-center justify-between py-2">
                    <span className="font-medium">#{pedido.number}</span>
                    <span className="text-muted-foreground">
                      {pedido.createdAt.toLocaleString('pt-BR')}
                    </span>
                    <span className="font-medium">{formatCents(pedido.totalCents)}</span>
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
