'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Phone, Store } from 'lucide-react';
import { formatCents, formatPhoneBR, whatsappLink } from '@rapidinho/shared';
import { Badge, Button, Card, CardContent } from '@rapidinho/ui';
import { aceitarCorridaAvulsa, avancarCorridaAvulsa } from './actions';

export interface CorridaAvulsa {
  id: string;
  status: 'OPEN' | 'ACCEPTED' | 'PICKED_UP';
  loja: { nome: string; endereco: string; telefone: string | null };
  cliente: string;
  telefoneDoCliente: string | null;
  endereco: string;
  referencia: string | null;
  recado: string | null;
  feeCents: number;
  collectCents: number | null;
}

/** A fila de corridas avulsas muda sem evento próprio: confere de tempos em tempos. */
const INTERVALO_MS = 15_000;

/**
 * Corridas que as lojas chamaram fora do app. Para o entregador é igual a
 * qualquer corrida — buscar na loja, levar ao cliente —, com a diferença de
 * que quem paga é a loja, direto a ele, o valor mostrado aqui.
 */
export function CorridasAvulsas({
  abertas,
  minhas,
  ganhosDeHoje,
}: {
  abertas: CorridaAvulsa[];
  minhas: CorridaAvulsa[];
  ganhosDeHoje: { centavos: number; corridas: number };
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, INTERVALO_MS);
    return () => window.clearInterval(intervalo);
  }, [router]);

  function executar(acao: () => Promise<{ ok: boolean; message?: string }>) {
    setMensagem(null);
    iniciar(async () => {
      const resultado = await acao();
      setMensagem({ ok: resultado.ok, texto: resultado.message ?? '' });
    });
  }

  if (abertas.length === 0 && minhas.length === 0 && ganhosDeHoje.corridas === 0) return null;

  return (
    <section aria-labelledby="corridas-avulsas" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="corridas-avulsas" className="text-lg font-bold">
          Corridas das lojas
        </h2>
        {ganhosDeHoje.corridas > 0 ? (
          <span className="text-muted-foreground text-sm">
            Hoje: {ganhosDeHoje.corridas} {ganhosDeHoje.corridas === 1 ? 'corrida' : 'corridas'} ·{' '}
            <strong className="text-foreground">{formatCents(ganhosDeHoje.centavos)}</strong>
          </span>
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">
        Entregas que as lojas pediram fora do app. A loja paga você direto, na retirada.
      </p>

      {mensagem?.texto ? (
        <p className={mensagem.ok ? 'text-success text-sm' : 'text-destructive text-sm'}>
          {mensagem.texto}
        </p>
      ) : null}

      {[...minhas, ...abertas].map((corrida) => (
        <Card
          key={corrida.id}
          className={corrida.status !== 'OPEN' ? 'border-primary border-2' : ''}
        >
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-extrabold">{formatCents(corrida.feeCents)}</p>
                <p className="text-muted-foreground text-xs">a loja paga a você</p>
              </div>
              <Badge variant={corrida.status === 'OPEN' ? 'warning' : 'secondary'}>
                {corrida.status === 'OPEN'
                  ? 'Disponível'
                  : corrida.status === 'ACCEPTED'
                    ? 'Buscar na loja'
                    : 'Levando ao cliente'}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <p className="flex gap-2">
                <Store className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <strong>{corrida.loja.nome}</strong>
                  <span className="text-muted-foreground block">{corrida.loja.endereco}</span>
                </span>
              </p>
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {corrida.status === 'OPEN' ? null : <strong>{corrida.cliente} · </strong>}
                  {corrida.endereco}
                  {corrida.referencia ? (
                    <span className="text-warning-text block font-medium">
                      Referência: {corrida.referencia}
                    </span>
                  ) : null}
                </span>
              </p>
              {corrida.collectCents ? (
                <p className="bg-warning/10 text-warning-text rounded-lg px-3 py-2 font-semibold">
                  Cobrar {formatCents(corrida.collectCents)} do cliente
                </p>
              ) : null}
              {corrida.recado && corrida.status !== 'OPEN' ? (
                <p className="text-muted-foreground">Recado: {corrida.recado}</p>
              ) : null}
            </div>

            {corrida.status === 'OPEN' ? (
              <Button
                block
                size="lg"
                disabled={pendente}
                onClick={() => executar(() => aceitarCorridaAvulsa({ corridaId: corrida.id }))}
              >
                Aceitar corrida
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={pendente}
                  onClick={() =>
                    executar(() =>
                      avancarCorridaAvulsa({
                        corridaId: corrida.id,
                        status: corrida.status === 'ACCEPTED' ? 'PICKED_UP' : 'DELIVERED',
                      }),
                    )
                  }
                >
                  {corrida.status === 'ACCEPTED' ? 'Peguei na loja' : 'Entreguei'}
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      corrida.status === 'ACCEPTED' ? corrida.loja.endereco : corrida.endereco,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir no mapa"
                  >
                    <Navigation className="h-5 w-5" aria-hidden />
                  </a>
                </Button>
                {(
                  corrida.status === 'ACCEPTED' ? corrida.loja.telefone : corrida.telefoneDoCliente
                ) ? (
                  <Button asChild variant="outline" size="lg">
                    <a
                      href={whatsappLink(
                        (corrida.status === 'ACCEPTED'
                          ? corrida.loja.telefone
                          : corrida.telefoneDoCliente)!,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Falar com ${
                        corrida.status === 'ACCEPTED' ? 'a loja' : 'o cliente'
                      }: ${formatPhoneBR(
                        (corrida.status === 'ACCEPTED'
                          ? corrida.loja.telefone
                          : corrida.telefoneDoCliente)!,
                      )}`}
                    >
                      <Phone className="h-5 w-5" aria-hidden />
                    </a>
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
