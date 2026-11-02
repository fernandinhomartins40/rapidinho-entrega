'use client';

import { useState, useTransition } from 'react';
import { Button } from '@rapidinho/ui';
import { marcarFaturaComoPaga } from './actions';

/** Dois toques: a baixa pode tirar uma loja da suspensão. */
export function BaixaDeFatura({ faturaId, loja }: { faturaId: string; loja: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (mensagem) return <span className="text-sm">{mensagem}</span>;

  if (!confirmando) {
    return (
      <Button
        size="sm"
        variant="outline"
        aria-label={`Marcar fatura de ${loja} como paga`}
        onClick={() => setConfirmando(true)}
      >
        Marcar como paga
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      isLoading={pendente}
      onClick={() =>
        iniciar(async () => {
          const resultado = await marcarFaturaComoPaga(faturaId);
          setMensagem(resultado.message ?? 'Pronto.');
        })
      }
    >
      Confirmar pagamento
    </Button>
  );
}
