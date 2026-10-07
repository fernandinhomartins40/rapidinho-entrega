import { requireAdmin } from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import { Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { FormularioDeSenha } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Minha senha' };

/**
 * Senha de quem está logado: vale para "entrar com e-mail e senha" no painel
 * e, para a equipe da plataforma, no app Rapidinho SMS.
 */
export default async function MinhaSenhaPage() {
  const admin = await requireAdmin();
  const usuario = await prisma.user.findUniqueOrThrow({
    where: { id: admin.id },
    select: { email: true, passwordHash: true },
  });
  const temSenha = Boolean(usuario.passwordHash);

  return (
    <div className="max-w-lg space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Minha senha</h1>
        <p className="text-muted-foreground">
          {usuario.email
            ? `Para entrar com ${usuario.email} no painel e no app Rapidinho SMS.`
            : 'Sua conta não tem e-mail cadastrado, então a senha ainda não serve para entrar.'}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{temSenha ? 'Trocar senha' : 'Criar senha'}</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioDeSenha email={usuario.email ?? ''} temSenha={temSenha} />
        </CardContent>
      </Card>
    </div>
  );
}
