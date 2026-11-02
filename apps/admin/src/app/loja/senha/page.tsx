import { requireStoreAccess } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import { Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { FormularioDeSenha } from '@/components/formulario-de-senha';
import { trocarMinhaSenha } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha senha' };

/**
 * Senha do lojista ou funcionário. É o primeiro lugar a visitar depois de
 * receber uma senha provisória da plataforma.
 */
export default async function MinhaSenhaDaLojaPage() {
  const acesso = await requireStoreAccess();
  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: acesso.user.id },
    select: { email: true, passwordHash: true },
  });
  const temSenha = Boolean(usuario.passwordHash);

  return (
    <div className="max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Minha senha</h1>
        <p className="text-muted-foreground">
          {usuario.email
            ? `Para entrar no painel com ${usuario.email}.`
            : 'Sua conta não tem e-mail cadastrado. Peça à equipe Rapidinho para cadastrar.'}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{temSenha ? 'Trocar senha' : 'Criar senha'}</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioDeSenha
            email={usuario.email ?? ''}
            temSenha={temSenha}
            acao={trocarMinhaSenha}
          />
        </CardContent>
      </Card>
    </div>
  );
}
