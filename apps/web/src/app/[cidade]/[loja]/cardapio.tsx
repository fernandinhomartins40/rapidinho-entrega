'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Pizza } from 'lucide-react';
import { Badge, Card, CardContent, cn } from '@rapidinho/ui';
import { formatCents } from '@rapidinho/shared';

export interface ProdutoNoCardapio {
  id: string;
  nome: string;
  descricao: string | null;
  precoCents: number;
  precoDeCents: number | null;
  porPeso: boolean;
  disponivel: boolean;
  imagem: { url: string | null; blurDataUrl: string | null };
}

export interface SecaoDoCardapio {
  id: string;
  nome: string;
  descricao: string | null;
  produtos: ProdutoNoCardapio[];
}

/**
 * Cardápio da loja.
 *
 * As seções ficam num índice colável no topo: num mercado com 20 categorias,
 * rolar até "Limpeza" é o que faz o cliente desistir.
 */
export function Cardapio({
  storeId,
  secoes,
  pizzaSizes,
  aberta,
  cidadeSlug,
}: {
  storeId: string;
  secoes: SecaoDoCardapio[];
  pizzaSizes: { id: string; name: string; maxFlavors: number; slices: number | null }[];
  aberta: boolean;
  cidadeSlug: string;
}) {
  const [secaoAtiva, setSecaoAtiva] = useState<string | null>(null);

  if (secoes.length === 0 && pizzaSizes.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center">
        Esta loja ainda não publicou o cardápio.
      </p>
    );
  }

  return (
    <div className="py-6">
      {!aberta ? (
        <p className="bg-warning/15 text-warning-foreground mb-4 rounded-xl p-3 text-sm font-medium">
          A loja está fechada. Você pode ver o cardápio, mas só dá para pedir quando ela abrir.
        </p>
      ) : null}

      {secoes.length > 1 ? (
        <nav
          aria-label="Seções do cardápio"
          className="bg-background sticky top-0 z-20 -mx-5 px-5 py-2"
        >
          <ul className="no-scrollbar flex gap-2 overflow-x-auto">
            {secoes.map((secao) => (
              <li key={secao.id}>
                <a
                  href={`#secao-${secao.id}`}
                  onClick={() => setSecaoAtiva(secao.id)}
                  className={cn(
                    'min-h-touch flex items-center whitespace-nowrap rounded-full border-2 px-4 text-sm font-semibold',
                    secaoAtiva === secao.id ? 'border-primary bg-accent' : 'border-input',
                  )}
                >
                  {secao.nome}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {pizzaSizes.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 text-lg font-bold">Monte sua pizza</h2>
          <ul className="space-y-2">
            {pizzaSizes.map((tamanho) => (
              <li key={tamanho.id}>
                <Link
                  href={`/${cidadeSlug}/pizza/${storeId}?tamanho=${tamanho.id}`}
                  className="bg-card hover:border-primary min-h-touch flex items-center gap-3 rounded-2xl border p-4"
                >
                  <span className="bg-accent flex h-12 w-12 items-center justify-center rounded-xl">
                    <Pizza className="text-primary h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{tamanho.name}</span>
                    <span className="text-muted-foreground block text-sm">
                      Até {tamanho.maxFlavors} {tamanho.maxFlavors === 1 ? 'sabor' : 'sabores'}
                      {tamanho.slices ? ` · ${tamanho.slices} pedaços` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {secoes.map((secao) => (
        <section key={secao.id} id={`secao-${secao.id}`} className="mb-6 scroll-mt-16">
          <h2 className="mb-1 text-lg font-bold">{secao.nome}</h2>
          {secao.descricao ? (
            <p className="text-muted-foreground mb-3 text-sm">{secao.descricao}</p>
          ) : null}

          <ul className="space-y-2">
            {secao.produtos.map((produto) => (
              <li key={produto.id}>
                <ItemDoCardapio
                  produto={produto}
                  href={`/${cidadeSlug}/produto/${produto.id}`}
                  podePedir={aberta}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ItemDoCardapio({
  produto,
  href,
  podePedir,
}: {
  produto: ProdutoNoCardapio;
  href: string;
  podePedir: boolean;
}) {
  const conteudo = (
    <CardContent className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{produto.nome}</p>
        {produto.descricao ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{produto.descricao}</p>
        ) : null}
        <p className="mt-1 font-semibold">
          {formatCents(produto.precoCents)}
          {produto.porPeso ? <span className="text-muted-foreground text-sm"> /kg</span> : null}
          {produto.precoDeCents && produto.precoDeCents > produto.precoCents ? (
            <span className="text-muted-foreground ml-2 text-sm font-normal line-through">
              {formatCents(produto.precoDeCents)}
            </span>
          ) : null}
        </p>
        {!produto.disponivel ? (
          <Badge variant="warning" className="mt-1">
            Indisponível
          </Badge>
        ) : null}
      </div>

      {produto.imagem.url ? (
        <Image
          src={produto.imagem.url}
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
          {...(produto.imagem.blurDataUrl
            ? { placeholder: 'blur' as const, blurDataURL: produto.imagem.blurDataUrl }
            : {})}
        />
      ) : null}
    </CardContent>
  );

  // Produto indisponível continua visível mas não navega: abrir a tela para
  // descobrir que não dá para pedir é pior que ver o aviso aqui.
  if (!produto.disponivel || !podePedir) {
    return <Card className="opacity-60">{conteudo}</Card>;
  }

  return (
    <Link href={href} className="block">
      <Card className="hover:border-primary transition-colors">{conteudo}</Card>
    </Link>
  );
}
