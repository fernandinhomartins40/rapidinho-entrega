import { redirect } from 'next/navigation';
import { getCurrentUser } from '@rapidinho/auth';
import { isPlatformAdmin } from '@rapidinho/shared';
import { AdminShell } from '@/components/admin-shell';

export const dynamic = 'force-dynamic';

/**
 * Tudo sob /admin exige papel de plataforma.
 *
 * A checagem é no servidor, no layout: o middleware só sabe que existe um
 * cookie de sessão, não de quem é.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect('/entrar?destino=/admin');
  if (!isPlatformAdmin(user.role)) redirect('/');

  return <AdminShell user={user}>{children}</AdminShell>;
}
