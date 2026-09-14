'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgePercent,
  Bell,
  Bike,
  Building2,
  ClipboardList,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button, cn } from '@rapidinho/ui';
import { type UserRole } from '@rapidinho/shared';
import { Logotipo } from '@/components/marca/logo';
import { sair } from '@/app/actions';

const NAV = [
  { href: '/admin', label: 'Visão geral', icon: LayoutDashboard, exact: true },
  { href: '/admin/cidades', label: 'Cidades', icon: MapPin },
  { href: '/admin/lojas', label: 'Lojas', icon: Building2 },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/entregadores', label: 'Entregadores', icon: Bike },
  { href: '/admin/planos', label: 'Planos', icon: Wallet },
  { href: '/admin/impulsionamento', label: 'Impulsionamento', icon: Megaphone },
  { href: '/admin/banners', label: 'Banners', icon: ImageIcon },
  { href: '/admin/notificacoes', label: 'Notificações', icon: Bell },
  { href: '/admin/cupons', label: 'Cupons', icon: BadgePercent },
  { href: '/admin/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/admin/auditoria', label: 'Auditoria', icon: ClipboardList },
] as const;

interface AdminShellProps {
  user: { name: string | null; phone: string | null; role: UserRole };
  children: React.ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  function isAtivo(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const navegacao = (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const ativo = isAtivo(item.href, 'exact' in item ? item.exact : false);

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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Barra lateral fixa no desktop */}
      <aside className="bg-card hidden border-r lg:flex lg:flex-col">
        <div className="border-b p-4">
          <Logotipo className="h-8 w-auto" />
          <p className="text-muted-foreground mt-1.5 text-xs">Plataforma</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{navegacao}</div>
        <div className="border-t p-3">
          <p className="truncate px-3 text-sm font-medium">{user.name ?? 'Administrador'}</p>
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
        {/* Cabeçalho com menu no celular */}
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
          <Logotipo className="h-7 w-auto" />
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

        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
