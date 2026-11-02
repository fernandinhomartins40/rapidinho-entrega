import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { getCurrentUser } from '@rapidinho/auth';
import { buttonVariants, Card, CardContent } from '@rapidinho/ui';
import { Logotipo } from '@/components/marca/logo';
import { estaNoAppNativo, LINK_DO_APK, parseServerEnv } from '@rapidinho/shared';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entrar' };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const user = await getCurrentUser();
  const provedor = parseServerEnv().OTP_PROVIDER;
  const porSms = provedor === 'sms-reverso';
  const canal = provedor === 'whatsapp' ? 'WhatsApp' : 'SMS';
  const noApp = estaNoAppNativo((await headers()).get('user-agent'));
  const { destino } = await searchParams;

  if (user) redirect(destino ?? '/');

  if (!noApp) return <BaixeOApp />;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <Link href="/">
            <Logotipo className="mx-auto h-11 w-auto" priority />
          </Link>
          <h1 className="mt-4 text-xl font-bold">Entre com seu telefone</h1>
          <p className="text-muted-foreground mt-1">
            Sem senha e sem cadastro demorado.{' '}
            {porSms
              ? 'Você confirma o número com um SMS do seu celular.'
              : `Você recebe um código por ${canal} e não precisa entrar de novo.`}
          </p>
        </header>

        <LoginForm destino={destino ?? '/'} porSms={porSms} canal={canal} />

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

/**
 * Fora do app nativo não há login: o código por SMS é pago, e só o app guarda
 * a sessão para sempre. O cardápio e as lojas continuam abertos no site.
 */
function BaixeOApp() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <Link href="/">
          <Logotipo className="mx-auto h-11 w-auto" priority />
        </Link>
        <h1 className="mt-4 text-xl font-bold">Entre pelo app Rapidinho</h1>
        <p className="text-muted-foreground mt-1">
          Você confirma o número uma vez por SMS e fica conectado, sem senha.
        </p>

        <Card className="mt-6">
          <CardContent className="space-y-3 pt-5">
            <a href={LINK_DO_APK} download className={buttonVariants({ block: true })}>
              <Download className="h-4 w-4" aria-hidden />
              Baixar o app para Android
            </a>
            <p className="text-muted-foreground text-sm">
              Depois de baixar, toque no arquivo para instalar. Se o celular pedir, permita instalar
              apps desta fonte.
            </p>
          </CardContent>
        </Card>

        <Link href="/" className="text-muted-foreground mt-6 inline-block text-sm underline">
          Continuar vendo as lojas
        </Link>
      </div>
    </main>
  );
}
