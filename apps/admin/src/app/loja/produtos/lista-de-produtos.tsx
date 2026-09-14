'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pause, Play, Search, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, cn } from '@rapidinho/ui';
import { formatCents } from '@rapidinho/shared';
import { alternarDisponibilidade, excluirProduto } from './actions';

interface ProdutoNaLista {
  id: string;
  name: string;
  priceCents: number;
  isAvailable: boolean;
  pausedUntil: string | null;
  stockQuantity: number | null;
  sellingUnit: string;
  sku: string | null;
  category: { id: string; name: string } | null;
  imagem: { url: string | null; blurDataUrl: string | null };
}

export function ListaDeProdutos({
  produtos,
  categorias,
  busca,
}: {
  produtos: ProdutoNaLista[];
  categorias: { id: string; name: string }[];
  busca: { q?: string; categoria?: string; situacao?: string };
}) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [erro, setErro] = useState<string | null>(null);

  function filtrar(campo: string, valor: string) {
    const novos = new URLSearchParams(parametros.toString());
    if (valor) novos.set(campo, valor);
    else novos.delete(campo);
    router.replace(`/loja/produtos?${novos.toString()}`);
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          const dados = new FormData(evento.currentTarget);
          filtrar('q', String(dados.get('q') ?? ''));
        }}
      >
        <div className="relative min-w-48 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={busca.q ?? ''}
            placeholder="Buscar por nome, código ou código de barras"
            className="pl-9"
            aria-label="Buscar produto"
          />
        </div>

        <select
          value={busca.categoria ?? ''}
          onChange={(evento) => filtrar('categoria', evento.target.value)}
          className="border-input min-h-touch rounded-lg border px-3"
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.name}
            </option>
          ))}
        </select>

        <select
          value={busca.situacao ?? ''}
          onChange={(evento) => filtrar('situacao', evento.target.value)}
          className="border-input min-h-touch rounded-lg border px-3"
          aria-label="Filtrar por situação"
        >
          <option value="">Todas as situações</option>
          <option value="pausados">Só pausados</option>
          <option value="sem-estoque">Sem estoque</option>
        </select>

        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {erro ? <p className="text-destructive text-sm font-medium">{erro}</p> : null}

      {produtos.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6">
            Nenhum produto encontrado com esses filtros.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {produtos.map((produto) => (
            <LinhaDoProduto key={produto.id} produto={produto} onErro={setErro} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaDoProduto({
  produto,
  onErro,
}: {
  produto: ProdutoNaLista;
  onErro: (mensagem: string | null) => void;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  // Pausa com prazo ainda válida conta como pausado, mesmo que o registro
  // diga "disponível" — é ela que manda até vencer.
  const pausadoPorPrazo = produto.pausedUntil != null && new Date(produto.pausedUntil) > new Date();
  const indisponivel = !produto.isAvailable || pausadoPorPrazo;

  function executar(acao: () => Promise<{ ok: boolean; message?: string }>) {
    onErro(null);
    iniciarTransicao(async () => {
      const resultado = await acao();
      if (!resultado.ok) onErro(resultado.message ?? 'Não foi possível concluir.');
    });
  }

  return (
    <li>
      <Card className={cn(indisponivel && 'opacity-60')}>
        <CardContent className="flex items-center gap-3 py-3">
          {produto.imagem.url ? (
            <Image
              src={produto.imagem.url}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
              {...(produto.imagem.blurDataUrl
                ? { placeholder: 'blur' as const, blurDataURL: produto.imagem.blurDataUrl }
                : {})}
            />
          ) : (
            <div className="bg-muted h-14 w-14 shrink-0 rounded-lg" aria-hidden />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{produto.name}</p>
            <p className="text-muted-foreground truncate text-sm">
              {formatCents(produto.priceCents)}
              {produto.sellingUnit === 'WEIGHT_KG' ? ' / kg' : ''}
              {produto.category ? ` · ${produto.category.name}` : ''}
              {produto.sku ? ` · ${produto.sku}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {indisponivel ? <Badge variant="warning">Pausado</Badge> : null}
              {produto.stockQuantity === 0 ? (
                <Badge variant="destructive">Sem estoque</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={pendente}
              aria-label={indisponivel ? `Reativar ${produto.name}` : `Pausar ${produto.name}`}
              onClick={() =>
                executar(() =>
                  alternarDisponibilidade({ id: produto.id, isAvailable: indisponivel }),
                )
              }
            >
              {indisponivel ? (
                <Play className="h-5 w-5" aria-hidden />
              ) : (
                <Pause className="h-5 w-5" aria-hidden />
              )}
            </Button>

            <Link
              href={`/loja/produtos/${produto.id}`}
              className="min-h-touch flex items-center rounded-lg px-3 text-sm font-semibold underline"
            >
              Editar
            </Link>

            {confirmando ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pendente}
                  onClick={() => executar(() => excluirProduto(produto.id))}
                >
                  Confirmar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                  Não
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Excluir ${produto.name}`}
                onClick={() => setConfirmando(true)}
              >
                <Trash2 className="h-5 w-5" aria-hidden />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
