import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MessageCircle, Star } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import {
  formatCents,
  formatPhoneBR,
  isFinalStatus,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  whatsappLink,
  type OrderStatus,
} from '@rapidinho/shared';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { formatarEndereco, lerEndereco } from '@/app/loja/pedidos/tipos';
import { CancelarPedido } from '../cancelar-pedido';
import { dataHora, estaAtrasado, hora, tempoDecorrido, VARIANTE_DO_STATUS } from '../formatos';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = await prisma.order.findUnique({ where: { id }, select: { number: true } });
  return { title: pedido ? `Pedido #${pedido.number}` : 'Pedido não encontrado' };
}

const PAGAMENTO_STATUS: Record<string, string> = {
  PENDING: 'Aguardando',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pago',
  REFUNDED: 'Estornado',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
  ON_DELIVERY: 'Paga na entrega',
};

const ENTREGA_STATUS: Record<string, string> = {
  PENDING: 'Aguardando entregador',
  ASSIGNED: 'Entregador designado',
  ACCEPTED: 'Aceita pelo entregador',
  PICKED_UP: 'Em rota',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelada',
  REFUSED: 'Recusada',
};

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default async function PedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pedido = await prisma.order.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true, phone: true, whatsapp: true } },
      city: { select: { name: true, state: true } },
      coupon: { select: { code: true } },
      items: {
        orderBy: { id: 'asc' },
        include: { complements: true, flavors: true },
      },
      payment: true,
      delivery: {
        include: { courier: { include: { user: { select: { name: true, phone: true } } } } },
      },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      reviews: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!pedido) notFound();

  const status = pedido.status as OrderStatus;
  const endereco = lerEndereco(pedido.addressSnapshot);
  const atrasado = estaAtrasado(pedido);
  const entregador = pedido.delivery?.courier;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/pedidos"
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Todos os pedidos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">Pedido #{pedido.number}</h1>
            <Badge variant={VARIANTE_DO_STATUS[status]}>{ORDER_STATUS_LABEL[status]}</Badge>
            {atrasado ? <Badge variant="destructive">Atrasado</Badge> : null}
          </div>
          <p className="text-muted-foreground">
            <Link href={`/admin/lojas/${pedido.store.id}`} className="hover:underline">
              {pedido.store.name}
            </Link>{' '}
            · {pedido.city.name}/{pedido.city.state} · feito em {dataHora(pedido.createdAt)} (
            {tempoDecorrido(pedido.createdAt)})
          </p>
        </div>

        {isFinalStatus(status) ? null : (
          <CancelarPedido pedido={{ id: pedido.id, numero: pedido.number }} />
        )}
      </header>

      {pedido.cancelReason ? (
        <p className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
          <strong>Motivo do cancelamento:</strong> {pedido.cancelReason}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Itens</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pedido.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.weightGrams
                        ? `${(item.weightGrams / 1000).toLocaleString('pt-BR')} kg · `
                        : `${item.quantity}× `}
                      {item.productName}
                      {item.pizzaExtraName ? ` + ${item.pizzaExtraName}` : ''}
                    </p>
                    {item.flavors.length > 0 ? (
                      <p className="text-muted-foreground text-sm">
                        Sabores: {item.flavors.map((sabor) => sabor.flavorName).join(', ')}
                      </p>
                    ) : null}
                    {item.complements.length > 0 ? (
                      <p className="text-muted-foreground text-sm">
                        {item.complements
                          .map(
                            (complemento) =>
                              `${complemento.optionName}${complemento.priceCents > 0 ? ` (+${formatCents(complemento.priceCents)})` : ''}`,
                          )
                          .join(' · ')}
                      </p>
                    ) : null}
                    {item.notes ? (
                      <p className="text-sm italic">&ldquo;{item.notes}&rdquo;</p>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap font-medium">
                    {formatCents(item.totalCents)}
                  </span>
                </li>
              ))}
            </ul>

            {pedido.notes ? (
              <p className="bg-muted mt-3 rounded-lg px-3 py-2 text-sm">
                <strong>Observação do cliente:</strong> {pedido.notes}
              </p>
            ) : null}

            <dl className="mt-4 border-t pt-3 text-sm">
              <Linha rotulo="Subtotal">{formatCents(pedido.subtotalCents)}</Linha>
              <Linha rotulo="Entrega">
                {pedido.type === 'PICKUP'
                  ? 'Retirada no balcão'
                  : formatCents(pedido.deliveryFeeCents)}
              </Linha>
              {pedido.discountCents > 0 ? (
                <Linha rotulo={`Desconto${pedido.coupon ? ` (${pedido.coupon.code})` : ''}`}>
                  − {formatCents(pedido.discountCents)}
                </Linha>
              ) : null}
              <div className="flex justify-between gap-4 border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span>{formatCents(pedido.totalCents)}</span>
              </div>
              <Linha rotulo={`Comissão da plataforma (${Number(pedido.commissionRate)}%)`}>
                {formatCents(pedido.commissionCents)}
              </Linha>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{pedido.customerName}</p>
              <a
                href={whatsappLink(
                  pedido.customerPhone,
                  `Olá! Sobre o pedido #${pedido.number} no Rapidinho…`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-text inline-flex items-center gap-1.5 font-medium hover:underline"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {formatPhoneBR(pedido.customerPhone)}
              </a>
              {endereco ? (
                <p className="text-muted-foreground">{formatarEndereco(endereco)}</p>
              ) : pedido.type === 'PICKUP' ? (
                <p className="text-muted-foreground">Retira na loja.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagamento e entrega</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="text-sm">
                {pedido.payment ? (
                  <>
                    <Linha rotulo="Forma">{PAYMENT_METHOD_LABEL[pedido.payment.method]}</Linha>
                    <Linha rotulo="Situação">
                      {PAGAMENTO_STATUS[pedido.payment.status] ?? pedido.payment.status}
                    </Linha>
                    {pedido.payment.changeForCents ? (
                      <Linha rotulo="Troco para">
                        {formatCents(pedido.payment.changeForCents)}
                      </Linha>
                    ) : null}
                  </>
                ) : (
                  <Linha rotulo="Pagamento">—</Linha>
                )}
                {pedido.delivery ? (
                  <>
                    <Linha rotulo="Entrega">
                      {ENTREGA_STATUS[pedido.delivery.status] ?? pedido.delivery.status}
                    </Linha>
                    <Linha rotulo="Entregador">
                      {entregador ? (
                        <>
                          {entregador.user.name ?? 'Sem nome'}
                          {entregador.user.phone ? (
                            <span className="text-muted-foreground block text-xs">
                              {formatPhoneBR(entregador.user.phone)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        'Ainda não designado'
                      )}
                    </Linha>
                  </>
                ) : null}
                <Linha rotulo="Loja">
                  {pedido.store.name}
                  <span className="text-muted-foreground block text-xs">
                    {formatPhoneBR(pedido.store.whatsapp ?? pedido.store.phone)}
                  </span>
                </Linha>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Linha do tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {pedido.statusHistory.map((passo) => (
                <li key={passo.id} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground w-12 shrink-0 tabular-nums">
                    {hora(passo.createdAt)}
                  </span>
                  <span>
                    <span className="font-medium">
                      {ORDER_STATUS_LABEL[passo.status as OrderStatus]}
                    </span>
                    {passo.note ? (
                      <span className="text-muted-foreground block">{passo.note}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avaliações</CardTitle>
          </CardHeader>
          <CardContent>
            {pedido.reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                O cliente ainda não avaliou este pedido.
              </p>
            ) : (
              <ul className="space-y-4">
                {pedido.reviews.map((avaliacao) => (
                  <li key={avaliacao.id} className="text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      {avaliacao.courierId ? 'Entregador' : 'Loja'}
                      <span className="inline-flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: avaliacao.rating }, (_, indice) => (
                          <Star key={indice} className="h-4 w-4 fill-current" aria-hidden />
                        ))}
                        <span className="sr-only">{avaliacao.rating} de 5</span>
                      </span>
                    </p>
                    {avaliacao.comment ? <p className="mt-1">{avaliacao.comment}</p> : null}
                    {avaliacao.replyText ? (
                      <p className="bg-muted mt-2 rounded-lg px-3 py-2">
                        <strong>Resposta da loja:</strong> {avaliacao.replyText}
                      </p>
                    ) : null}
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
