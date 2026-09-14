import { redirect } from 'next/navigation';
import { AuthorizationError } from '@rapidinho/auth';
import { LojaShell } from '@/components/loja-shell';
import { getStoreContext } from '@/lib/store-context';

export const dynamic = 'force-dynamic';

/**
 * Tudo sob /loja exige vínculo com uma loja.
 *
 * `getStoreContext` resolve a loja pelo vínculo do usuário — nunca por um id
 * na URL —, então não há como um lojista abrir o painel de outra loja trocando
 * o endereço.
 */
export default async function LojaLayout({ children }: { children: React.ReactNode }) {
  let contexto;

  try {
    contexto = await getStoreContext();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.status === 401 ? '/entrar?destino=/loja' : '/');
    }
    throw error;
  }

  return (
    <LojaShell
      loja={{
        nome: contexto.store.name,
        estaAberta: contexto.abertura.isOpen,
        pausadaAte: contexto.store.isPausedUntil,
      }}
      user={{ name: contexto.access.user.name, phone: contexto.access.user.phone }}
      comoAdmin={contexto.access.isPlatformAdmin}
      pedidosAbertos={contexto.pedidosAbertos}
    >
      {children}
    </LojaShell>
  );
}
