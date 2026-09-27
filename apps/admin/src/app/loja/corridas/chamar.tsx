'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Bike } from 'lucide-react';
import { Alert, Button, Card, CardContent, Input, Label, Textarea } from '@rapidinho/ui';
import { ACTION_IDLE } from '@/lib/action-state';
import { chamarEntregador } from './actions';

function reais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export function ChamarEntregador({ valorSugeridoCents }: { valorSugeridoCents: number }) {
  const [estado, enviar, enviando] = useActionState(chamarEntregador, ACTION_IDLE);
  const formulario = useRef<HTMLFormElement>(null);

  // Corrida chamada: limpa o formulário para a próxima, mantendo o valor.
  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  const erro = (campo: string) => estado.fieldErrors?.[campo];

  return (
    <Card>
      <CardContent className="pt-6">
        <form ref={formulario} action={enviar} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="customerName" required>
                Quem recebe
              </Label>
              <Input id="customerName" name="customerName" error={erro('customerName')} />
            </div>
            <div>
              <Label htmlFor="customerPhone">Telefone (opcional)</Label>
              <Input
                id="customerPhone"
                name="customerPhone"
                inputMode="tel"
                error={erro('customerPhone')}
              />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <div>
              <Label htmlFor="street" required>
                Rua
              </Label>
              <Input id="street" name="street" error={erro('street')} />
            </div>
            <div>
              <Label htmlFor="number">Número</Label>
              <Input id="number" name="number" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="neighborhood" required>
                Bairro
              </Label>
              <Input id="neighborhood" name="neighborhood" error={erro('neighborhood')} />
            </div>
            <div>
              <Label htmlFor="referencePoint">Ponto de referência</Label>
              <Input id="referencePoint" name="referencePoint" placeholder="Ex.: casa amarela" />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Recado para o entregador</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Ex.: 2 sacolas e um fardo de água; tocar a campainha"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="fee" required>
                Você paga ao entregador (R$)
              </Label>
              <Input
                id="fee"
                name="fee"
                inputMode="decimal"
                defaultValue={reais(valorSugeridoCents)}
                error={erro('feeCents')}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Sugestão pela sua taxa de entrega. Aumente se for longe.
              </p>
            </div>
            <div>
              <Label htmlFor="collect">Cobrar do cliente (R$)</Label>
              <Input id="collect" name="collect" inputMode="decimal" placeholder="Opcional" />
              <p className="text-muted-foreground mt-1 text-xs">
                Se o cliente paga na entrega, o entregador cobra este valor.
              </p>
            </div>
          </div>

          {estado.message ? (
            <Alert variant={estado.ok ? 'success' : 'destructive'}>{estado.message}</Alert>
          ) : null}

          <Button type="submit" size="lg" block isLoading={enviando}>
            <Bike className="h-5 w-5" aria-hidden />
            Chamar entregador
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
