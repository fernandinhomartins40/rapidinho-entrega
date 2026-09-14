'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label, SwitchField } from '@rapidinho/ui';
import { salvarEndereco } from '../actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Cidade {
  id: string;
  name: string;
  state: string;
  neighborhoods: { id: string; name: string }[];
}

export function FormularioDeEndereco({
  cidades,
  cidadePadrao,
  voltar,
}: {
  cidades: Cidade[];
  cidadePadrao: string;
  voltar: string;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(salvarEndereco, ACTION_IDLE);
  const [cidadeId, setCidadeId] = useState(cidadePadrao);

  useEffect(() => {
    if (estado.ok) router.push(voltar);
  }, [estado.ok, router, voltar]);

  const bairros = cidades.find((cidade) => cidade.id === cidadeId)?.neighborhoods ?? [];

  return (
    <form action={acao} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="cityId">Cidade</Label>
        <select
          id="cityId"
          name="cityId"
          value={cidadeId}
          onChange={(evento) => setCidadeId(evento.target.value)}
          className="border-input min-h-touch w-full rounded-lg border px-3"
          required
        >
          {cidades.map((cidade) => (
            <option key={cidade.id} value={cidade.id}>
              {cidade.name}/{cidade.state}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="street">Rua</Label>
        <Input id="street" name="street" required error={estado.fieldErrors?.street} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="number">Número</Label>
          <Input id="number" name="number" placeholder="Deixe vazio se não tiver" />
        </div>
        <div>
          <Label htmlFor="complement">Complemento</Label>
          <Input id="complement" name="complement" placeholder="Casa, apto, fundos" />
        </div>
      </div>

      <div>
        <Label htmlFor="neighborhood">Bairro</Label>
        {/* Lista quando a cidade tem bairros cadastrados, texto livre quando
            não: nem toda cidade do interior tem bairro oficial mapeado. */}
        <Input
          id="neighborhood"
          name="neighborhood"
          required
          list={bairros.length > 0 ? 'bairros' : undefined}
          error={estado.fieldErrors?.neighborhood}
        />
        {bairros.length > 0 ? (
          <datalist id="bairros">
            {bairros.map((bairro) => (
              <option key={bairro.id} value={bairro.name} />
            ))}
          </datalist>
        ) : null}
      </div>

      <div>
        <Label htmlFor="referencePoint" required>
          Ponto de referência
        </Label>
        <Input
          id="referencePoint"
          name="referencePoint"
          required
          placeholder="Ex.: portão verde, em frente à igreja"
          error={estado.fieldErrors?.referencePoint}
        />
        <p className="text-muted-foreground mt-1 text-sm">
          É o que o entregador vai usar para achar você.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="zipCode">CEP</Label>
          <Input
            id="zipCode"
            name="zipCode"
            inputMode="numeric"
            placeholder="Opcional"
            error={estado.fieldErrors?.zipCode}
          />
        </div>
        <div>
          <Label htmlFor="label">Apelido</Label>
          <Input id="label" name="label" placeholder="Casa, Trabalho" />
        </div>
      </div>

      <SwitchField name="isDefault" label="Usar como endereço principal" />

      {estado.message && !estado.ok ? (
        <p role="alert" className="text-destructive font-medium">
          {estado.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" block disabled={pendente}>
        {pendente ? 'Salvando…' : 'Salvar endereço'}
      </Button>
    </form>
  );
}
