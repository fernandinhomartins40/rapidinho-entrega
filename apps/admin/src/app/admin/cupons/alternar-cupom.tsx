'use client';

import { useActionState } from 'react';
import { Power, PowerOff } from 'lucide-react';
import { Button } from '@rapidinho/ui';
import { alternarCupom } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function AlternarCupom({
  id,
  codigo,
  ativo,
}: {
  id: string;
  codigo: string;
  ativo: boolean;
}) {
  const [, enviar, enviando] = useActionState(alternarCupom, ACTION_IDLE);

  return (
    <form action={enviar}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={enviando}
        aria-label={ativo ? `Desativar cupom ${codigo}` : `Reativar cupom ${codigo}`}
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
