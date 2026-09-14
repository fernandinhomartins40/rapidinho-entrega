'use client';

import { useActionState, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  SwitchField,
} from '@rapidinho/ui';
import { centsToInput, DELIVERY_FEE_MODE_LABEL, formatCents } from '@rapidinho/shared';
import { excluirZona, salvarRegrasDeEntrega, salvarZona } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

type Modo = 'FIXED' | 'BY_DISTANCE' | 'BY_ZONE' | 'FREE';

interface Loja {
  deliveryFeeMode: string;
  deliveryFeeCents: number;
  pricePerKmCents: number;
  freeDeliveryAboveCents: number | null;
  deliveryRadiusMeters: number;
  minOrderCents: number;
  avgPrepTimeMinutes: number;
  avgDeliveryTimeMinutes: number;
  acceptsPickup: boolean;
}

interface Zona {
  id: string;
  name: string;
  feeCents: number;
  minOrderCents: number | null;
  estimatedMinutes: number | null;
}

const EXPLICACAO: Record<Modo, string> = {
  FIXED: 'Todo mundo paga o mesmo valor, não importa a distância. É o mais comum.',
  BY_DISTANCE:
    'O valor cresce conforme a distância. Precisa do endereço com localização — sem ela, cobramos a taxa fixa abaixo.',
  BY_ZONE: 'Cada bairro tem seu preço. Bairro não cadastrado paga a taxa fixa abaixo.',
  FREE: 'Você não cobra entrega.',
};

export function EditorDeEntrega({ loja, zonas }: { loja: Loja; zonas: Zona[] }) {
  const [estado, acao, pendente] = useActionState(salvarRegrasDeEntrega, ACTION_IDLE);
  const [modo, setModo] = useState<Modo>(loja.deliveryFeeMode as Modo);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Como você cobra a entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={acao} className="space-y-5">
            <input type="hidden" name="deliveryFeeMode" value={modo} />

            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(EXPLICACAO) as Modo[]).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setModo(opcao)}
                  aria-pressed={modo === opcao}
                  className={`min-h-touch rounded-xl border-2 p-4 text-left transition-colors ${
                    modo === opcao
                      ? 'border-primary bg-accent'
                      : 'border-input hover:border-primary'
                  }`}
                >
                  <span className="block font-semibold">{DELIVERY_FEE_MODE_LABEL[opcao]}</span>
                  <span className="text-muted-foreground mt-0.5 block text-sm">
                    {EXPLICACAO[opcao]}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {modo !== 'FREE' ? (
                <div>
                  <Label htmlFor="deliveryFeeCents">
                    {modo === 'FIXED'
                      ? 'Taxa de entrega'
                      : 'Taxa base (quando não dá para calcular)'}
                  </Label>
                  <Input
                    id="deliveryFeeCents"
                    name="deliveryFeeCents"
                    inputMode="decimal"
                    defaultValue={centsToInput(loja.deliveryFeeCents)}
                  />
                </div>
              ) : null}

              {modo === 'BY_DISTANCE' ? (
                <div>
                  <Label htmlFor="pricePerKmCents">Preço por quilômetro</Label>
                  <Input
                    id="pricePerKmCents"
                    name="pricePerKmCents"
                    inputMode="decimal"
                    defaultValue={centsToInput(loja.pricePerKmCents)}
                    error={estado.fieldErrors?.pricePerKmCents}
                  />
                </div>
              ) : (
                <input
                  type="hidden"
                  name="pricePerKmCents"
                  value={centsToInput(loja.pricePerKmCents)}
                />
              )}

              <div>
                <Label htmlFor="freeDeliveryAboveCents">Entrega grátis acima de</Label>
                <Input
                  id="freeDeliveryAboveCents"
                  name="freeDeliveryAboveCents"
                  inputMode="decimal"
                  defaultValue={
                    loja.freeDeliveryAboveCents ? centsToInput(loja.freeDeliveryAboveCents) : ''
                  }
                  placeholder="Deixe vazio para não oferecer"
                />
              </div>

              <div>
                <Label htmlFor="minOrderCents">Pedido mínimo</Label>
                <Input
                  id="minOrderCents"
                  name="minOrderCents"
                  inputMode="decimal"
                  defaultValue={centsToInput(loja.minOrderCents)}
                />
              </div>

              <div>
                <Label htmlFor="deliveryRadiusKm">Entrega até quantos km</Label>
                <Input
                  id="deliveryRadiusKm"
                  name="deliveryRadiusKm"
                  type="number"
                  min={0.1}
                  step={0.5}
                  defaultValue={loja.deliveryRadiusMeters / 1000}
                />
              </div>

              <div>
                <Label htmlFor="avgPrepTimeMinutes">Tempo de preparo (min)</Label>
                <Input
                  id="avgPrepTimeMinutes"
                  name="avgPrepTimeMinutes"
                  type="number"
                  min={1}
                  defaultValue={loja.avgPrepTimeMinutes}
                />
              </div>

              <div>
                <Label htmlFor="avgDeliveryTimeMinutes">Tempo de entrega (min)</Label>
                <Input
                  id="avgDeliveryTimeMinutes"
                  name="avgDeliveryTimeMinutes"
                  type="number"
                  min={1}
                  defaultValue={loja.avgDeliveryTimeMinutes}
                />
              </div>
            </div>

            <SwitchField
              name="acceptsPickup"
              defaultChecked={loja.acceptsPickup}
              label="Aceito que o cliente retire na loja"
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={pendente}>
                {pendente ? 'Salvando…' : 'Salvar'}
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

      {modo === 'BY_ZONE' ? <Zonas zonas={zonas} /> : null}
    </div>
  );
}

function Zonas({ zonas }: { zonas: Zona[] }) {
  const [estado, acao, pendente] = useActionState(salvarZona, ACTION_IDLE);
  const [removendo, iniciarTransicao] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preço por bairro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={acao} className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <Label htmlFor="name">Bairro</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Ex.: Centro"
              error={estado.fieldErrors?.name}
            />
          </div>
          <div className="w-32">
            <Label htmlFor="feeCents">Taxa</Label>
            <Input id="feeCents" name="feeCents" inputMode="decimal" placeholder="0,00" />
          </div>
          <div className="w-36">
            <Label htmlFor="minOrderCents">Pedido mínimo</Label>
            <Input
              id="minOrderCents"
              name="minOrderCents"
              inputMode="decimal"
              placeholder="Opcional"
            />
          </div>
          <div className="w-28">
            <Label htmlFor="estimatedMinutes">Minutos</Label>
            <Input
              id="estimatedMinutes"
              name="estimatedMinutes"
              type="number"
              min={1}
              placeholder="Opcional"
            />
          </div>
          <Button type="submit" disabled={pendente}>
            <Plus className="h-5 w-5" aria-hidden />
            Adicionar
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

        {zonas.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum bairro cadastrado. Enquanto isso, todos pagam a taxa base.
          </p>
        ) : (
          <ul className="space-y-2">
            {zonas.map((zona) => (
              <li key={zona.id} className="flex items-center justify-between gap-3 border-b pb-2">
                <div>
                  <p className="font-medium">{zona.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatCents(zona.feeCents)}
                    {zona.minOrderCents ? ` · mínimo ${formatCents(zona.minOrderCents)}` : ''}
                    {zona.estimatedMinutes ? ` · ${zona.estimatedMinutes} min` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removendo}
                  aria-label={`Remover ${zona.name}`}
                  onClick={() => iniciarTransicao(() => excluirZona(zona.id).then(() => undefined))}
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
