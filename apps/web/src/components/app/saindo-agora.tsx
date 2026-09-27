import Link from 'next/link';
import { ChevronRight, Flame, Shuffle, Sparkles } from 'lucide-react';
import { formatCents } from '@rapidinho/shared';
import type { PratoNaVitrine } from '@/lib/pratos';
import { ArteDoPrato } from './arte-do-prato';

/**
 * A vitrine de pratos da tela inicial.
 *
 * Em cima, a porta do "Tô com fome" para quem não sabe o que quer; embaixo,
 * os pratos que a cidade está pedindo nesta hora — prato, preço e loja,
 * um toque e está na página dele.
 */
export function SaindoAgora({
  cidadeSlug,
  pratos,
}: {
  cidadeSlug: string;
  pratos: PratoNaVitrine[];
}) {
  return (
    <section aria-labelledby="saindo-agora" className="space-y-4">
      <Link
        href={`/${cidadeSlug}/fome`}
        className="bg-card flex items-center gap-4 rounded-xl border border-black/5 p-4 shadow-[0_2px_10px_rgba(20,20,20,0.06)] transition-transform active:scale-[0.98]"
      >
        <span className="bg-primary text-primary-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Shuffle className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold leading-tight">Não sabe o que comer?</span>
          <span className="text-muted-foreground block text-sm">
            Passe os pratos: a gente escolhe com você.
          </span>
        </span>
        <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
      </Link>

      {pratos.length > 0 ? (
        <div>
          <h2 id="saindo-agora" className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Flame className="text-primary-text h-5 w-5" aria-hidden />
            Saindo agora em sua cidade
          </h2>
          <ul className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
            {pratos.map((prato) => (
              <li key={prato.chave} className="w-40 shrink-0 snap-start">
                <Link href={prato.href} className="group block">
                  <ArteDoPrato
                    imagem={prato.imagem}
                    arte={prato.arte}
                    nome={prato.nome}
                    tamanho="sm"
                    className="h-28 w-full rounded-xl transition-transform group-active:scale-95"
                  />
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                    {prato.nome}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{prato.loja.nome}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold">
                    {prato.aPartirDe ? (
                      <span className="text-muted-foreground text-xs font-normal">a partir de</span>
                    ) : null}
                    {formatCents(prato.precoCents)}
                  </p>
                  {prato.jaPediu ? (
                    <p className="text-primary-text mt-0.5 flex items-center gap-1 text-[11px] font-semibold">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      Você já pediu
                    </p>
                  ) : prato.emAlta ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-orange-700">
                      <Flame className="h-3 w-3" aria-hidden />
                      Muito pedido agora
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
