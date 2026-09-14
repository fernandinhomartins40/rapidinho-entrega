'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgePercent,
  Bike,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Pizza,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { Button, cn } from '@rapidinho/ui';
import { Logotipo } from '@/components/marca/logo';
import { sair } from '@/app/actions';

/**
 * Navegação do painel da loja.
 *
 * A ordem não é alfabética nem por módulo: é a ordem em que o lojista usa as
 * telas num dia normal. Pedidos vem logo depois da visão geral porque é a tela
 * que fica aberta o dia inteiro.
 */
const NAV = [
  { href: '/loja', label: 'Visão geral', icon: LayoutDashboard, exact: true },
  { href: '/loja/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/loja/produtos', label: 'Produtos', icon: Package },
  { href: '/loja/categorias', label: 'Categorias', icon: Receipt },
  { href: '/loja/complementos', label: 'Complementos', icon: BadgePercent },
  { href: '/loja/pizzas', label: 'Pizzas', icon: Pizza },
  { href: '/loja/horarios', label: 'Horários', icon: Clock },
  { href: '/loja/entrega', label: 'Entrega', icon: Truck },
  { href: '/loja/entregadores', label: 'Entregadores', icon: Bike },
  { href: '/loja/cupons', label: 'Cupons', icon: BadgePercent },
  { href: '/loja/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/loja/configuracoes', label: 'Configurações', icon: Settings },
] as const;

interface LojaShellProps {
  loja: { nome: string; estaAberta: boolean; pausadaAte: Date | null };
  user: { name: string | null; phone: string | null };
  /// Admin da plataforma operando a loja: precisa ficar evidente na tela.
  comoAdmin: boolean;
  pedidosAbertos: number;
  children: React.ReactNode;
}

export function LojaShell({ loja, user, comoAdmin, pedidosAbertos, children }: LojaShellProps) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  const navegacao = (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const ativo =
          'exact' in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuAberto(false)}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'min-h-touch flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              ativo
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {/* O contador só aparece em Pedidos e só quando há o que fazer. */}
            {item.href === '/loja/pedidos' && pedidosAbertos > 0 ? (
              <span
                className={cn(
                  'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold',
                  ativo
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-destructive text-destructive-foreground',
                )}
              >
                {pedidosAbertos}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {comoAdmin ? (
        <div className="bg-warning text-warning-foreground col-span-full px-4 py-2 text-center text-sm font-semibold">
          Você está operando como a loja {loja.nome}. Tudo que fizer aqui fica registrado na
          auditoria.
        </div>
      ) : null}

      <aside className="bg-card hidden border-r lg:flex lg:flex-col">
        <div className="border-b p-4">
          <Logotipo className="h-7 w-auto" />
          <p className="mt-2 truncate text-sm font-bold">{loja.nome}</p>
          <StatusDaLoja aberta={loja.estaAberta} pausadaAte={loja.pausadaAte} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">{navegacao}</div>
        <div className="border-t p-3">
          <p className="truncate px-3 text-sm font-medium">{user.name ?? 'Lojista'}</p>
          <p className="text-muted-foreground truncate px-3 text-xs">{user.phone}</p>
          <form action={sair}>
            <Button type="submit" variant="ghost" size="sm" block className="mt-2 justify-start">
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-card sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuAberto((aberto) => !aberto)}
            aria-expanded={menuAberto}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          >
            {menuAberto ? (
              <X className="h-6 w-6" aria-hidden />
            ) : (
              <Menu className="h-6 w-6" aria-hidden />
            )}
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold leading-tight">{loja.nome}</p>
            <StatusDaLoja aberta={loja.estaAberta} pausadaAte={loja.pausadaAte} />
          </div>
          {pedidosAbertos > 0 ? (
            <Link
              href="/loja/pedidos"
              className="bg-destructive text-destructive-foreground flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              {pedidosAbertos}
            </Link>
          ) : null}
        </header>

        {menuAberto ? (
          <div className="bg-card border-b p-3 lg:hidden">
            {navegacao}
            <form action={sair} className="mt-2 border-t pt-2">
              <Button type="submit" variant="ghost" size="sm" block className="justify-start">
                <LogOut className="h-4 w-4" aria-hidden />
                Sair
              </Button>
            </form>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function StatusDaLoja({ aberta, pausadaAte }: { aberta: boolean; pausadaAte: Date | null }) {
  const pausada = pausadaAte != null && pausadaAte > new Date();

  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          pausada ? 'bg-destructive' : aberta ? 'bg-success' : 'bg-muted-foreground',
        )}
        aria-hidden
      />
      <span
        className={pausada ? 'text-destructive' : aberta ? 'text-success' : 'text-muted-foreground'}
      >
        {pausada ? 'Pausada' : aberta ? 'Aberta agora' : 'Fechada'}
      </span>
    </p>
  );
}
