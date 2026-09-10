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
import { desativarPlano } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function AlternarPlano({
  id,
  nome,
  ativo,
  assinantes,
}: {
  id: string;
  nome: string;
  ativo: boolean;
  assinantes: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(desativarPlano, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={ativo ? `Desativar ${nome}` : `Reativar ${nome}`}
        >
          {ativo ? (
            <PowerOff className="h-4 w-4" aria-hidden />
          ) : (
            <Power className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ativo ? `Desativar ${nome}?` : `Reativar ${nome}?`}</DialogTitle>
          <DialogDescription>
            {ativo
              ? `O plano some da lista de contratação. As ${assinantes} ${assinantes === 1 ? 'loja que já assina continua' : 'lojas que já assinam continuam'} nele e seguem sendo cobradas normalmente.`
              : 'O plano volta a aparecer para contratação.'}
          </DialogDescription>
        </DialogHeader>

        {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

        <form action={enviar}>
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant={ativo ? 'destructive' : 'success'} isLoading={enviando}>
              {ativo ? 'Desativar plano' : 'Reativar plano'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
