'use client';

import { useActionState, useTransition } from 'react';
import { UserPlus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@rapidinho/ui';
import { maskPhoneBR, VEHICLE_TYPE_LABEL, whatsappLink } from '@rapidinho/shared';
import { alternarEntregador, convidarEntregador } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Entregador {
  id: string;
  nome: string | null;
  telefone: string | null;
  status: string;
  veiculo: string;
  online: boolean;
  entregas: number;
  nota: number;
}

export function EquipeDeEntregadores({
  entregadores,
  podeEditar,
}: {
  entregadores: Entregador[];
  podeEditar: boolean;
}) {
  const [estado, acao, pendente] = useActionState(convidarEntregador, ACTION_IDLE);
  const [alterando, iniciarTransicao] = useTransition();

  return (
    <div className="space-y-6">
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle>Adicionar entregador</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={acao} className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Ele entra com o próprio telefone, pelo mesmo código que você usa. Não precisa criar
                senha.
              </p>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" required error={estado.fieldErrors?.name} />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    inputMode="tel"
                    required
                    placeholder="(44) 99999-0000"
                    error={estado.fieldErrors?.phone}
                  />
                </div>
                <div>
                  <Label htmlFor="document">CPF</Label>
                  <Input
                    id="document"
                    name="document"
                    inputMode="numeric"
                    required
                    placeholder="000.000.000-00"
                    error={estado.fieldErrors?.document}
                  />
                </div>
                <div>
                  <Label htmlFor="vehicleType">Veículo</Label>
                  <select
                    id="vehicleType"
                    name="vehicleType"
                    className="border-input min-h-touch w-full rounded-lg border px-3"
                    defaultValue="MOTORCYCLE"
                  >
                    {Object.entries(VEHICLE_TYPE_LABEL).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>
                        {rotulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={pendente}>
                  <UserPlus className="h-5 w-5" aria-hidden />
                  {pendente ? 'Adicionando…' : 'Adicionar'}
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
      ) : null}

      {entregadores.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6">
            Nenhum entregador próprio. Seus pedidos podem ser atendidos pela frota da plataforma.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {entregadores.map((entregador) => (
            <li key={entregador.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {entregador.nome ?? 'Sem nome'}
                      {entregador.online ? (
                        <Badge variant="success" className="ml-2">
                          Online
                        </Badge>
                      ) : null}
                      {entregador.status !== 'ACTIVE' ? (
                        <Badge variant="warning" className="ml-2">
                          Suspenso
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {VEHICLE_TYPE_LABEL[entregador.veiculo as keyof typeof VEHICLE_TYPE_LABEL]} ·{' '}
                      {entregador.entregas} entregas
                      {entregador.nota > 0 ? ` · nota ${entregador.nota.toFixed(1)}` : ''}
                    </p>
                    {entregador.telefone ? (
                      <a
                        href={whatsappLink(entregador.telefone)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm underline"
                      >
                        {maskPhoneBR(entregador.telefone)}
                      </a>
                    ) : null}
                  </div>

                  {podeEditar ? (
                    <Button
                      variant="outline"
                      disabled={alterando}
                      onClick={() =>
                        iniciarTransicao(() =>
                          alternarEntregador(entregador.id, entregador.status !== 'ACTIVE').then(
                            () => undefined,
                          ),
                        )
                      }
                    >
                      {entregador.status === 'ACTIVE' ? 'Suspender' : 'Reativar'}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
