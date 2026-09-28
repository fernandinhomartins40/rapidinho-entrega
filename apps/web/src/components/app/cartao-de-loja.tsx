import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, ChevronRight, Star } from 'lucide-react';
import { cn } from '@rapidinho/ui';
import { formatCents } from '@rapidinho/shared';
import { grupoDaLoja } from '@/lib/grupos-de-categoria';
import type { ProdutoDaVitrine } from '@/lib/produtos-da-loja';
import { ArteDoPrato } from './arte-do-prato';

export interface LojaNaVitrine {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  categoria: string | null;
  categoriaSlug: string | null;
  nota: number;
  avaliacoes: number;
  taxaCents: number;
  taxaGratis: boolean;
  minimoCents: number;
  tempoMin: number;
  aberta: boolean;
  motivoFechada: string | null;
  imagem: { url: string | null; blurDataUrl: string | null };
  patrocinada: boolean;
  /** Selo "Preço de balcão": vende no app pelo preço da loja física. */
  precoDeBalcao: boolean;
  /** Faixa de produtos do cartão (promoção primeiro, depois os mais pedidos). */
  produtos?: ProdutoDaVitrine[];
}

/** "Supermercado Estrela do Oeste" → "SE": a marca da loja enquanto não há logo. */
function iniciais(nome: string): string {
  const palavras = nome
    .split(/\s+/)
    .filter((palavra) => palavra.length > 2 || /^[A-ZÀ-Ú]/.test(palavra));
  return ((palavras[0]?.[0] ?? '') + (palavras[1]?.[0] ?? '')).toUpperCase() || '•';
}

/**
 * Cartão de loja na vitrine: quem é a loja e, logo embaixo, o que ela vende.
 *
 * Linguagem visual: moldura neutra de fio fino, sem sombra pesada; a cor do
 * nicho aparece só na marca da loja (monograma) e no rótulo da categoria. A
 * oferta é uma etiqueta amarela pequena e o preço antigo riscado — destaque
 * que informa, sem transformar a faixa numa parede amarela.
 *
 * Cabeçalho e cada produto são links separados (link dentro de link não é
 * HTML válido e confunde leitor de tela). Loja fechada continua visível e
 * clicável — ver o cardápio fora do horário traz o cliente de volta amanhã.
 */
export function CartaoDeLoja({ loja, cidadeSlug }: { loja: LojaNaVitrine; cidadeSlug: string }) {
  const produtos = loja.produtos ?? [];
  const nicho = grupoDaLoja(loja.categoriaSlug);

  return (
    <article
      className="bg-card overflow-hidden rounded-2xl border"
      data-nicho={nicho.chave}
      data-aberta={loja.aberta}
    >
      <Link
        href={`/${cidadeSlug}/${loja.slug}`}
        className="focus-visible:ring-ring flex items-center gap-3 px-4 pb-3 pt-4 focus-visible:outline-none focus-visible:ring-2"
      >
        {loja.imagem.url ? (
          <Image
            src={loja.imagem.url}
            alt=""
            width={48}
            height={48}
            className={cn(
              'h-12 w-12 shrink-0 rounded-xl border object-cover',
              !loja.aberta && 'opacity-60 grayscale',
            )}
            {...(loja.imagem.blurDataUrl
              ? { placeholder: 'blur' as const, blurDataURL: loja.imagem.blurDataUrl }
              : {})}
          />
        ) : (
          <span
            aria-hidden
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[15px] font-semibold tracking-tight',
              !loja.aberta && 'opacity-60',
            )}
            style={{ backgroundColor: nicho.fundo, color: nicho.cor }}
          >
            {iniciais(loja.nome)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight tracking-tight">
              {loja.nome}
            </span>
            {loja.avaliacoes > 0 ? (
              <span className="numeros flex shrink-0 items-center gap-0.5 text-[13px] font-medium">
                <Star className="fill-foreground h-3 w-3" aria-hidden />
                {loja.nota.toFixed(1)}
              </span>
            ) : null}
          </p>

          <p className="text-muted-foreground numeros mt-1 flex min-w-0 items-center gap-1.5 text-[13px]">
            <span className="truncate font-medium" style={{ color: nicho.cor }}>
              {loja.categoria ?? nicho.nome}
            </span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{loja.tempoMin} min</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">
              {loja.taxaGratis || loja.taxaCents === 0 ? (
                <span className="text-success font-medium">Entrega grátis</span>
              ) : (
                formatCents(loja.taxaCents)
              )}
            </span>
          </p>

          {loja.patrocinada || loja.precoDeBalcao || !loja.aberta ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {!loja.aberta ? (
                <span className="text-foreground font-medium">
                  {loja.motivoFechada ?? 'Fechada agora'}
                </span>
              ) : null}
              {loja.precoDeBalcao ? (
                // Compromisso da loja: preço do app = preço da loja física.
                <span className="text-success inline-flex items-center gap-1 font-medium">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  Preço de balcão
                </span>
              ) : null}
              {loja.patrocinada ? (
                // Identificar o patrocínio é obrigação, não escolha de layout.
                <span className="text-muted-foreground">Patrocinado</span>
              ) : null}
            </p>
          ) : null}
        </div>

        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
      </Link>

      {produtos.length > 0 ? (
        <ul
          // `scroll-px-4`: sem ele o encaixe da rolagem ignora o recuo e o
          // primeiro produto encosta na borda do cartão.
          className="no-scrollbar flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-4"
          aria-label={`Produtos de ${loja.nome}`}
        >
          {produtos.map((produto) => (
            <li key={produto.id} className="w-[6.75rem] shrink-0 snap-start">
              <ProdutoNaFaixa produto={produto} apagado={!loja.aberta} />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function ProdutoNaFaixa({ produto, apagado }: { produto: ProdutoDaVitrine; apagado: boolean }) {
  const desconto = produto.precoDeCents
    ? Math.round((1 - produto.precoCents / produto.precoDeCents) * 100)
    : 0;

  return (
    <Link href={produto.href} className="group block">
      <span className="relative block">
        <ArteDoPrato
          imagem={produto.imagem}
          arte={produto.arte}
          nome={produto.nome}
          tamanho="xs"
          neutro
          className={cn(
            'aspect-square w-full rounded-xl transition-transform group-active:scale-95',
            apagado && 'opacity-60',
          )}
        />
        {desconto > 0 ? (
          <span className="bg-primary text-primary-foreground numeros absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none">
            −{desconto}%
          </span>
        ) : null}
      </span>
      <span className="numeros mt-2 flex flex-wrap items-baseline gap-x-1">
        {produto.aPartirDe ? (
          <span className="text-muted-foreground text-[11px]">a partir de</span>
        ) : null}
        <span className="text-[14px] font-semibold tracking-tight">
          {formatCents(produto.precoCents)}
          {produto.porPeso ? (
            <span className="text-muted-foreground text-[11px] font-normal">/kg</span>
          ) : null}
        </span>
        {produto.precoDeCents ? (
          <span className="text-muted-foreground text-[11px] line-through">
            {formatCents(produto.precoDeCents)}
          </span>
        ) : null}
      </span>
      <span className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-snug">
        {produto.nome}
      </span>
    </Link>
  );
}
