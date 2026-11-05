import { Logotipo } from '@/components/marca/logo';
import { FormularioDaSenhaNova } from './formulario';

// Estática, a página sai sem o nonce da CSP, o navegador bloqueia os scripts e o
// formulário nunca lê o token: o botão ficava desabilitado para sempre.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Criar senha nova' };

/** Aberta pelo link do e-mail; o token vem no fragmento e é lido no navegador. */
export default function NovaSenhaPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <Logotipo className="mx-auto h-11 w-auto" />
          <h1 className="mt-3 text-xl font-bold">Criar senha nova</h1>
        </header>

        <FormularioDaSenhaNova />
      </div>
    </main>
  );
}
