'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bike, Check, Copy, MessageCircle, Wifi, WifiOff } from 'lucide-react';
import { Badge, Button, Card, CardContent, cn } from '@rapidinho/ui';
import { useRealtime } from '@rapidinho/ui/hooks/use-realtime';
import {
  formatCents,
  formatGrams,
  isFinalStatus,
  ORDER_STATUS_CUSTOMER_MESSAGE,
  ORDER_STATUS_LABEL,
  ORDER_TIMELINE,
  PAYMENT_METHOD_LABEL,
  REALTIME_EVENTS,
  timelineIndex,
  whatsappLink,
  type OrderStatus,
} from '@rapidinho/shared';

interface Props {
  pedido: {
    id: string;
    number: string;
    status: string;
    type: string;
    createdAt: string;
    estimatedPrepMinutes: number | null;
    estimatedReadyAt: string | null;
    subtotalCents: number;
    deliveryFeeCents: number;
    discountCents: number;
    totalCents: number;
    notes: string | null;
    cancelReason: string | null;
    addressSnapshot: unknown;
    jaAvaliado: boolean;
    store: {
      name: string;
      slug: string;
      phone: string;
      whatsapp: string | null;
      city: { slug: string };
    };
    payment: {
      method: string;
      status: string;
      changeForCents: number | null;
      pixQrCode: string | null;
      pixQrCodeImage: string | null;
      pixExpiresAt: string | null;
    } | null;
    items: {
      id: string;
      productName: string;
      quantity: number;
      weightGrams: number | null;
      totalCents: number;
      notes: string | null;
      pizzaSizeName: string | null;
      pizzaExtraName: string | null;
      complements: { id: string; optionName: string; quantity: number }[];
      flavors: { id: string; flavorName: string }[];
    }[];
    statusHistory: { id: string; status: string; note: string | null; createdAt: string }[];
    delivery: {
      status: string;
      courier: { vehicleType: string; user: { name: string | null; phone: string | null } } | null;
    } | null;
  };
  realtime: { channel: string; token: string; url: string };
}

/**
 * Acompanhamento do pedido.
 *
 * O socket avisa a mudança e a página recarrega os dados do servidor, em vez
 * de remontar o pedido pelo payload: continua tempo real — o gatilho é o
 * evento, não um relógio — e o servidor segue sendo a única fonte de verdade.
 */
export function AcompanhamentoDoPedido({ pedido, realtime }: Props) {
  const router = useRouter();
  const status = pedido.status as OrderStatus;

  const aoMudar = useCallback(() => router.refresh(), [router]);

  const { conectado } = useRealtime({
    channel: realtime.channel,
    token: realtime.token,
    url: realtime.url,
    // Pedido encerrado não muda mais: manter o socket aberto seria consumo à
    // toa na bateria do celular.
    enabled: !isFinalStatus(status),
    handlers: {
      [REALTIME_EVENTS.orderStatusChanged]: aoMudar,
      [REALTIME_EVENTS.orderCancelled]: aoMudar,
      [REALTIME_EVENTS.deliveryStatusChanged]: aoMudar,
    },
  });

  const etapaAtual = timelineIndex(status);
  const cancelado = status === 'CANCELLED' || status === 'REJECTED';
  const contato = pedido.store.whatsapp ?? pedido.store.phone;
  const endereco = pedido.addressSnapshot as {
    street?: string;
    number?: string;
    neighborhood?: string;
    referencePoint?: string;
  } | null;

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-6">
      <header>
        <p className="text-muted-foreground text-sm">Pedido #{pedido.number}</p>
        <h1 className="text-2xl font-bold leading-tight">
          {ORDER_STATUS_CUSTOMER_MESSAGE[status]}
        </h1>
        <Link
          href={`/${pedido.store.city.slug}/${pedido.store.slug}`}
          className="mt-1 inline-block underline"
        >
          {pedido.store.name}
        </Link>

        {!isFinalStatus(status) ? (
          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-sm">
            {conectado ? (
              <>
                <Wifi className="text-success h-4 w-4" aria-hidden />
                Atualizando sozinho
              </>
            ) : (
              <>
                <WifiOff className="text-warning h-4 w-4" aria-hidden />
                Reconectando…
              </>
            )}
          </p>
        ) : null}
      </header>

      {cancelado ? (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-5">
            <p className="font-semibold">{ORDER_STATUS_LABEL[status]}</p>
            {pedido.cancelReason ? (
              <p className="text-muted-foreground mt-1">Motivo: {pedido.cancelReason}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <ol className="space-y-4">
              {ORDER_TIMELINE.filter(
                // Pedido para retirada não passa por "saiu para entrega".
                (etapa) => pedido.type !== 'PICKUP' || etapa !== 'OUT_FOR_DELIVERY',
              ).map((etapa) => {
                const indice = timelineIndex(etapa);
                const concluida = indice <= etapaAtual;
                const atual = indice === etapaAtual;

                return (
                  <li key={etapa} className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        concluida
                          ? 'bg-success text-success-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {concluida ? <Check className="h-4 w-4" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('font-medium', atual && 'text-primary')}>
                        {ORDER_STATUS_LABEL[etapa]}
                      </p>
                      {atual && pedido.estimatedReadyAt ? (
                        <p className="text-muted-foreground text-sm">
                          Previsão:{' '}
                          {new Date(pedido.estimatedReadyAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}

      {pedido.status === 'PENDING_PAYMENT' && pedido.payment?.pixQrCode ? (
        <PagamentoPix
          qrCode={pedido.payment.pixQrCode}
          qrCodeImage={pedido.payment.pixQrCodeImage}
          expiraEm={pedido.payment.pixExpiresAt}
        />
      ) : null}

      {pedido.delivery?.courier ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <Bike className="text-primary h-6 w-6 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{pedido.delivery.courier.user.name ?? 'Entregador'}</p>
              <p className="text-muted-foreground text-sm">está levando seu pedido</p>
            </div>
            {pedido.delivery.courier.user.phone ? (
              <Button asChild variant="outline" size="sm">
                <a
                  href={whatsappLink(pedido.delivery.courier.user.phone)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Falar
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3 pt-5">
          <p className="font-semibold">Seu pedido</p>

          <ul className="divide-y text-sm">
            {pedido.items.map((item) => (
              <li key={item.id} className="py-2">
                <p className="flex justify-between gap-3 font-medium">
                  <span>
                    {item.weightGrams ? formatGrams(item.weightGrams) : `${item.quantity}×`}{' '}
                    {item.productName}
                    {item.pizzaSizeName ? ` (${item.pizzaSizeName})` : ''}
                  </span>
                  <span className="shrink-0">{formatCents(item.totalCents)}</span>
                </p>
                {item.flavors.length > 0 ? (
                  <p className="text-muted-foreground pl-3">
                    {item.flavors.map((sabor) => sabor.flavorName).join(', ')}
                  </p>
                ) : null}
                {item.complements.map((complemento) => (
                  <p key={complemento.id} className="text-muted-foreground pl-3">
                    + {complemento.quantity}× {complemento.optionName}
                  </p>
                ))}
                {item.pizzaExtraName ? (
                  <p className="text-muted-foreground pl-3">+ {item.pizzaExtraName}</p>
                ) : null}
                {item.notes ? (
                  <p className="text-muted-foreground pl-3 italic">{item.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="space-y-1 border-t pt-3 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCents(pedido.subtotalCents)}</span>
            </p>
            {pedido.deliveryFeeCents > 0 ? (
              <p className="flex justify-between">
                <span className="text-muted-foreground">Entrega</span>
                <span>{formatCents(pedido.deliveryFeeCents)}</span>
              </p>
            ) : null}
            {pedido.discountCents > 0 ? (
              <p className="text-success flex justify-between">
                <span>Desconto</span>
                <span>−{formatCents(pedido.discountCents)}</span>
              </p>
            ) : null}
            <p className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{formatCents(pedido.totalCents)}</span>
            </p>
          </div>

          {pedido.payment ? (
            <p className="text-muted-foreground text-sm">
              {PAYMENT_METHOD_LABEL[pedido.payment.method as keyof typeof PAYMENT_METHOD_LABEL] ??
                pedido.payment.method}
              {pedido.payment.changeForCents
                ? ` · troco para ${formatCents(pedido.payment.changeForCents)}`
                : ''}
              {pedido.payment.status === 'PAID' ? (
                <Badge variant="success" className="ml-2">
                  Pago
                </Badge>
              ) : null}
            </p>
          ) : null}

          {endereco ? (
            <div className="text-muted-foreground border-t pt-3 text-sm">
              <p className="text-foreground font-medium">Entregar em</p>
              <p>
                {[endereco.street, endereco.number].filter(Boolean).join(', ')} —{' '}
                {endereco.neighborhood}
              </p>
              {endereco.referencePoint ? <p>Referência: {endereco.referencePoint}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {contato ? (
          <Button asChild variant="outline">
            <a href={whatsappLink(contato)} target="_blank" rel="noreferrer">
              <MessageCircle className="h-5 w-5" aria-hidden />
              Falar com a loja
            </a>
          </Button>
        ) : null}

        {status === 'DELIVERED' && !pedido.jaAvaliado ? (
          <Button asChild>
            <Link href={`/pedidos/${pedido.id}/avaliar`}>Avaliar pedido</Link>
          </Button>
        ) : null}

        <Button asChild variant="ghost">
          <Link href="/pedidos">Meus pedidos</Link>
        </Button>
      </div>
    </main>
  );
}

/**
 * Pagamento por Pix.
 *
 * O copia-e-cola vem antes do QR de propósito: no celular, que é onde o
 * cliente está, apontar a câmera para a própria tela é impossível — ele
 * precisa copiar o código e colar no app do banco.
 */
function PagamentoPix({
  qrCode,
  qrCodeImage,
  expiraEm,
}: {
  qrCode: string;
  qrCodeImage: string | null;
  expiraEm: string | null;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Navegador sem permissão de área de transferência: o código continua
      // visível e selecionável abaixo.
      setCopiado(false);
    }
  }

  return (
    <Card className="border-primary">
      <CardContent className="space-y-4 pt-5">
        <div>
          <p className="font-bold">Pague com Pix para a loja receber seu pedido</p>
          {expiraEm ? (
            <p className="text-muted-foreground text-sm">
              O código vale até{' '}
              {new Date(expiraEm).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              .
            </p>
          ) : null}
        </div>

        <Button size="lg" block onClick={copiar}>
          <Copy className="h-5 w-5" aria-hidden />
          {copiado ? 'Código copiado!' : 'Copiar código Pix'}
        </Button>

        <p className="text-muted-foreground text-sm">
          Abra o app do seu banco, escolha Pix → Copia e cola e cole o código.
        </p>

        {qrCodeImage ? (
          <details>
            <summary className="min-h-touch flex cursor-pointer items-center font-medium">
              Ou leia o QR Code em outro aparelho
            </summary>
            {/* `img` cru e não `next/image`: é um data URI gerado pelo
                gateway, que o otimizador não tem o que otimizar. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeImage} alt="QR Code do Pix" className="mt-3 w-52" />
          </details>
        ) : null}

        <details>
          <summary className="text-muted-foreground min-h-touch flex cursor-pointer items-center text-sm">
            Ver o código
          </summary>
          <p className="bg-muted mt-2 break-all rounded-lg p-3 font-mono text-xs">{qrCode}</p>
        </details>

        <p className="text-muted-foreground text-sm">
          Assim que o pagamento cair, esta tela muda sozinha.
        </p>
      </CardContent>
    </Card>
  );
}
