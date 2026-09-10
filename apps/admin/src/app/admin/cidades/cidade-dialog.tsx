'use client';

import { useActionState, useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@rapidinho/ui';
import { atualizarCidade, criarCidade } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export interface CidadeFormData {
  id: string;
  name: string;
  state: string;
  ibgeCode: string | null;
  isActive: boolean;
  latitude: number | null;
  longitude: number | null;
  serviceRadiusMeters: number;
  defaultCommissionRate: number;
  defaultDeliveryFeeCents: number;
  defaultPricePerKmCents: number;
}

/** Formata centavos para o input de texto ("1250" → "12,50"). */
function paraReais(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function CidadeDialog({ cidade }: { cidade?: CidadeFormData }) {
  const editando = cidade != null;
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(
    editando ? atualizarCidade : criarCidade,
    ACTION_IDLE,
  );

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {editando ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${cidade.name}`}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="h-5 w-5" aria-hidden />
            Nova cidade
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? `Editar ${cidade.name}` : 'Nova cidade'}</DialogTitle>
          <DialogDescription>
            As taxas aqui são o padrão sugerido para lojas novas. Cada loja pode ajustar a sua.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          {editando ? <input type="hidden" name="id" value={cidade.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-[1fr_6rem]">
            <div>
              <Label htmlFor="name" required>
                Nome
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={cidade?.name}
                placeholder="Palmital"
                error={state.fieldErrors?.name}
                required
              />
            </div>
            <div>
              <Label htmlFor="state" required>
                UF
              </Label>
              <Input
                id="state"
                name="state"
                maxLength={2}
                defaultValue={cidade?.state}
                placeholder="PR"
                className="uppercase"
                error={state.fieldErrors?.state}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                name="latitude"
                inputMode="decimal"
                defaultValue={cidade?.latitude ?? ''}
                placeholder="-24.8886"
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                name="longitude"
                inputMode="decimal"
                defaultValue={cidade?.longitude ?? ''}
                placeholder="-52.2094"
              />
            </div>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            As coordenadas do centro habilitam a taxa por distância e a detecção da cidade.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="serviceRadiusKm">Raio de atendimento (km)</Label>
              <Input
                id="serviceRadiusKm"
                name="serviceRadiusKm"
                inputMode="decimal"
                defaultValue={cidade ? cidade.serviceRadiusMeters / 1000 : 15}
              />
            </div>
            <div>
              <Label htmlFor="defaultCommissionRate">Comissão padrão (%)</Label>
              <Input
                id="defaultCommissionRate"
                name="defaultCommissionRate"
                inputMode="decimal"
                defaultValue={cidade?.defaultCommissionRate ?? 10}
                error={state.fieldErrors?.defaultCommissionRate}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="defaultDeliveryFee">Taxa de entrega sugerida</Label>
              <Input
                id="defaultDeliveryFee"
                name="defaultDeliveryFee"
                inputMode="decimal"
                defaultValue={paraReais(cidade?.defaultDeliveryFeeCents ?? 500)}
              />
            </div>
            <div>
              <Label htmlFor="defaultPricePerKm">Preço por km sugerido</Label>
              <Input
                id="defaultPricePerKm"
                name="defaultPricePerKm"
                inputMode="decimal"
                defaultValue={paraReais(cidade?.defaultPricePerKmCents ?? 150)}
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={cidade?.isActive ?? false}
              className="accent-primary h-5 w-5"
            />
            <span className="text-sm font-medium">Abrir para pedidos</span>
          </label>

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={enviando}>
              {editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
