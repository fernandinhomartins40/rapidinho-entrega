'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@rapidinho/ui';
import { moderarAvaliacao } from './actions';

/** Oculta ou volta a mostrar o comentário na página pública da loja. */
export function ModerarAvaliacao({ reviewId, oculta }: { reviewId: string; oculta: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const resultado = await moderarAvaliacao({ reviewId, ocultar: !oculta });
            if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível concluir.');
          })
        }
      >
        {oculta ? (
          <Eye className="h-4 w-4" aria-hidden />
        ) : (
          <EyeOff className="h-4 w-4" aria-hidden />
        )}
        {oculta ? 'Mostrar de novo na loja' : 'Ocultar comentário (ofensa)'}
      </Button>
      {erro ? <span className="text-destructive text-sm">{erro}</span> : null}
    </div>
  );
}
