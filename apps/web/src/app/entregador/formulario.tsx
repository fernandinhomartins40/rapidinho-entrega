'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardContent, Input, Label } from '@rapidinho/ui';
import { VEHICLE_TYPE_LABEL } from '@rapidinho/shared';
import { cadastrarEntregador } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function FormularioDeEntregador({
  cidades,
}: {
  cidades: { id: string; name: string; state: string }[];
}) {
  const [estado, acao, pendente] = useActionState(cadastrarEntregador, ACTION_IDLE);
  const [veiculo, setVeiculo] = useState('MOTORCYCLE');

  if (estado.ok) {
    return (
      <Card className="border-success mt-6">
        <CardContent className="pt-6">
          <p className="text-success font-bold">Tudo certo!</p>
          <p className="mt-2 leading-relaxed">{estado.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={acao} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="nome" required>
          Nome completo
        </Label>
        <Input id="nome" name="nome" required error={estado.fieldErrors?.nome} />
      </div>

      <div>
        <Label htmlFor="telefone" required>
          WhatsApp
        </Label>
        <Input
          id="telefone"
          name="telefone"
          inputMode="tel"
          placeholder="(44) 99999-0000"
          required
          error={estado.fieldErrors?.telefone}
        />
      </div>

      <div>
        <Label htmlFor="documento" required>
          CPF
        </Label>
        <Input
          id="documento"
          name="documento"
          inputMode="numeric"
          required
          error={estado.fieldErrors?.documento}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cityId" required>
            Cidade
          </Label>
          <select
            id="cityId"
            name="cityId"
            required
            className="border-input min-h-touch w-full rounded-lg border px-3"
          >
            {cidades.map((cidade) => (
              <option key={cidade.id} value={cidade.id}>
                {cidade.name}/{cidade.state}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="veiculo" required>
            Como você entrega
          </Label>
          <select
            id="veiculo"
            name="veiculo"
            value={veiculo}
            onChange={(evento) => setVeiculo(evento.target.value)}
            className="border-input min-h-touch w-full rounded-lg border px-3"
          >
            {Object.entries(VEHICLE_TYPE_LABEL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Placa só faz sentido para veículo motorizado. */}
      {veiculo === 'MOTORCYCLE' || veiculo === 'CAR' ? (
        <div>
          <Label htmlFor="placa">Placa</Label>
          <Input id="placa" name="placa" placeholder="ABC1D23" className="uppercase" />
        </div>
      ) : null}

      <div>
        <Label htmlFor="pixKey">Sua chave Pix (para receber)</Label>
        <Input id="pixKey" name="pixKey" placeholder="Telefone, CPF, e-mail ou chave aleatória" />
      </div>

      {estado.message && !estado.ok ? (
        <p role="alert" className="text-destructive font-medium">
          {estado.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" block disabled={pendente}>
        {pendente ? 'Enviando…' : 'Quero ser entregador'}
      </Button>
    </form>
  );
}
