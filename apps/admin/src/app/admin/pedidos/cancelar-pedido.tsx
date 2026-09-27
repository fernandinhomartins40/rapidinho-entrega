'use client';

import { useActionState, useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';
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
  Label,
  Textarea,
} from '@rapidinho/ui';
import { ACTION_IDLE } from '@/lib/action-state';
import { cancelarPedidoPelaPlataforma } from './actions';

export function CancelarPedido({ pedido }: { pedido: { id: string; numero: string } }) {
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(cancelarPedidoPelaPlataforma, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <XCircle className="h-5 w-5" aria-hidden />
          Cancelar pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar o pedido #{pedido.numero}?</DialogTitle>
          <DialogDescription>
            A loja, o cliente e o entregador são avisados na hora. O motivo vai para o cliente e
            fica registrado na auditoria. Não dá para desfazer.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          <input type="hidden" name="orderId" value={pedido.id} />

          <div>
            <Label htmlFor="reason" required>
              Motivo do cancelamento
            </Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Ex.: loja não respondeu e o cliente pediu o cancelamento"
              error={state.fieldErrors?.reason}
              required
            />
          </div>

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button type="submit" variant="destructive" isLoading={enviando}>
              Cancelar pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
