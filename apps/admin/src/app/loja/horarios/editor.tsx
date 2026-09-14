'use client';

import { useActionState, useState, useTransition } from 'react';
import { Pause, Play, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  SwitchField,
} from '@rapidinho/ui';
import { excluirFeriado, pausarLoja, retomarLoja, salvarFeriado, salvarHorarios } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

const DIAS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

/** Duração das pausas rápidas, em minutos. */
const PAUSAS = [30, 60, 120, 240] as const;

interface Horario {
  weekday: number;
  opensAt: number;
  closesAt: number;
  isActive: boolean;
}

/** 1080 → "18:00". Minutos acima de 1440 voltam ao começo do dia seguinte. */
function paraHora(minutos: number): string {
  const normalizado = minutos % 1440;
  const hora = Math.floor(normalizado / 60);
  const minuto = normalizado % 60;
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

function paraMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function EditorDeHorarios({
  horarios,
  fechamentos,
  pausa,
  abertaAgora,
  motivoDoFechamento,
}: {
  horarios: Horario[];
  fechamentos: { id: string; startsAt: string; endsAt: string; reason: string | null }[];
  pausa: { ate: string | null; motivo: string | null };
  abertaAgora: boolean;
  motivoDoFechamento: string | null;
}) {
  const [estado, acao, pendente] = useActionState(salvarHorarios, ACTION_IDLE);

  // Dias que nunca foram cadastrados entram fechados, em vez de sumirem da
  // tela: o lojista precisa ver os sete para decidir.
  const [dias, setDias] = useState<Horario[]>(() =>
    DIAS.map((_, weekday) => {
      const existente = horarios.find((hora) => hora.weekday === weekday);
      return existente ?? { weekday, opensAt: 8 * 60, closesAt: 18 * 60, isActive: false };
    }),
  );

  function alterar(weekday: number, mudanca: Partial<Horario>) {
    setDias((atual) =>
      atual.map((dia) => (dia.weekday === weekday ? { ...dia, ...mudanca } : dia)),
    );
  }

  /** Copia o primeiro dia aberto para todos: o caso mais comum é o mesmo horário. */
  function replicarParaTodos() {
    const modelo = dias.find((dia) => dia.isActive);
    if (!modelo) return;
    setDias((atual) =>
      atual.map((dia) => ({ ...dia, opensAt: modelo.opensAt, closesAt: modelo.closesAt })),
    );
  }

  const pausada = pausa.ate != null && new Date(pausa.ate) > new Date();

  return (
    <div className="space-y-6">
      <PausaDeEmergencia pausada={pausada} pausa={pausa} />

      <Card>
        <CardHeader>
          <CardTitle>
            Situação agora{' '}
            <Badge variant={abertaAgora ? 'success' : 'secondary'}>
              {abertaAgora ? 'Aberta' : 'Fechada'}
            </Badge>
          </CardTitle>
        </CardHeader>
        {!abertaAgora && motivoDoFechamento ? (
          <CardContent className="text-muted-foreground">{motivoDoFechamento}</CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horário de cada dia</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={acao} className="space-y-4">
            <input type="hidden" name="payload" value={JSON.stringify({ dias })} />

            <ul className="space-y-3">
              {dias.map((dia) => {
                const viraODia = dia.closesAt >= 1440;

                return (
                  <li key={dia.weekday} className="flex flex-wrap items-center gap-3 border-b pb-3">
                    <div className="w-40">
                      <SwitchField
                        checked={dia.isActive}
                        onCheckedChange={(marcado) => alterar(dia.weekday, { isActive: marcado })}
                        label={DIAS[dia.weekday] ?? ''}
                      />
                    </div>

                    {dia.isActive ? (
                      <>
                        <div>
                          <Label htmlFor={`abre-${dia.weekday}`}>Abre</Label>
                          <Input
                            id={`abre-${dia.weekday}`}
                            type="time"
                            value={paraHora(dia.opensAt)}
                            onChange={(evento) =>
                              alterar(dia.weekday, { opensAt: paraMinutos(evento.target.value) })
                            }
                            className="w-32"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`fecha-${dia.weekday}`}>Fecha</Label>
                          <Input
                            id={`fecha-${dia.weekday}`}
                            type="time"
                            value={paraHora(dia.closesAt)}
                            onChange={(evento) => {
                              const minutos = paraMinutos(evento.target.value);
                              // Fechar "antes" de abrir só faz sentido virando
                              // o dia — é a pizzaria que fecha às 2h.
                              alterar(dia.weekday, {
                                closesAt: minutos <= dia.opensAt ? minutos + 1440 : minutos,
                              });
                            }}
                            className="w-32"
                          />
                        </div>
                        {viraODia ? <Badge variant="secondary">Fecha no dia seguinte</Badge> : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">Fechado o dia todo</span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={pendente}>
                {pendente ? 'Salvando…' : 'Salvar horários'}
              </Button>
              <Button type="button" variant="outline" onClick={replicarParaTodos}>
                Usar o mesmo horário todos os dias
              </Button>
              {estado.message ? (
                <p
                  role="status"
                  className={
                    estado.ok ? 'text-success font-medium' : 'text-destructive font-medium'
                  }
                >
                  {estado.message}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Feriados fechamentos={fechamentos} />
    </div>
  );
}

function PausaDeEmergencia({
  pausada,
  pausa,
}: {
  pausada: boolean;
  pausa: { ate: string | null; motivo: string | null };
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function executar(acao: () => Promise<{ ok: boolean; message?: string }>) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await acao();
      if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível concluir.');
    });
  }

  if (pausada) {
    return (
      <Card className="border-destructive bg-destructive/10">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <div>
            <p className="font-semibold">
              Loja pausada até{' '}
              {new Date(pausa.ate!).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {pausa.motivo ? <p className="text-muted-foreground text-sm">{pausa.motivo}</p> : null}
          </div>
          <Button disabled={pendente} onClick={() => executar(retomarLoja)}>
            <Play className="h-5 w-5" aria-hidden />
            Voltar a receber pedidos
          </Button>
          {erro ? <p className="text-destructive w-full text-sm">{erro}</p> : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fechar agora</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Para quando acabou o gás, faltou funcionário ou a cozinha lotou. A loja volta sozinha
          quando o tempo acabar.
        </p>
        <Input
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Motivo (o cliente vê)"
          aria-label="Motivo da pausa"
        />
        <div className="flex flex-wrap gap-2">
          {PAUSAS.map((minutos) => (
            <Button
              key={minutos}
              variant="outline"
              disabled={pendente}
              onClick={() =>
                executar(() => pausarLoja({ minutos, motivo: motivo.trim() || undefined }))
              }
            >
              <Pause className="h-5 w-5" aria-hidden />
              {minutos >= 60 ? `${minutos / 60}h` : `${minutos} min`}
            </Button>
          ))}
        </div>
        {erro ? <p className="text-destructive text-sm">{erro}</p> : null}
      </CardContent>
    </Card>
  );
}

function Feriados({
  fechamentos,
}: {
  fechamentos: { id: string; startsAt: string; endsAt: string; reason: string | null }[];
}) {
  const [estado, acao, pendente] = useActionState(salvarFeriado, ACTION_IDLE);
  const [removendo, iniciarTransicao] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feriados e fechamentos programados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={acao} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="startsAt">Começa</Label>
            <Input id="startsAt" name="startsAt" type="datetime-local" required />
          </div>
          <div>
            <Label htmlFor="endsAt">Termina</Label>
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              required
              error={estado.fieldErrors?.endsAt}
            />
          </div>
          <div className="min-w-40 flex-1">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Input id="reason" name="reason" placeholder="Ex.: Natal" />
          </div>
          <Button type="submit" disabled={pendente}>
            <Plus className="h-5 w-5" aria-hidden />
            Programar
          </Button>
        </form>

        {estado.message ? (
          <p
            role="status"
            className={
              estado.ok
                ? 'text-success text-sm font-medium'
                : 'text-destructive text-sm font-medium'
            }
          >
            {estado.message}
          </p>
        ) : null}

        {fechamentos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum fechamento programado.</p>
        ) : (
          <ul className="space-y-2">
            {fechamentos.map((fechamento) => (
              <li
                key={fechamento.id}
                className="flex items-center justify-between gap-3 border-b pb-2"
              >
                <div>
                  <p className="font-medium">
                    {new Date(fechamento.startsAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    até{' '}
                    {new Date(fechamento.endsAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {fechamento.reason ? (
                    <p className="text-muted-foreground text-sm">{fechamento.reason}</p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removendo}
                  aria-label="Remover fechamento"
                  onClick={() =>
                    iniciarTransicao(() => excluirFeriado(fechamento.id).then(() => undefined))
                  }
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
