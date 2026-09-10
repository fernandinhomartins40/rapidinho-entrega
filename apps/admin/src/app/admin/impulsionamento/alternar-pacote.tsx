'use client';

import { useActionState } from 'react';
import { Power, PowerOff } from 'lucide-react';
import { Button } from '@rapidinho/ui';
import { alternarPacote } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function AlternarPacote({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  const [, enviar, enviando] = useActionState(alternarPacote, ACTION_IDLE);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={enviando}
        aria-label={ativo ? `Retirar ${nome} da vitrine` : `Voltar ${nome} para a vitrine`}
      >
        {ativo ? (
          <PowerOff className="h-4 w-4" aria-hidden />
        ) : (
          <Power className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </form>
  );
}
