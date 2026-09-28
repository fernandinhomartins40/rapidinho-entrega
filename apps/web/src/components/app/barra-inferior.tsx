'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Home, Receipt, Sparkles, User, type LucideIcon } from 'lucide-react';
import { cn } from '@rapidinho/ui';

interface ItemDaBarra {
  href: string;
  rotulo: string;
  icone: LucideIcon;
  ativo: boolean;
  preencher?: boolean;
}

/**
 * Navegação fixa no rodapé, com o "Pedir" no centro.
 *
 * O padrão de app nativo, e não um menu hambúrguer: o público instala como PWA
 * e espera a barra de baixo. O botão do meio é a porta do pedido por lista —
 * escrever ou falar o que precisa, sem procurar loja por loja —, por isso ele
 * é maior e salta da barra. Respeita a área segura do iPhone para não ficar
 * escondida atrás da faixa de gestos.
 */
export function BarraInferior({ cidadeSlug }: { cidadeSlug: string | null }) {
  const pathname = usePathname();
  const inicio = cidadeSlug ? `/${cidadeSlug}` : '/app';
  const pedir = cidadeSlug ? `/${cidadeSlug}/pedir` : '/app';
  const pedindo = pathname.endsWith('/pedir');

  // A tela do produto tem a própria barra fixa ("Adicionar"); as duas juntas
  // cobririam metade da tela de um celular pequeno. O "Tô com fome" é tela
  // cheia: o cartão e os botões de decidir precisam caber sem rolar.
  if (pathname.includes('/produto/') || /\/fome(\/|$)/.test(pathname)) return null;

  const esquerda: ItemDaBarra[] = [
    { href: inicio, rotulo: 'Início', icone: Home, ativo: pathname === inicio },
    { href: '/pedidos', rotulo: 'Pedidos', icone: Receipt, ativo: pathname.startsWith('/pedidos') },
  ];
  const direita: ItemDaBarra[] = [
    {
      href: '/favoritos',
      rotulo: 'Favoritos',
      icone: Heart,
      ativo: pathname.startsWith('/favoritos'),
      preencher: true,
    },
    { href: '/conta', rotulo: 'Perfil', icone: User, ativo: pathname.startsWith('/conta') },
  ];

  const renderizar = (item: ItemDaBarra) => {
    const Icone = item.icone;
    return (
      <li key={item.href} className="flex-1">
        <Link
          href={item.href}
          aria-current={item.ativo ? 'page' : undefined}
          className={cn(
            'min-h-touch flex flex-col items-center justify-center gap-1 pb-2 pt-2.5 text-[11px] font-medium transition-colors',
            item.ativo ? 'text-primary-text' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icone
            className={cn('h-6 w-6', item.ativo && item.preencher && 'fill-current')}
            strokeWidth={item.ativo ? 2.4 : 1.8}
            aria-hidden
          />
          {item.rotulo}
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 shadow-[0_-4px_16px_rgba(20,20,20,0.04)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-lg items-end px-2">
        {esquerda.map(renderizar)}

        <li className="flex w-20 shrink-0 justify-center">
          <Link
            href={pedir}
            aria-current={pedindo ? 'page' : undefined}
            className="group -mt-7 flex flex-col items-center gap-1 pb-2"
          >
            <span className="botao-vidro flex h-16 w-16 items-center justify-center rounded-full text-[#141414] transition-transform group-active:scale-95">
              <Sparkles className="h-7 w-7" strokeWidth={2.2} aria-hidden />
            </span>
            <span
              className={cn(
                'text-[11px] font-bold',
                pedindo ? 'text-primary-text' : 'text-foreground',
              )}
            >
              Pedir
            </span>
          </Link>
        </li>

        {direita.map(renderizar)}
      </ul>
    </nav>
  );
}
