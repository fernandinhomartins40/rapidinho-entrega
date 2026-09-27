'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { RotateCcw, Store } from 'lucide-react';
import { formatCents } from '@rapidinho/shared';
import { pedirNovamente } from '@/app/pedidos/actions';

export interface PedidoParaRepetir {
  id: string;
  loja: string;
  imagem: string | null;
  resumo: string;
  totalCents: number;
}

/**
 * "Peça de novo" na vitrine: os últimos pedidos entregues, um toque e os
 * mesmos itens voltam ao carrinho. No interior se pede sempre do mesmo lugar —
 * ir até "Pedidos", rolar e achar era o caminho mais longo para o pedido mais
 * comum.
 */
export function PecaDeNovo({ pedidos }: { pedidos: PedidoParaRepetir[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function repetir(id: string) {
    setErro(null);
    setEmAndamento(id);
    iniciar(async () => {
      const resultado = await pedirNovamente(id);
      if (resultado.ok) {
        router.push('/carrinho');
        return;
      }
      setErro(resultado.message ?? 'Não foi possível repetir este pedido.');
      setEmAndamento(null);
    });
  }

  return (
    <section aria-labelledby="peca-de-novo">
      <h2 id="peca-de-novo" className="mb-3 text-lg font-bold">
        Peça de novo
      </h2>
      <ul className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5">
        {pedidos.map((pedido) => (
          <li key={pedido.id} className="w-[78%] max-w-72 shrink-0 snap-start">
            <button
              type="button"
              onClick={() => repetir(pedido.id)}
              disabled={pendente}
              className="bg-card hover:border-primary flex h-full w-full flex-col gap-2 rounded-2xl border p-3 text-left transition-colors disabled:opacity-70"
            >
              <span className="flex items-center gap-2.5">
                {pedido.imagem ? (
                  <Image
                    src={pedido.imagem}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="bg-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Store className="h-4 w-4" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate font-semibold">{pedido.loja}</span>
              </span>
              <span className="text-muted-foreground line-clamp-2 text-sm">{pedido.resumo}</span>
              <span className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="text-sm font-semibold">{formatCents(pedido.totalCents)}</span>
                <span className="text-primary-text inline-flex items-center gap-1 text-sm font-bold">
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  {emAndamento === pedido.id ? 'Adicionando…' : 'Repetir'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {erro ? (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
