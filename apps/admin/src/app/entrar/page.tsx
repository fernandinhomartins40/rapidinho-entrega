import { redirect } from 'next/navigation';
import { getCurrentUser } from '@rapidinho/auth';
import { Logotipo } from '@/components/marca/logo';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Entrar' };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/');

  const { destino } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <Logotipo className="mx-auto h-11 w-auto" />
          <h1 className="text-muted-foreground mt-3 text-base font-medium">Painel de gestão</h1>
        </header>

        <LoginForm destino={destino ?? '/'} />

        <p className="text-muted-foreground mt-8 text-center text-xs">
          Acesso restrito a lojistas e à equipe da plataforma.
        </p>
      </div>
    </main>
  );
}
