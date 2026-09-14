import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, LogOut, MapPin, Receipt, Shield, Store, User } from 'lucide-react';
import { getCurrentUser } from '@rapidinho/auth';
import { Button, Card, CardContent } from '@rapidinho/ui';
import { maskPhoneBR } from '@rapidinho/shared';
import { sair } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha conta' };

const LINKS = [
  { href: '/pedidos', rotulo: 'Meus pedidos', icone: Receipt },
  { href: '/enderecos', rotulo: 'Meus endereços', icone: MapPin },
  { href: '/conta/dados', rotulo: 'Meus dados e privacidade', icone: Shield },
  { href: '/cadastro-loja', rotulo: 'Cadastrar minha loja', icone: Store },
] as const;

export default async function ContaPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?destino=/conta');

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-6">
      <Card>
        <CardContent className="flex items-center gap-3 pt-5">
          <span className="bg-accent flex h-12 w-12 items-center justify-center rounded-full">
            <User className="text-primary h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold">{user.name ?? 'Cliente'}</p>
            <p className="text-muted-foreground text-sm">
              {user.phone ? maskPhoneBR(user.phone) : ''}
            </p>
          </div>
        </CardContent>
      </Card>

      <ul className="space-y-2">
        {LINKS.map((link) => {
          const Icone = link.icone;
          return (
            <li key={link.href}>
              <Link href={link.href}>
                <Card className="hover:border-primary transition-colors">
                  <CardContent className="min-h-touch flex items-center gap-3 py-4">
                    <Icone className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
                    <span className="flex-1 font-medium">{link.rotulo}</span>
                    <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      <form action={sair}>
        <Button type="submit" variant="outline" block>
          <LogOut className="h-5 w-5" aria-hidden />
          Sair
        </Button>
      </form>
    </main>
  );
}
