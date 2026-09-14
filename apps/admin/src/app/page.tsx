import { redirect } from 'next/navigation';
import { getCurrentUser, listAccessibleStores } from '@rapidinho/auth';
import { isPlatformAdmin } from '@rapidinho/shared';

export const dynamic = 'force-dynamic';

/**
 * Porta de entrada do painel: manda cada papel para o seu lugar.
 * O lojista nunca precisa saber que existe uma rota /admin.
 */
export default async function PainelIndexPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/entrar');

  if (isPlatformAdmin(user.role)) {
    redirect('/admin');
  }

  if (user.role === 'COURIER') {
    redirect('/entregador');
  }

  const stores = await listAccessibleStores(user.id);

  if (stores.length === 0) {
    redirect('/cadastro');
  }

  redirect('/loja');
}
