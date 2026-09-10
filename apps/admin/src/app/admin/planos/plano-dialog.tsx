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
  Textarea,
} from '@rapidinho/ui';
import { atualizarPlano, criarPlano } from './actions';
import { RECURSOS_DO_PLANO } from './recursos';
import { ACTION_IDLE } from '@/lib/action-state';

export interface PlanoFormData {
  id: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  commissionRate: number;
  maxProducts: number | null;
  maxPhotos: number | null;
  maxStaff: number | null;
  features: Record<string, boolean>;
  trialDays: number;
  isActive: boolean;
  isDefault: boolean;
}

function paraReais(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function PlanoDialog({ plano }: { plano?: PlanoFormData }) {
  const editando = plano != null;
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(
    editando ? atualizarPlano : criarPlano,
    ACTION_IDLE,
  );

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {editando ? (
          <Button variant="outline" size="sm" className="flex-1">
            <Pencil className="h-4 w-4" aria-hidden />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus className="h-5 w-5" aria-hidden />
            Novo plano
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? `Editar ${plano.name}` : 'Novo plano'}</DialogTitle>
          <DialogDescription>
            Limites em branco significam ilimitado. A comissão vale para os pedidos feitos depois da
            alteração.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          {editando ? <input type="hidden" name="id" value={plano.id} /> : null}

          <div>
            <Label htmlFor="name" required>
              Nome do plano
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={plano?.name}
              placeholder="Essencial"
              error={state.fieldErrors?.name}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={plano?.description ?? ''}
              placeholder="O que este plano entrega, na linguagem do lojista"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="monthlyPrice">Mensalidade</Label>
              <Input
                id="monthlyPrice"
                name="monthlyPrice"
                inputMode="decimal"
                defaultValue={paraReais(plano?.monthlyPriceCents ?? 0)}
              />
            </div>
            <div>
              <Label htmlFor="commissionRate" required>
                Comissão (%)
              </Label>
              <Input
                id="commissionRate"
                name="commissionRate"
                inputMode="decimal"
                defaultValue={plano?.commissionRate ?? 10}
                error={state.fieldErrors?.commissionRate}
                required
              />
            </div>
            <div>
              <Label htmlFor="trialDays">Dias grátis</Label>
              <Input
                id="trialDays"
                name="trialDays"
                inputMode="numeric"
                defaultValue={plano?.trialDays ?? 0}
              />
            </div>
          </div>

          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold">Limites</legend>
            <div>
              <Label htmlFor="maxProducts">Produtos</Label>
              <Input
                id="maxProducts"
                name="maxProducts"
                inputMode="numeric"
                defaultValue={plano?.maxProducts ?? ''}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <Label htmlFor="maxPhotos">Fotos</Label>
              <Input
                id="maxPhotos"
                name="maxPhotos"
                inputMode="numeric"
                defaultValue={plano?.maxPhotos ?? ''}
                placeholder="Ilimitado"
              />
            </div>
            <div>
              <Label htmlFor="maxStaff">Pessoas na equipe</Label>
              <Input
                id="maxStaff"
                name="maxStaff"
                inputMode="numeric"
                defaultValue={plano?.maxStaff ?? ''}
                placeholder="Ilimitado"
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Recursos liberados</legend>
            <div className="space-y-2">
              {RECURSOS_DO_PLANO.map((recurso) => (
                <label key={recurso.chave} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name={`feature_${recurso.chave}`}
                    defaultChecked={plano?.features[recurso.chave] ?? false}
                    className="accent-primary h-5 w-5"
                  />
                  <span className="text-sm">{recurso.rotulo}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2 border-t pt-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={plano?.isActive ?? true}
                className="accent-primary h-5 w-5"
              />
              <span className="text-sm font-medium">Disponível para contratação</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isDefault"
                defaultChecked={plano?.isDefault ?? false}
                className="accent-primary h-5 w-5"
              />
              <span className="text-sm font-medium">
                Plano padrão de loja nova
                <span className="text-muted-foreground block text-xs font-normal">
                  Marcar aqui desmarca o plano padrão atual.
                </span>
              </span>
            </label>
          </div>

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={enviando}>
              {editando ? 'Salvar plano' : 'Criar plano'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
