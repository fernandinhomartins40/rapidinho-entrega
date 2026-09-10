'use client';

import { useActionState, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { criarCupom } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function CupomDialog({
  cidades,
}: {
  cidades: { id: string; name: string; state: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState('PERCENTAGE');
  const [state, enviar, enviando] = useActionState(criarCupom, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-5 w-5" aria-hidden />
          Novo cupom
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cupom da plataforma</DialogTitle>
          <DialogDescription>
            O desconto é custeado pela plataforma. O lojista recebe o valor cheio do pedido.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="code" required>
                Código
              </Label>
              <Input
                id="code"
                name="code"
                placeholder="BEMVINDO"
                className="font-mono uppercase"
                error={state.fieldErrors?.code}
                required
              />
            </div>
            <div>
              <Label htmlFor="cityId">Cidade</Label>
              <Select id="cityId" name="cityId" defaultValue="">
                <option value="">Todas as cidades</option>
                {cidades.map((cidade) => (
                  <option key={cidade.id} value={cidade.id}>
                    {cidade.name} — {cidade.state}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              placeholder="R$ 10 de desconto no primeiro pedido"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="discountType" required>
                Tipo de desconto
              </Label>
              <Select
                id="discountType"
                name="discountType"
                value={tipo}
                onChange={(event) => setTipo(event.target.value)}
              >
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED_AMOUNT">Valor fixo</option>
                <option value="FREE_DELIVERY">Frete grátis</option>
              </Select>
            </div>

            {tipo === 'FREE_DELIVERY' ? null : (
              <div>
                <Label htmlFor="discountValue" required>
                  {tipo === 'PERCENTAGE' ? 'Percentual (%)' : 'Valor do desconto'}
                </Label>
                <Input
                  id="discountValue"
                  name="discountValue"
                  inputMode="decimal"
                  placeholder={tipo === 'PERCENTAGE' ? '20' : '10,00'}
                  error={state.fieldErrors?.discountValue}
                  required
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="minOrder">Pedido mínimo</Label>
              <Input id="minOrder" name="minOrder" inputMode="decimal" placeholder="30,00" />
            </div>
            {tipo === 'PERCENTAGE' ? (
              <div>
                <Label htmlFor="maxDiscount">Desconto máximo</Label>
                <Input
                  id="maxDiscount"
                  name="maxDiscount"
                  inputMode="decimal"
                  placeholder="15,00"
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Sem teto, um pedido grande vira prejuízo.
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="usageLimit">Limite total de usos</Label>
              <Input
                id="usageLimit"
                name="usageLimit"
                inputMode="numeric"
                placeholder="Sem limite"
              />
            </div>
            <div>
              <Label htmlFor="usagePerUser">Usos por cliente</Label>
              <Input id="usagePerUser" name="usagePerUser" inputMode="numeric" defaultValue={1} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="startsAt">Começa em</Label>
              <Input id="startsAt" name="startsAt" type="date" />
            </div>
            <div>
              <Label htmlFor="endsAt">Termina em</Label>
              <Input id="endsAt" name="endsAt" type="date" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3">
              <input type="checkbox" name="firstOrderOnly" className="accent-primary h-5 w-5" />
              <span className="text-sm font-medium">Somente no primeiro pedido do cliente</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="accent-primary h-5 w-5"
              />
              <span className="text-sm font-medium">Ativo</span>
            </label>
          </div>

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={enviando}>
              Criar cupom
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
