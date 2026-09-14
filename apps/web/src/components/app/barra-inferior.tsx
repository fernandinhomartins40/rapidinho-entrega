'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { cn } from '@rapidinho/ui';

/**
 * Navegação fixa no rodapé.
 *
 * O padrão de app nativo, e não um menu hambúrguer: o público instala como PWA
 * e espera a barra de baixo. Respeita a área segura do iPhone para não ficar
 * escondida atrás da faixa de gestos.
 */
export function BarraInferior({
  cidadeSlug,
  itensNoCarrinho,
}: {
  cidadeSlug: string;
  itensNoCarrinho: number;
}) {
  const pathname = usePathname();

  const itens = [
    { href: `/${cidadeSlug}`, rotulo: 'Início', icone: Home, exact: true },
    { href: `/${cidadeSlug}/busca`, rotulo: 'Buscar', icone: Search },
    { href: '/carrinho', rotulo: 'Carrinho', icone: ShoppingBag, contador: itensNoCarrinho },
    { href: '/conta', rotulo: 'Conta', icone: User },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-card pb-safe fixed inset-x-0 bottom-0 z-40 border-t"
    >
      <ul className="mx-auto flex max-w-lg">
        {itens.map((item) => {
          const Icone = item.icone;
          const ativo = item.exact ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={cn(
                  'min-h-touch relative flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors',
                  ativo ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icone className="h-6 w-6" aria-hidden />
                  {item.contador != null && item.contador > 0 ? (
                    <span className="bg-destructive text-destructive-foreground absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
                      {item.contador > 99 ? '99+' : item.contador}
                    </span>
                  ) : null}
                </span>
                {item.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
