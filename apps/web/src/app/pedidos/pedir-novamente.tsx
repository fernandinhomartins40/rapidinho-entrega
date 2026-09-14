'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { Button } from '@rapidinho/ui';
import { pedirNovamente } from './actions';

export function PedirNovamente({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  return (
    <div className="mt-3 border-t pt-3">
      <Button
        variant="outline"
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciarTransicao(async () => {
            const resultado = await pedirNovamente(orderId);
            setErro(!resultado.ok);
            setMensagem(resultado.message ?? null);
            if (resultado.ok) router.push('/carrinho');
          })
        }
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        {pendente ? 'Adicionando…' : 'Pedir novamente'}
      </Button>

      {mensagem ? (
        <p
          role="status"
          className={erro ? 'text-destructive mt-2 text-sm' : 'text-success mt-2 text-sm'}
        >
          {mensagem}
        </p>
      ) : null}
    </div>
  );
}
