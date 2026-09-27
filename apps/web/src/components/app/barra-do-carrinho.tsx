'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, ShoppingBag } from 'lucide-react';

/**
 * Atalho do carrinho, flutuando acima da barra de navegação.
 *
 * O carrinho saiu da barra para dar lugar ao "Pedir" e aos favoritos, mas só
 * some quando está vazio — com item dentro ele fica mais visível do que era
 * como ícone, que é o que importa na hora de fechar a compra.
 */
export function BarraDoCarrinho({ itens }: { itens: number }) {
  const pathname = usePathname();

  if (
    itens === 0 ||
    pathname.startsWith('/carrinho') ||
    pathname.endsWith('/pedir') ||
    pathname.includes('/produto/')
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 px-4">
      <Link
        href="/carrinho"
        className="bg-primary text-primary-foreground pointer-events-auto mx-auto flex min-h-12 max-w-lg items-center gap-3 rounded-2xl px-4 font-bold shadow-[0_8px_24px_rgba(255,185,0,0.3)]"
      >
        <ShoppingBag className="h-5 w-5" aria-hidden />
        <span className="flex-1">Ver carrinho</span>
        <span className="rounded-full bg-black/15 px-2 py-0.5 text-sm">
          {itens > 99 ? '99+' : itens} {itens === 1 ? 'item' : 'itens'}
        </span>
        <ChevronRight className="h-5 w-5" aria-hidden />
      </Link>
    </div>
  );
}
