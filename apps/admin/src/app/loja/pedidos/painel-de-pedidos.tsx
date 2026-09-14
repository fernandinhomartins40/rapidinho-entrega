'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, Check, Clock, Printer, Volume2, VolumeX, Wifi, WifiOff, X } from 'lucide-react';
import { Badge, Button, Card, CardContent, cn } from '@rapidinho/ui';
import { useRealtime } from '@rapidinho/ui/hooks/use-realtime';
import {
  formatCents,
  isActiveStatus,
  nextStatuses,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  REALTIME_EVENTS,
  whatsappLink,
  type OrderStatus,
} from '@rapidinho/shared';
import { aceitarPedido, cancelarPedido, mudarStatusDoPedido } from './actions';
import { iniciarAlerta, pararAlerta, prepararAudio } from '@/lib/alerta-sonoro';
import { Comanda, abrirImpressao } from './comanda';
import { formatarEndereco, lerEndereco, type PedidoNaTela } from './tipos';

interface Props {
  pedidos: PedidoNaTela[];
  loja: { nome: string; alertaSonoro: boolean };
  realtime: { channel: string; token: string; url: string };
}

/** Tempos de preparo oferecidos no aceite — um toque, sem digitar. */
const TEMPOS_DE_PREPARO = [15, 20, 30, 45, 60] as const;

export function PainelDePedidos({ pedidos, loja, realtime }: Props) {
  const router = useRouter();
  const [somLigado, setSomLigado] = useState(loja.alertaSonoro);
  const [tocando, setTocando] = useState(false);
  const [pedidoImpresso, setPedidoImpresso] = useState<PedidoNaTela | null>(null);

  const novos = useMemo(() => pedidos.filter((p) => p.status === 'RECEIVED'), [pedidos]);
  const emAndamento = useMemo(
    () => pedidos.filter((p) => isActiveStatus(p.status) && p.status !== 'RECEIVED'),
    [pedidos],
  );
  const encerrados = useMemo(() => pedidos.filter((p) => !isActiveStatus(p.status)), [pedidos]);

  // Guarda o total anterior para distinguir "chegou pedido" de "a lista foi
  // recarregada". Sem isso o alerta tocaria a cada revalidação.
  const totalAnterior = useRef(novos.length);

  useEffect(() => {
    const chegou = novos.length > totalAnterior.current;
    totalAnterior.current = novos.length;

    if (novos.length === 0) {
      pararAlerta();
      setTocando(false);
      return;
    }

    if (chegou && somLigado) {
      iniciarAlerta();
      setTocando(true);
    }
  }, [novos.length, somLigado]);

  // Para o alerta ao sair da tela: som repetindo numa aba esquecida é pior que
  // alerta nenhum.
  useEffect(() => () => pararAlerta(), []);

  const aoReceberEvento = useCallback(() => {
    // O servidor é a fonte de verdade: em vez de remontar o pedido a partir do
    // payload (e arriscar divergir), pedimos os dados de novo. Continua tempo
    // real — o gatilho é o socket, não um relógio.
    router.refresh();
  }, [router]);

  const { conectado } = useRealtime({
    channel: realtime.channel,
    token: realtime.token,
    url: realtime.url,
    handlers: {
      [REALTIME_EVENTS.orderCreated]: aoReceberEvento,
      [REALTIME_EVENTS.orderStatusChanged]: aoReceberEvento,
      [REALTIME_EVENTS.orderCancelled]: aoReceberEvento,
    },
  });

  function silenciar() {
    pararAlerta();
    setTocando(false);
  }

  return (
    <div className="space-y-6" onClickCapture={prepararAudio}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
            {conectado ? (
              <>
                <Wifi className="text-success h-4 w-4" aria-hidden />
                Conectado — novos pedidos aparecem sozinhos
              </>
            ) : (
              <>
                <WifiOff className="text-warning h-4 w-4" aria-hidden />
                Reconectando…
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tocando ? (
            <Button onClick={silenciar} variant="destructive">
              <BellRing className="animate-pulse-alert h-5 w-5" aria-hidden />
              Silenciar
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setSomLigado((ligado) => !ligado);
              if (somLigado) silenciar();
            }}
            aria-label={somLigado ? 'Desligar alerta sonoro' : 'Ligar alerta sonoro'}
          >
            {somLigado ? (
              <Volume2 className="h-5 w-5" aria-hidden />
            ) : (
              <VolumeX className="h-5 w-5" aria-hidden />
            )}
          </Button>
        </div>
      </header>

      <Secao titulo="Aguardando você" destaque total={novos.length}>
        {novos.map((pedido) => (
          <CartaoDePedido
            key={pedido.id}
            pedido={pedido}
            onImprimir={setPedidoImpresso}
            onAgir={silenciar}
          />
        ))}
      </Secao>

      <Secao titulo="Em andamento" total={emAndamento.length}>
        {emAndamento.map((pedido) => (
          <CartaoDePedido key={pedido.id} pedido={pedido} onImprimir={setPedidoImpresso} />
        ))}
      </Secao>

      <Secao titulo="Encerrados hoje" total={encerrados.length} recolhivel>
        {encerrados.map((pedido) => (
          <CartaoDePedido key={pedido.id} pedido={pedido} onImprimir={setPedidoImpresso} />
        ))}
      </Secao>

      {pedidoImpresso ? (
        <Comanda
          pedido={pedidoImpresso}
          loja={loja.nome}
          onFechar={() => setPedidoImpresso(null)}
        />
      ) : null}
    </div>
  );
}

function Secao({
  titulo,
  total,
  destaque,
  recolhivel,
  children,
}: {
  titulo: string;
  total: number;
  destaque?: boolean;
  recolhivel?: boolean;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(!recolhivel);

  if (total === 0 && !destaque) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        {titulo}
        <Badge variant={destaque && total > 0 ? 'destructive' : 'secondary'}>{total}</Badge>
        {recolhivel ? (
          <button
            type="button"
            onClick={() => setAberta((v) => !v)}
            className="text-muted-foreground ml-auto text-sm font-medium underline"
          >
            {aberta ? 'Recolher' : 'Mostrar'}
          </button>
        ) : null}
      </h2>

      {total === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6">
            Nenhum pedido novo agora. Assim que entrar um, ele aparece aqui e o alerta toca.
          </CardContent>
        </Card>
      ) : aberta ? (
        <div className="grid gap-4 xl:grid-cols-2">{children}</div>
      ) : null}
    </section>
  );
}

function CartaoDePedido({
  pedido,
  onImprimir,
  onAgir,
}: {
  pedido: PedidoNaTela;
  onImprimir: (pedido: PedidoNaTela) => void;
  onAgir?: () => void;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const endereco = lerEndereco(pedido.addressSnapshot);

  function executar(acao: () => Promise<{ ok: boolean; message?: string }>) {
    onAgir?.();
    setErro(null);

    iniciarTransicao(async () => {
      const resultado = await acao();
      if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível concluir.');
    });
  }

  const proximos = nextStatuses(pedido.status).filter(
    (status) => status !== 'CANCELLED' && status !== 'REJECTED',
  );

  return (
    <Card className={cn(pedido.status === 'RECEIVED' && 'border-primary border-2')}>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold">
              #{pedido.number}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {new Date(pedido.createdAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </p>
            <p className="truncate font-medium">{pedido.customerName}</p>
            <a
              href={whatsappLink(pedido.customerPhone)}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground text-sm underline"
            >
              {pedido.customerPhone}
            </a>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant={pedido.status === 'RECEIVED' ? 'destructive' : 'secondary'}>
              {ORDER_STATUS_LABEL[pedido.status]}
            </Badge>
            <Badge variant="outline">{pedido.type === 'PICKUP' ? 'Retirada' : 'Entrega'}</Badge>
          </div>
        </div>

        <ul className="space-y-2 border-y py-3 text-sm">
          {pedido.items.map((item) => (
            <li key={item.id}>
              <p className="font-medium">
                {item.weightGrams
                  ? `${(item.weightGrams / 1000).toFixed(3)} kg`
                  : `${item.quantity}×`}{' '}
                {item.productName}
                {item.pizzaSizeName ? ` (${item.pizzaSizeName})` : ''}
                <span className="text-muted-foreground float-right font-normal">
                  {formatCents(item.totalCents)}
                </span>
              </p>
              {item.flavors.length > 0 ? (
                <p className="text-muted-foreground pl-4">
                  Sabores: {item.flavors.map((sabor) => sabor.flavorName).join(', ')}
                </p>
              ) : null}
              {item.complements.map((complemento) => (
                <p key={complemento.id} className="text-muted-foreground pl-4">
                  + {complemento.quantity}× {complemento.optionName}
                </p>
              ))}
              {item.pizzaExtraName ? (
                <p className="text-muted-foreground pl-4">+ {item.pizzaExtraName}</p>
              ) : null}
              {item.notes ? (
                <p className="text-warning-text pl-4 font-medium">Obs.: {item.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>

        {endereco ? (
          <div className="text-sm">
            <p>{formatarEndereco(endereco)}</p>
            {/* No interior o ponto de referência costuma valer mais que o
                número da casa — por isso ganha destaque. */}
            {endereco.referencePoint ? (
              <p className="text-warning-text font-medium">Referência: {endereco.referencePoint}</p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-1 text-sm">
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
          {pedido.payment ? (
            <p className="text-muted-foreground">
              {PAYMENT_METHOD_LABEL[pedido.payment.method as keyof typeof PAYMENT_METHOD_LABEL] ??
                pedido.payment.method}
              {/* O troco é a informação que o entregador esquece de levar. */}
              {pedido.payment.changeForCents
                ? ` · troco para ${formatCents(pedido.payment.changeForCents)}`
                : ''}
            </p>
          ) : null}
        </div>

        {pedido.notes ? (
          <p className="text-warning-text text-sm font-medium">Obs.: {pedido.notes}</p>
        ) : null}
        {pedido.cancelReason ? (
          <p className="text-destructive text-sm">Motivo: {pedido.cancelReason}</p>
        ) : null}
        {erro ? <p className="text-destructive text-sm font-medium">{erro}</p> : null}

        {pedido.status === 'RECEIVED' ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Aceitar e preparar em:</p>
            <div className="flex flex-wrap gap-2">
              {TEMPOS_DE_PREPARO.map((minutos) => (
                <Button
                  key={minutos}
                  size="lg"
                  disabled={pendente}
                  onClick={() => executar(() => aceitarPedido(pedido.id, minutos))}
                  className="flex-1"
                >
                  <Check className="h-5 w-5" aria-hidden />
                  {minutos} min
                </Button>
              ))}
            </div>
            <BotaoRecusar pedido={pedido} onExecutar={executar} pendente={pendente} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {proximos.map((status) => (
              <Button
                key={status}
                size="lg"
                disabled={pendente}
                onClick={() => executar(() => mudarStatusDoPedido({ orderId: pedido.id, status }))}
              >
                <Clock className="h-5 w-5" aria-hidden />
                {rotuloDoBotao(status)}
              </Button>
            ))}
            <Button variant="outline" size="lg" onClick={() => onImprimir(pedido)}>
              <Printer className="h-5 w-5" aria-hidden />
              Comanda
            </Button>
            {isActiveStatus(pedido.status) ? (
              <BotaoRecusar pedido={pedido} onExecutar={executar} pendente={pendente} />
            ) : null}
          </div>
        )}

        {pedido.status === 'RECEIVED' ? (
          <Button variant="outline" block onClick={() => onImprimir(pedido)}>
            <Printer className="h-5 w-5" aria-hidden />
            Imprimir comanda
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BotaoRecusar({
  pedido,
  onExecutar,
  pendente,
}: {
  pedido: PedidoNaTela;
  onExecutar: (acao: () => Promise<{ ok: boolean; message?: string }>) => void;
  pendente: boolean;
}) {
  const [motivo, setMotivo] = useState('');
  const [abrindo, setAbrindo] = useState(false);

  if (!abrindo) {
    return (
      <Button variant="outline" size="lg" disabled={pendente} onClick={() => setAbrindo(true)}>
        <X className="h-5 w-5" aria-hidden />
        {pedido.status === 'RECEIVED' ? 'Recusar' : 'Cancelar'}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <label className="block text-sm font-semibold" htmlFor={`motivo-${pedido.id}`}>
        Por quê? O cliente vai ver esta mensagem.
      </label>
      <input
        id={`motivo-${pedido.id}`}
        value={motivo}
        onChange={(evento) => setMotivo(evento.target.value)}
        placeholder="Ex.: produto esgotado"
        className="border-input min-h-touch w-full rounded-lg border px-3"
      />
      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={pendente || motivo.trim().length < 3}
          onClick={() =>
            onExecutar(() => cancelarPedido({ orderId: pedido.id, reason: motivo.trim() }))
          }
        >
          Confirmar
        </Button>
        <Button variant="ghost" onClick={() => setAbrindo(false)}>
          Voltar
        </Button>
      </div>
    </div>
  );
}

function rotuloDoBotao(status: OrderStatus): string {
  const rotulos: Partial<Record<OrderStatus, string>> = {
    PREPARING: 'Começar preparo',
    READY: 'Marcar como pronto',
    OUT_FOR_DELIVERY: 'Saiu para entrega',
    DELIVERED: 'Entregue',
  };

  return rotulos[status] ?? ORDER_STATUS_LABEL[status];
}

export { abrirImpressao };
