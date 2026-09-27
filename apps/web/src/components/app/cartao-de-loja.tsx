import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Bike, ChevronRight, Clock, Star } from 'lucide-react';
import { Badge, cn } from '@rapidinho/ui';
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
 * A faixa de produtos é o que faz o cliente escolher sem abrir loja por loja.
 * Cabeçalho e cada produto são links separados (link dentro de link não é
 * HTML válido e confunde leitor de tela).
 *
 * Loja fechada continua visível e clicável — ver o cardápio fora do horário
 * traz o cliente de volta amanhã —, com o aviso em etiqueta legível.
 */
export function CartaoDeLoja({ loja, cidadeSlug }: { loja: LojaNaVitrine; cidadeSlug: string }) {
  const produtos = loja.produtos ?? [];
  // A cor do nicho (mercado verde, farmácia azul...) marca o cartão: dá para
  // saber o tipo de loja sem ler.
  const nicho = grupoDaLoja(loja.categoriaSlug);

  return (
    <article
      className={cn(
        'bg-card overflow-hidden rounded-xl border border-t-[3px] border-black/5 shadow-[0_2px_10px_rgba(20,20,20,0.05)]',
        !loja.aberta && 'bg-card/70',
      )}
      style={{ borderTopColor: nicho.cor }}
      data-nicho={nicho.chave}
      data-aberta={loja.aberta}
    >
      <Link
        href={`/${cidadeSlug}/${loja.slug}`}
        className="focus-visible:ring-ring flex items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2"
      >
        {loja.imagem.url ? (
          <Image
            src={loja.imagem.url}
            alt=""
            width={52}
            height={52}
            className={cn(
              'h-13 w-13 shrink-0 rounded-full border object-cover',
              loja.aberta ? undefined : 'opacity-60 grayscale',
            )}
            {...(loja.imagem.blurDataUrl
              ? { placeholder: 'blur' as const, blurDataURL: loja.imagem.blurDataUrl }
              : {})}
          />
        ) : (
          <span
            aria-hidden
            className="flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full text-base font-bold tracking-wide text-white"
            style={{ backgroundColor: nicho.cor }}
          >
            {iniciais(loja.nome)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold leading-tight">
            <span className="truncate">{loja.nome}</span>
            {loja.patrocinada ? (
              // Identificar o patrocínio é obrigação, não escolha de layout.
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                Patrocinado
              </Badge>
            ) : null}
          </p>

          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px]">
            {loja.avaliacoes > 0 ? (
              <span className="text-foreground flex items-center gap-1 font-medium">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                {loja.nota.toFixed(1)}
              </span>
            ) : null}
            <span className="truncate font-medium" style={{ color: nicho.cor }}>
              {loja.categoria ?? nicho.nome}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {loja.tempoMin} min
            </span>
            <span className="flex items-center gap-1">
              <Bike className="h-3.5 w-3.5" aria-hidden />
              {loja.taxaGratis || loja.taxaCents === 0 ? (
                <span className="text-success font-semibold">Grátis</span>
              ) : (
                formatCents(loja.taxaCents)
              )}
            </span>
          </div>

          {loja.precoDeBalcao || !loja.aberta ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {loja.precoDeBalcao ? (
                // Compromisso da loja: preço do app = preço da loja física.
                <span className="text-success inline-flex items-center gap-1 text-xs font-semibold">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  Preço de balcão
                </span>
              ) : null}
              {!loja.aberta ? (
                <Badge variant="warning" className="text-[11px]">
                  {loja.motivoFechada ?? 'Fechada agora'}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
      </Link>

      {produtos.length > 0 ? (
        <ul
          // `scroll-px-3`: sem ele o encaixe da rolagem ignora o recuo e o
          // primeiro produto encosta na borda do cartão.
          className="no-scrollbar flex snap-x scroll-px-3 gap-2 overflow-x-auto px-3 pb-3 pt-0.5"
          aria-label={`Produtos de ${loja.nome}`}
        >
          {produtos.map((produto) => {
            const desconto = produto.precoDeCents
              ? Math.round((1 - produto.precoCents / produto.precoDeCents) * 100)
              : 0;
            const promocao = desconto > 0;
            return (
              <li key={produto.id} className="w-[7.25rem] shrink-0 snap-start">
                {/* Promoção é oportunidade: o cartão inteiro vira o amarelo da
                    marca, com borda mais clara e brilho, e salta da faixa. Os
                    outros têm a mesma moldura, transparente, para alinhar. */}
                <Link
                  href={produto.href}
                  className={cn(
                    'group block h-full rounded-xl border-2 p-1.5 transition-transform active:scale-95',
                    promocao
                      ? 'bg-primary border-[#FFD84D] shadow-[0_0_0_1px_rgba(255,216,77,0.6),0_6px_16px_rgba(255,185,0,0.45)]'
                      : 'border-transparent',
                  )}
                >
                  <span className="relative block">
                    <ArteDoPrato
                      imagem={produto.imagem}
                      arte={produto.arte}
                      nome={produto.nome}
                      tamanho="xs"
                      className={cn(
                        'h-[6.25rem] w-full rounded-lg',
                        promocao && 'ring-1 ring-black/5',
                        !loja.aberta && 'opacity-70',
                      )}
                    />
                    {promocao ? (
                      <span className="text-primary absolute left-1 top-1 rounded bg-[#141414] px-1.5 py-0.5 text-[10px] font-bold">
                        -{desconto}%
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'mt-1.5 line-clamp-2 text-xs leading-snug',
                      promocao ? 'text-primary-foreground font-semibold' : 'font-medium',
                    )}
                  >
                    {produto.nome}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1">
                    {produto.aPartirDe ? (
                      <span className="text-muted-foreground text-[10px]">a partir de</span>
                    ) : null}
                    <span
                      className={cn(
                        'text-[13px] font-bold',
                        promocao && 'text-primary-foreground text-sm font-extrabold',
                      )}
                    >
                      {formatCents(produto.precoCents)}
                      {produto.porPeso ? (
                        <span className="text-[10px] font-normal opacity-70">/kg</span>
                      ) : null}
                    </span>
                    {produto.precoDeCents ? (
                      <span className="text-primary-foreground/70 text-[10px] line-through">
                        {formatCents(produto.precoDeCents)}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}
