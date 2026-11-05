import Link from 'next/link';
import { Logotipo } from '@/components/marca/logo';
import { FormularioDoEmail } from './formulario';

// Sem isso a página sai estática, sem o nonce da CSP, e os scripts não rodam.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Esqueci minha senha' };

export default function EsqueciPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <Logotipo className="mx-auto h-11 w-auto" />
          <h1 className="mt-3 text-xl font-bold">Esqueci minha senha</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Digite o e-mail que você usa para entrar no painel. Mandamos um link para criar uma
            senha nova.
          </p>
        </header>

        <FormularioDoEmail />

        <p className="mt-6 text-center text-sm">
          <Link href="/entrar" className="underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </main>
  );
}
