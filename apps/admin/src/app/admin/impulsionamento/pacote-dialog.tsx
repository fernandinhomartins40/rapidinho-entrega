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
  Select,
} from '@rapidinho/ui';
import { BOOST_PLACEMENT_LABEL } from '@rapidinho/shared';
import { salvarPacote } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export interface PacoteFormData {
  id: string;
  name: string;
  description: string | null;
  placement: keyof typeof BOOST_PLACEMENT_LABEL;
  priceCents: number;
  durationDays: number;
  priority: number;
  isActive: boolean;
}

export function PacoteDialog({ pacote }: { pacote?: PacoteFormData }) {
  const editando = pacote != null;
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(salvarPacote, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {editando ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${pacote.name}`}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="h-5 w-5" aria-hidden />
            Novo pacote
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? `Editar ${pacote.name}` : 'Novo pacote'}</DialogTitle>
          <DialogDescription>
            A prioridade decide a ordem entre lojas impulsionadas na mesma posição — maior aparece
            antes.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          {editando ? <input type="hidden" name="id" value={pacote.id} /> : null}

          <div>
            <Label htmlFor="name" required>
              Nome
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={pacote?.name}
              placeholder="Destaque na home — 7 dias"
              error={state.fieldErrors?.name}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição para o lojista</Label>
            <Input
              id="description"
              name="description"
              defaultValue={pacote?.description ?? ''}
              placeholder="Sua loja entre as primeiras da página inicial"
            />
          </div>

          <div>
            <Label htmlFor="placement" required>
              Posição
            </Label>
            <Select
              id="placement"
              name="placement"
              defaultValue={pacote?.placement ?? 'HOME_HIGHLIGHT'}
            >
              {Object.entries(BOOST_PLACEMENT_LABEL).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="price" required>
                Preço
              </Label>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={pacote ? (pacote.priceCents / 100).toFixed(2).replace('.', ',') : ''}
                placeholder="39,90"
                required
              />
            </div>
            <div>
              <Label htmlFor="durationDays" required>
                Duração (dias)
              </Label>
              <Input
                id="durationDays"
                name="durationDays"
                inputMode="numeric"
                defaultValue={pacote?.durationDays ?? 7}
                required
              />
            </div>
            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Input
                id="priority"
                name="priority"
                inputMode="numeric"
                defaultValue={pacote?.priority ?? 0}
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={pacote?.isActive ?? true}
              className="accent-primary h-5 w-5"
            />
            <span className="text-sm font-medium">Disponível para compra</span>
          </label>

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={enviando}>
              {editando ? 'Salvar' : 'Criar pacote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
