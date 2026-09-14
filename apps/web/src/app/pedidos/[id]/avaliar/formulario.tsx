'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button, Card, CardContent, Input, cn } from '@rapidinho/ui';
import { avaliarPedido } from '../../actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function FormularioDeAvaliacao({
  orderId,
  lojaNome,
  entregadorNome,
}: {
  orderId: string;
  lojaNome: string;
  entregadorNome: string | null;
}) {
  const router = useRouter();
  const [estado, acao, pendente] = useActionState(avaliarPedido, ACTION_IDLE);
  const [notaLoja, setNotaLoja] = useState(0);
  const [notaEntregador, setNotaEntregador] = useState(0);

  if (estado.ok) {
    // Volta para o pedido depois de avaliar: a tela de avaliação não tem mais
    // nada a oferecer.
    router.replace(`/pedidos/${orderId}`);
  }

  return (
    <form action={acao} className="mt-6 space-y-5">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="storeRating" value={notaLoja || ''} />
      <input type="hidden" name="courierRating" value={notaEntregador || ''} />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <p className="font-semibold">{lojaNome}</p>
          <Estrelas nota={notaLoja} onEscolher={setNotaLoja} rotulo={`Nota para ${lojaNome}`} />
          <Input
            name="storeComment"
            placeholder="Quer contar o que achou? (opcional)"
            maxLength={1000}
          />
        </CardContent>
      </Card>

      {entregadorNome ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <p className="font-semibold">{entregadorNome}</p>
            <Estrelas
              nota={notaEntregador}
              onEscolher={setNotaEntregador}
              rotulo={`Nota para ${entregadorNome}`}
            />
            <Input
              name="courierComment"
              placeholder="Como foi a entrega? (opcional)"
              maxLength={1000}
            />
          </CardContent>
        </Card>
      ) : null}

      {estado.message && !estado.ok ? (
        <p role="alert" className="text-destructive font-medium">
          {estado.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" block disabled={pendente || (!notaLoja && !notaEntregador)}>
        {pendente ? 'Enviando…' : 'Enviar avaliação'}
      </Button>
    </form>
  );
}

function Estrelas({
  nota,
  onEscolher,
  rotulo,
}: {
  nota: number;
  onEscolher: (valor: number) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((valor) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={nota === valor}
          aria-label={`${valor} ${valor === 1 ? 'estrela' : 'estrelas'}`}
          onClick={() => onEscolher(valor)}
          className="min-h-touch min-w-touch flex items-center justify-center"
        >
          <Star
            className={cn(
              'h-9 w-9 transition-colors',
              valor <= nota ? 'fill-warning text-warning' : 'text-muted-foreground',
            )}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
