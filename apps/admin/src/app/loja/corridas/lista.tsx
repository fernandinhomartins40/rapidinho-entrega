'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatCents, formatPhoneBR, whatsappLink } from '@rapidinho/shared';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { cancelarCorridaAvulsa } from './actions';

export interface CorridaNaTela {
  id: string;
  status: 'OPEN' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  cliente: string;
  endereco: string;
  feeCents: number;
  collectCents: number | null;
  criadaEm: string;
  entregador: { nome: string; telefone: string | null } | null;
}

const SITUACAO: Record<
  CorridaNaTela['status'],
  { rotulo: string; variante: 'warning' | 'secondary' | 'success' | 'destructive' }
> = {
  OPEN: { rotulo: 'Procurando entregador', variante: 'warning' },
  ACCEPTED: { rotulo: 'Entregador a caminho da loja', variante: 'secondary' },
  PICKED_UP: { rotulo: 'Saiu para entrega', variante: 'secondary' },
  DELIVERED: { rotulo: 'Entregue', variante: 'success' },
  CANCELLED: { rotulo: 'Cancelada', variante: 'destructive' },
};

/** De quanto em quanto tempo a lista se atualiza enquanto há corrida andando. */
const INTERVALO_MS = 10_000;

export function ListaDeCorridas({ corridas }: { corridas: CorridaNaTela[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const emAndamento = corridas.some((corrida) =>
    ['OPEN', 'ACCEPTED', 'PICKED_UP'].includes(corrida.status),
  );

  // Enquanto há corrida andando, a tela acompanha sozinha: a loja quer saber
  // quem pegou e quando saiu, sem ficar apertando F5.
  useEffect(() => {
    if (!emAndamento) return;
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, INTERVALO_MS);
    return () => window.clearInterval(intervalo);
  }, [emAndamento, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corridas de hoje</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {erro ? <p className="text-destructive text-sm">{erro}</p> : null}
        {corridas.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma corrida hoje. Chame a primeira ao lado — ela aparece aqui e acompanha sozinha
            até a entrega.
          </p>
        ) : (
          <ul className="divide-y">
            {corridas.map((corrida) => {
              const situacao = SITUACAO[corrida.status];
              return (
                <li key={corrida.id} className="space-y-1.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{corrida.cliente}</span>
                    <Badge variant={situacao.variante}>{situacao.rotulo}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">{corrida.endereco}</p>
                  <p className="text-sm">
                    Corrida: <strong>{formatCents(corrida.feeCents)}</strong>
                    {corrida.collectCents ? (
                      <> · cobrar do cliente {formatCents(corrida.collectCents)}</>
                    ) : null}
                    <span className="text-muted-foreground">
                      {' '}
                      ·{' '}
                      {new Date(corrida.criadaEm).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                  {corrida.entregador ? (
                    <p className="text-sm">
                      {corrida.entregador.nome}
                      {corrida.entregador.telefone ? (
                        <>
                          {' · '}
                          <a
                            href={whatsappLink(corrida.entregador.telefone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-text font-semibold hover:underline"
                          >
                            {formatPhoneBR(corrida.entregador.telefone)}
                          </a>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {corrida.status === 'OPEN' || corrida.status === 'ACCEPTED' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pendente}
                      onClick={() =>
                        iniciar(async () => {
                          setErro(null);
                          const resultado = await cancelarCorridaAvulsa(corrida.id);
                          if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível.');
                        })
                      }
                    >
                      Cancelar corrida
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
