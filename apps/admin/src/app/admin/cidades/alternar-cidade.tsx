'use client';

import { useActionState, useEffect, useState } from 'react';
import { Power, PowerOff } from 'lucide-react';
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
} from '@rapidinho/ui';
import { alternarCidade } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

/**
 * Abrir ou fechar a cidade.
 *
 * Fechar tira todas as lojas do ar de uma vez, então pede confirmação — é o
 * tipo de clique que ninguém quer dar sem querer.
 */
export function AlternarCidade({
  id,
  nome,
  ativa,
  lojas,
}: {
  id: string;
  nome: string;
  ativa: boolean;
  lojas: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(alternarCidade, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={ativa ? `Fechar ${nome}` : `Abrir ${nome}`}
          className={ativa ? 'text-destructive' : 'text-success'}
        >
          {ativa ? (
            <PowerOff className="h-4 w-4" aria-hidden />
          ) : (
            <Power className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ativa ? `Fechar ${nome}?` : `Abrir ${nome} para pedidos?`}</DialogTitle>
          <DialogDescription>
            {ativa
              ? `As ${lojas} ${lojas === 1 ? 'loja sai' : 'lojas saem'} do ar imediatamente. Os cadastros continuam salvos.`
              : 'A cidade e suas lojas ativas passam a aparecer no app.'}
          </DialogDescription>
        </DialogHeader>

        {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

        <form action={enviar}>
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant={ativa ? 'destructive' : 'success'} isLoading={enviando}>
              {ativa ? 'Fechar cidade' : 'Abrir cidade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
