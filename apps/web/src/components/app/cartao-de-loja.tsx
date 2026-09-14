import Image from 'next/image';
import Link from 'next/link';
import { Bike, Star } from 'lucide-react';
import { Badge, cn } from '@rapidinho/ui';
import { formatCents } from '@rapidinho/shared';

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
}

/**
 * Cartão de loja na vitrine.
 *
 * Loja fechada continua clicável: ver o cardápio fora do horário é o que traz
 * o cliente de volta no dia seguinte. O que muda é o aviso, para ninguém
 * montar um carrinho achando que vai receber agora.
 *
 * O fechado não escurece o cartão inteiro. Fazia isso antes, e a opacidade
 * derrubava todo o texto para 3,2:1 — inclusive o próprio aviso de que a loja
 * está fechada, que é justamente o que precisa ser lido. Agora só a foto, que
 * não carrega informação, perde saturação.
 */
export function CartaoDeLoja({ loja, cidadeSlug }: { loja: LojaNaVitrine; cidadeSlug: string }) {
  return (
    <Link
      href={`/${cidadeSlug}/${loja.slug}`}
      className={cn(
        'bg-card focus-visible:ring-ring min-h-touch flex items-center gap-3 rounded-2xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2',
        loja.aberta ? 'hover:border-primary' : 'bg-muted/40',
      )}
    >
      {loja.imagem.url ? (
        <Image
          src={loja.imagem.url}
          alt=""
          width={64}
          height={64}
          className={cn(
            'h-16 w-16 shrink-0 rounded-xl object-cover',
            loja.aberta ? undefined : 'opacity-60 grayscale',
          )}
          {...(loja.imagem.blurDataUrl
            ? { placeholder: 'blur' as const, blurDataURL: loja.imagem.blurDataUrl }
            : {})}
        />
      ) : (
        <div className="bg-muted h-16 w-16 shrink-0 rounded-xl" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold">
          <span className="truncate">{loja.nome}</span>
          {loja.patrocinada ? (
            // Identificar o patrocínio é obrigação, não escolha de layout.
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Patrocinado
            </Badge>
          ) : null}
        </p>

        <p className="text-muted-foreground truncate text-sm">
          {loja.categoria ?? loja.descricao ?? ''}
        </p>

        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
          {loja.avaliacoes > 0 ? (
            <span className="flex items-center gap-1">
              <Star className="fill-warning text-warning h-3.5 w-3.5" aria-hidden />
              {loja.nota.toFixed(1)}
            </span>
          ) : (
            <span>Sem avaliações</span>
          )}
          <span>{loja.tempoMin} min</span>
          <span className="flex items-center gap-1">
            <Bike className="h-3.5 w-3.5" aria-hidden />
            {loja.taxaGratis || loja.taxaCents === 0 ? (
              <span className="text-success font-semibold">Grátis</span>
            ) : (
              formatCents(loja.taxaCents)
            )}
          </span>
        </div>

        {!loja.aberta ? (
          // Etiqueta, e não texto amarelo: o amarelo da marca sobre fundo
          // claro dá 1,6:1 — o aviso mais importante do cartão era o menos
          // legível dele.
          <Badge variant="warning" className="mt-1.5 text-[11px]">
            {loja.motivoFechada ?? 'Fechada agora'}
          </Badge>
        ) : null}
      </div>
    </Link>
  );
}
