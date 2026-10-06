import { redirect } from 'next/navigation';
import { MessageSquare, Smartphone } from 'lucide-react';
import { AuthorizationError, requireSuperAdmin } from '@rapidinho/auth';
import { lerSinalDoGateway } from '@rapidinho/services';
import { formatPhoneBR, parseServerEnv } from '@rapidinho/shared';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { Indicador } from '@/components/indicador';
import { TokenDoGateway } from './token';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Login por SMS' };

/** Sem sinal há mais que isto, o celular provavelmente está desligado. */
const MINUTOS_SEM_SINAL = 40;

function haQuanto(iso: string | undefined): string {
  if (!iso) return 'nunca';
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas < 48 ? `há ${horas} h` : `há ${Math.floor(horas / 24)} dias`;
}

/**
 * Celular gateway da confirmação reversa por SMS.
 *
 * Só o super admin: a página mostra o token do app, que permite confirmar o
 * login de qualquer número. Quem o tiver pode se passar pelo gateway.
 */
export default async function SmsGatewayPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/admin');
    throw error;
  }

  const env = parseServerEnv();
  const sinal = await lerSinalDoGateway();
  const ativo = env.OTP_PROVIDER === 'sms-reverso';
  const minutosSemSinal = sinal
    ? Math.floor((Date.now() - new Date(sinal.em).getTime()) / 60_000)
    : null;
  const online = minutosSemSinal != null && minutosSemSinal < MINUTOS_SEM_SINAL;
  const servidor = process.env.NEXT_PUBLIC_WEB_URL ?? '';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Login por SMS</h1>
        <p className="text-muted-foreground max-w-2xl">
          O cliente confirma o número enviando um SMS do celular dele para o celular da operação. O
          app Android desse celular repassa o SMS ao servidor. A plataforma não paga envio.
        </p>
      </header>

      {!ativo ? (
        <Alert variant="warning" title="Desligado">
          O login ainda usa o código enviado pela plataforma (OTP_PROVIDER=
          {env.OTP_PROVIDER}). Para ligar, cadastre o secret SMS_GATEWAY_NUMBER no GitHub com o
          número do celular gateway e faça um deploy.
        </Alert>
      ) : !online ? (
        <Alert variant="destructive" title="Celular gateway sem sinal">
          Sem sinal {haQuanto(sinal?.em)}. Enquanto o app não aparecer, os clientes não conseguem
          entrar. Confira se o celular está ligado, com internet e com o app aberto ao menos uma vez
          desde que ligou.
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Indicador
          titulo="Celular gateway"
          valor={env.SMS_GATEWAY_NUMBER ? formatPhoneBR(env.SMS_GATEWAY_NUMBER) : '—'}
          detalhe={online ? 'Online' : 'Sem sinal'}
          icone={Smartphone}
        />
        <Indicador
          titulo="Último sinal"
          valor={haQuanto(sinal?.em)}
          detalhe={sinal?.bateria != null ? `Bateria ${sinal.bateria}%` : undefined}
          icone={Smartphone}
        />
        <Indicador
          titulo="Último login por SMS"
          valor={haQuanto(sinal?.ultimoSms)}
          detalhe={sinal?.pendentes ? `${sinal.pendentes} SMS esperando internet` : 'Nada pendente'}
          icone={MessageSquare}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Configurar o app
            {sinal?.versao ? <Badge variant="secondary">versão {sinal.versao}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Instale o app &quot;Rapidinho SMS&quot; no celular do número acima.</li>
            <li>
              Abra <strong>esta página no próprio celular</strong> e toque em &quot;Configurar o app
              neste celular&quot;.
            </li>
            <li>No app, permita receber SMS e tire o app da economia de bateria.</li>
          </ol>
          {env.SMS_GATEWAY_TOKEN ? (
            <TokenDoGateway servidor={servidor} token={env.SMS_GATEWAY_TOKEN} />
          ) : (
            <p className="text-muted-foreground">
              Token ainda não gerado: ele é criado no próximo deploy.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
