'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, MapPin, Navigation, Package, Phone, Wifi, WifiOff } from 'lucide-react';
import { Badge, Button, Card, CardContent, SwitchField } from '@rapidinho/ui';
import { useRealtime } from '@rapidinho/ui/hooks/use-realtime';
import {
  formatCents,
  PAYMENT_METHOD_LABEL,
  REALTIME_EVENTS,
  whatsappLink,
} from '@rapidinho/shared';
import { aceitarCorrida, alterarDisponibilidade, avancarCorrida } from './actions';

interface Endereco {
  street?: string;
  number?: string;
  neighborhood?: string;
  referencePoint?: string;
}

interface CorridaDisponivel {
  id: string;
  earningCents: number;
  distanceMeters: number | null;
  order: {
    number: string;
    totalCents: number;
    addressSnapshot: unknown;
    store: { name: string; street: string; number: string | null; neighborhood: string };
  };
}

interface MinhaCorrida {
  id: string;
  status: string;
  earningCents: number;
  order: {
    number: string;
    customerName: string;
    customerPhone: string;
    totalCents: number;
    addressSnapshot: unknown;
    payment: { method: string; status: string; changeForCents: number | null } | null;
    store: {
      name: string;
      phone: string;
      street: string;
      number: string | null;
      neighborhood: string;
    };
  };
}

function lerEndereco(snapshot: unknown): Endereco | null {
  if (snapshot == null || typeof snapshot !== 'object') return null;
  return snapshot as Endereco;
}

function enderecoEmTexto(endereco: Endereco): string {
  const rua = [endereco.street, endereco.number].filter(Boolean).join(', ');
  return [rua, endereco.neighborhood].filter(Boolean).join(' — ');
}

/** Link que abre o mapa do celular com o endereço já preenchido. */
function linkDoMapa(texto: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
}

export function PainelDoEntregador({
  entregador,
  ganhosDeHoje,
  disponiveis,
  minhas,
  realtime,
}: {
  entregador: {
    nome: string | null;
    online: boolean;
    entregasTotais: number;
    nota: number;
    daLoja: boolean;
  };
  ganhosDeHoje: { centavos: number; entregas: number };
  disponiveis: CorridaDisponivel[];
  minhas: MinhaCorrida[];
  realtime: { channel: string; token: string; url: string };
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [online, setOnline] = useState(entregador.online);

  const aoMudar = useCallback(() => router.refresh(), [router]);

  const { conectado } = useRealtime({
    channel: realtime.channel,
    token: realtime.token,
    url: realtime.url,
    handlers: {
      [REALTIME_EVENTS.deliveryAssigned]: aoMudar,
      [REALTIME_EVENTS.deliveryStatusChanged]: aoMudar,
      [REALTIME_EVENTS.orderStatusChanged]: aoMudar,
    },
  });

  function executar(acao: () => Promise<{ ok: boolean; message?: string }>) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await acao();
      if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível concluir.');
    });
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 p-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {entregador.nome?.split(' ')[0] ?? 'entregador'}
        </h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
          {conectado ? (
            <>
              <Wifi className="text-success h-4 w-4" aria-hidden />
              Novas corridas aparecem sozinhas
            </>
          ) : (
            <>
              <WifiOff className="text-warning h-4 w-4" aria-hidden />
              Reconectando…
            </>
          )}
        </p>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <SwitchField
            checked={online}
            disabled={pendente}
            onCheckedChange={(valor) => {
              setOnline(valor);
              executar(() => alterarDisponibilidade({ online: valor }));
            }}
            label={online ? 'Você está online' : 'Você está offline'}
            description="Offline você não recebe corridas novas, mas continua com as que já aceitou."
          />

          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <p className="text-muted-foreground text-sm">Ganhos de hoje</p>
              <p className="text-xl font-bold">{formatCents(ganhosDeHoje.centavos)}</p>
              <p className="text-muted-foreground text-sm">
                {ganhosDeHoje.entregas} {ganhosDeHoje.entregas === 1 ? 'entrega' : 'entregas'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">No total</p>
              <p className="text-xl font-bold">{entregador.entregasTotais}</p>
              {entregador.nota > 0 ? (
                <p className="text-muted-foreground text-sm">Nota {entregador.nota.toFixed(1)}</p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {erro ? <p className="text-destructive font-medium">{erro}</p> : null}

      {minhas.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">Suas corridas</h2>
          <ul className="space-y-3">
            {minhas.map((corrida) => {
              const endereco = lerEndereco(corrida.order.addressSnapshot);
              const enderecoDaLoja = [
                corrida.order.store.street,
                corrida.order.store.number,
                corrida.order.store.neighborhood,
              ]
                .filter(Boolean)
                .join(', ');

              const retirado = corrida.status === 'PICKED_UP';

              return (
                <li key={corrida.id}>
                  <Card className="border-primary border-2">
                    <CardContent className="space-y-3 pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-bold">#{corrida.order.number}</p>
                        <Badge variant={retirado ? 'success' : 'warning'}>
                          {retirado ? 'A caminho do cliente' : 'Retirar na loja'}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-muted-foreground flex items-center gap-1.5">
                            <Package className="h-4 w-4" aria-hidden />
                            Retirar em
                          </p>
                          <p className="font-medium">{corrida.order.store.name}</p>
                          <p>{enderecoDaLoja}</p>
                        </div>

                        {endereco ? (
                          <div>
                            <p className="text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="h-4 w-4" aria-hidden />
                              Entregar para
                            </p>
                            <p className="font-medium">{corrida.order.customerName}</p>
                            <p>{enderecoEmTexto(endereco)}</p>
                            {/* A referência é o que resolve a entrega no
                                interior, onde muita casa não tem número. */}
                            {endereco.referencePoint ? (
                              <p className="text-warning font-medium">
                                Referência: {endereco.referencePoint}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {corrida.order.payment &&
                      corrida.order.payment.status !== 'PAID' &&
                      (corrida.order.payment.method === 'CASH_ON_DELIVERY' ||
                        corrida.order.payment.method === 'CARD_ON_DELIVERY') ? (
                        <div className="bg-warning/15 rounded-lg p-3 text-sm">
                          <p className="font-semibold">
                            Receber {formatCents(corrida.order.totalCents)} —{' '}
                            {
                              PAYMENT_METHOD_LABEL[
                                corrida.order.payment.method as keyof typeof PAYMENT_METHOD_LABEL
                              ]
                            }
                          </p>
                          {corrida.order.payment.changeForCents ? (
                            <p>
                              Levar troco para {formatCents(corrida.order.payment.changeForCents)}{' '}
                              (troco de{' '}
                              {formatCents(
                                corrida.order.payment.changeForCents - corrida.order.totalCents,
                              )}
                              )
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <p className="font-semibold">
                        Você ganha {formatCents(corrida.earningCents)}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={linkDoMapa(
                              retirado && endereco ? enderecoEmTexto(endereco) : enderecoDaLoja,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Navigation className="h-4 w-4" aria-hidden />
                            Abrir no mapa
                          </a>
                        </Button>

                        <Button asChild variant="outline" size="sm">
                          <a
                            href={whatsappLink(
                              retirado ? corrida.order.customerPhone : corrida.order.store.phone,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Phone className="h-4 w-4" aria-hidden />
                            {retirado ? 'Falar com o cliente' : 'Falar com a loja'}
                          </a>
                        </Button>
                      </div>

                      <Button
                        size="lg"
                        block
                        disabled={pendente}
                        onClick={() =>
                          executar(() =>
                            avancarCorrida({
                              deliveryId: corrida.id,
                              status: retirado ? 'DELIVERED' : 'PICKED_UP',
                            }),
                          )
                        }
                      >
                        {retirado ? 'Confirmar entrega' : 'Peguei o pedido'}
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-bold">Corridas disponíveis</h2>

        {!online ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6">
              Você está offline. Fique online para ver as corridas.
            </CardContent>
          </Card>
        ) : disponiveis.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6">
              Nenhuma corrida agora. Assim que sair um pedido, ele aparece aqui sozinho.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {disponiveis.map((corrida) => {
              const endereco = lerEndereco(corrida.order.addressSnapshot);

              return (
                <li key={corrida.id}>
                  <Card>
                    <CardContent className="space-y-3 pt-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold">{corrida.order.store.name}</p>
                          <p className="text-muted-foreground text-sm">
                            {corrida.order.store.neighborhood}
                            {endereco?.neighborhood ? ` → ${endereco.neighborhood}` : ''}
                          </p>
                        </div>
                        <p className="shrink-0 text-lg font-bold">
                          {formatCents(corrida.earningCents)}
                        </p>
                      </div>

                      {corrida.distanceMeters ? (
                        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                          <Bike className="h-4 w-4" aria-hidden />
                          {(corrida.distanceMeters / 1000).toFixed(1)} km
                        </p>
                      ) : null}

                      <Button
                        size="lg"
                        block
                        disabled={pendente}
                        onClick={() => executar(() => aceitarCorrida({ deliveryId: corrida.id }))}
                      >
                        Aceitar corrida
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
