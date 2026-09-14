'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, cn } from '@rapidinho/ui';
import { formatCents, formatGrams } from '@rapidinho/shared';
import type { CarrinhoResolvido } from '@/lib/cart';
import { alterarQuantidade, esvaziarCarrinho, removerItem, salvarObservacao } from './actions';

export function ListaDoCarrinho({
  carrinho,
  cidadeSlug,
}: {
  carrinho: CarrinhoResolvido;
  cidadeSlug: string;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [observacao, setObservacao] = useState(carrinho.notes ?? '');

  const abaixoDoMinimo = carrinho.subtotalCents < carrinho.loja.minOrderCents;

  function executar(acao: () => Promise<{ ok: boolean; message?: string }>) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await acao();
      if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível concluir.');
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/${cidadeSlug}/${carrinho.loja.slug}`} className="font-bold underline">
              {carrinho.loja.nome}
            </Link>
            <p className="text-muted-foreground text-sm">
              {carrinho.itens.length} {carrinho.itens.length === 1 ? 'item' : 'itens'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Esvaziar carrinho de ${carrinho.loja.nome}`}
            disabled={pendente}
            onClick={() => executar(() => esvaziarCarrinho(carrinho.storeId))}
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <ul className="divide-y">
          {carrinho.itens.map((item) => (
            <li key={item.id} className={cn('flex gap-3 py-3', item.indisponivel && 'opacity-60')}>
              {item.imagem.url ? (
                <Image
                  src={item.imagem.url}
                  alt=""
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.nome}</p>

                {item.pizza ? (
                  <p className="text-muted-foreground text-sm">
                    {item.pizza.sabores.map((sabor) => sabor.nome).join(', ')}
                    {item.pizza.extra ? ` · ${item.pizza.extra}` : ''}
                  </p>
                ) : null}

                {item.complementos.map((complemento) => (
                  <p key={complemento.id} className="text-muted-foreground text-sm">
                    + {complemento.quantidade}× {complemento.nome}
                  </p>
                ))}

                {item.observacao ? (
                  <p className="text-muted-foreground text-sm italic">{item.observacao}</p>
                ) : null}

                {item.weightGrams ? (
                  <p className="text-muted-foreground text-sm">{formatGrams(item.weightGrams)}</p>
                ) : null}

                {item.indisponivel ? (
                  <Badge variant="warning" className="mt-1">
                    Indisponível agora
                  </Badge>
                ) : null}

                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Diminuir ${item.nome}`}
                      disabled={pendente}
                      onClick={() =>
                        executar(() =>
                          item.quantidade <= 1
                            ? removerItem(item.id)
                            : alterarQuantidade({
                                cartItemId: item.id,
                                quantity: item.quantidade - 1,
                              }),
                        )
                      }
                    >
                      {item.quantidade <= 1 ? (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      ) : (
                        <Minus className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                    <span className="w-6 text-center font-semibold">{item.quantidade}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Aumentar ${item.nome}`}
                      disabled={pendente}
                      onClick={() =>
                        executar(() =>
                          alterarQuantidade({ cartItemId: item.id, quantity: item.quantidade + 1 }),
                        )
                      }
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>

                  <span className="font-semibold">{formatCents(item.totalCents)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div>
          <label htmlFor={`obs-${carrinho.id}`} className="text-sm font-semibold">
            Observação para a loja
          </label>
          <Input
            id={`obs-${carrinho.id}`}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
            onBlur={() =>
              executar(() => salvarObservacao({ storeId: carrinho.storeId, notes: observacao }))
            }
            placeholder="Ex.: entregar no portão dos fundos"
            maxLength={500}
            className="mt-1"
          />
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="font-semibold">Subtotal</span>
          <span className="text-lg font-bold">{formatCents(carrinho.subtotalCents)}</span>
        </div>

        {carrinho.temIndisponivel ? (
          <p className="text-warning-text text-sm font-medium">
            Remova os itens indisponíveis para continuar.
          </p>
        ) : null}

        {abaixoDoMinimo ? (
          <p className="text-warning-text text-sm font-medium">
            Pedido mínimo de {formatCents(carrinho.loja.minOrderCents)}. Faltam{' '}
            {formatCents(carrinho.loja.minOrderCents - carrinho.subtotalCents)}.
          </p>
        ) : null}

        {erro ? <p className="text-destructive text-sm font-medium">{erro}</p> : null}

        <Button
          asChild={!carrinho.temIndisponivel && !abaixoDoMinimo}
          size="lg"
          block
          disabled={carrinho.temIndisponivel || abaixoDoMinimo}
        >
          {carrinho.temIndisponivel || abaixoDoMinimo ? (
            <span>Continuar</span>
          ) : (
            <Link href={`/checkout/${carrinho.storeId}`}>
              Continuar · {formatCents(carrinho.subtotalCents)}
            </Link>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
