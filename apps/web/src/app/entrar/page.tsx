import { redirect } from 'next/navigation';
import Link from 'next/link';
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
  const { destino } = await searchParams;

  if (user) redirect(destino ?? '/');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <Link href="/">
            <Logotipo className="mx-auto h-11 w-auto" priority />
          </Link>
          <h1 className="mt-4 text-xl font-bold">Entre com seu telefone</h1>
          <p className="text-muted-foreground mt-1">
            Sem senha e sem cadastro demorado. Você recebe um código no WhatsApp.
          </p>
        </header>

        <LoginForm destino={destino ?? '/'} />

        <p className="text-muted-foreground mt-8 text-center text-xs leading-relaxed">
          Ao continuar você aceita os{' '}
          <Link href="/termos" className="underline">
            termos de uso
          </Link>{' '}
          e a{' '}
          <Link href="/privacidade" className="underline">
            política de privacidade
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
