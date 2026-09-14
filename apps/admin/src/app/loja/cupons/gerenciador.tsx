'use client';

import { useActionState, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
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
import { formatCents } from '@rapidinho/shared';
import { alternarCupom, salvarCupom } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Cupom {
  id: string;
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minOrderCents: number;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  usageCount: number;
  firstOrderOnly: boolean;
  endsAt: string | null;
  isActive: boolean;
}

function descreverDesconto(cupom: Cupom): string {
  if (cupom.discountType === 'FREE_DELIVERY') return 'Entrega grátis';
  if (cupom.discountType === 'PERCENTAGE') {
    const teto = cupom.maxDiscountCents ? ` (até ${formatCents(cupom.maxDiscountCents)})` : '';
    return `${cupom.discountValue}% de desconto${teto}`;
  }
  return `${formatCents(cupom.discountValue)} de desconto`;
}

export function GerenciadorDeCupons({ cupons }: { cupons: Cupom[] }) {
  const [estado, acao, pendente] = useActionState(salvarCupom, ACTION_IDLE);
  const [tipo, setTipo] = useState('PERCENTAGE');
  const [alterando, iniciarTransicao] = useTransition();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Novo cupom</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={acao} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  name="code"
                  required
                  placeholder="Ex.: BEMVINDO10"
                  className="uppercase"
                  error={estado.fieldErrors?.code}
                />
              </div>
              <div>
                <Label htmlFor="discountType">Tipo</Label>
                <select
                  id="discountType"
                  name="discountType"
                  value={tipo}
                  onChange={(evento) => setTipo(evento.target.value)}
                  className="border-input min-h-touch w-full rounded-lg border px-3"
                >
                  <option value="PERCENTAGE">Percentual</option>
                  <option value="FIXED_AMOUNT">Valor fixo</option>
                  <option value="FREE_DELIVERY">Entrega grátis</option>
                </select>
              </div>

              {tipo !== 'FREE_DELIVERY' ? (
                <div>
                  <Label htmlFor="discountValue">
                    {tipo === 'PERCENTAGE' ? 'Percentual (%)' : 'Valor do desconto'}
                  </Label>
                  <Input
                    id="discountValue"
                    name="discountValue"
                    inputMode="decimal"
                    placeholder={tipo === 'PERCENTAGE' ? '10' : '5,00'}
                    error={estado.fieldErrors?.discountValue}
                  />
                </div>
              ) : (
                <input type="hidden" name="discountValue" value="0" />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <Label htmlFor="minOrderCents">Pedido mínimo</Label>
                <Input
                  id="minOrderCents"
                  name="minOrderCents"
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </div>
              {tipo === 'PERCENTAGE' ? (
                <div>
                  <Label htmlFor="maxDiscountCents">Desconto máximo</Label>
                  <Input
                    id="maxDiscountCents"
                    name="maxDiscountCents"
                    inputMode="decimal"
                    placeholder="Opcional"
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="usageLimit">Limite de usos</Label>
                <Input
                  id="usageLimit"
                  name="usageLimit"
                  type="number"
                  min={1}
                  placeholder="Sem limite"
                />
              </div>
              <div>
                <Label htmlFor="endsAt">Válido até</Label>
                <Input id="endsAt" name="endsAt" type="date" />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input id="description" name="description" placeholder="Aparece para o cliente" />
            </div>

            <SwitchField
              name="firstOrderOnly"
              label="Só para quem nunca pediu na minha loja"
              description="Bom para atrair cliente novo sem dar desconto a quem já compra."
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={pendente}>
                <Plus className="h-5 w-5" aria-hidden />
                {pendente ? 'Criando…' : 'Criar cupom'}
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

      {cupons.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6">
            Nenhum cupom criado ainda.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {cupons.map((cupom) => {
            const expirado = cupom.endsAt != null && new Date(cupom.endsAt) < new Date();
            const esgotado = cupom.usageLimit != null && cupom.usageCount >= cupom.usageLimit;

            return (
              <li key={cupom.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="font-mono text-lg font-bold">{cupom.code}</p>
                      <p className="text-muted-foreground text-sm">
                        {descreverDesconto(cupom)}
                        {cupom.minOrderCents > 0
                          ? ` · mínimo ${formatCents(cupom.minOrderCents)}`
                          : ''}
                        {' · '}
                        {cupom.usageCount} uso(s)
                        {cupom.usageLimit ? ` de ${cupom.usageLimit}` : ''}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {cupom.firstOrderOnly ? (
                          <Badge variant="secondary">Primeira compra</Badge>
                        ) : null}
                        {expirado ? <Badge variant="warning">Expirado</Badge> : null}
                        {esgotado ? <Badge variant="warning">Esgotado</Badge> : null}
                        {!cupom.isActive ? <Badge variant="secondary">Desativado</Badge> : null}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      disabled={alterando}
                      onClick={() =>
                        iniciarTransicao(() =>
                          alternarCupom(cupom.id, !cupom.isActive).then(() => undefined),
                        )
                      }
                    >
                      {cupom.isActive ? 'Desativar' : 'Ativar'}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
