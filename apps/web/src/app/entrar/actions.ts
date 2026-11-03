'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  cancelarLoginPorSms,
  conferirLoginPorSms,
  createDatabaseSession,
  iniciarLoginPorSms,
  limitarConferenciaDeCodigo,
  limitarPedidoDeCodigo,
  registrarAceiteDosTermos,
  requestOtp,
  verifyOtp,
} from '@rapidinho/auth';
import { clientIpFromHeaders, getOtpSender, resetRateLimit } from '@rapidinho/services';
import {
  parseServerEnv,
  destinoInterno,
  formatPhoneBR,
  linkDoSmsDeConfirmacao,
  requestOtpSchema,
  estaNoAppNativo,
  verifyOtpSchema,
  textoDoSmsDeConfirmacao,
} from '@rapidinho/shared';
import { LOGIN_INITIAL_STATE, type LoginState } from './login-state';

/**
 * Login do cliente por telefone e código.
 *
 * Sem e-mail e sem senha: no interior, exigir cadastro completo antes da
 * primeira compra é a maior causa de desistência. O usuário é criado no
 * primeiro código confirmado; nome e termos vêm depois, no checkout.
 *
 * Mesma proteção de força bruta do painel — o limite é por telefone E por IP,
 * porque travar só por IP não protege um número alvo, e o contrário deixa
 * passar quem varre vários números do mesmo lugar.
 *
 * Só dentro do app nativo: cada código é um SMS pago, e o app guarda a sessão
 * para o cliente nunca precisar de outro. A página já mostra o convite para
 * baixar o app; a checagem aqui cobre quem chama a action direto.
 */

const SO_NO_APP = 'Para entrar, use o app Rapidinho no celular.';

async function currentIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

async function noAppNativo(): Promise<boolean> {
  return estaNoAppNativo((await headers()).get('user-agent'));
}

export async function autenticar(previous: LoginState, formData: FormData): Promise<LoginState> {
  const intencao = formData.get('intencao');

  if (intencao === 'trocar-telefone') {
    await cancelarLoginPorSms();
    return LOGIN_INITIAL_STATE;
  }

  return intencao === 'verificar' ? verificarCodigo(previous, formData) : solicitarCodigo(formData);
}

async function solicitarCodigo(formData: FormData): Promise<LoginState> {
  if (!(await noAppNativo())) return { step: 'phone', error: SO_NO_APP };

  const parsed = requestOtpSchema.safeParse({ phone: formData.get('phone') });

  if (!parsed.success) {
    return { step: 'phone', error: 'Informe o celular com DDD, por exemplo (44) 99999-8888.' };
  }

  const { phone } = parsed.data;
  const env = parseServerEnv();

  const limite = await limitarPedidoDeCodigo(phone, await currentIp());

  if (!limite.permitido) {
    const espera = limite.esperaSegundos;
    return {
      step: 'phone',
      error: `Muitas tentativas. Tente de novo em ${Math.ceil(espera / 60)} minutos.`,
    };
  }

  // Confirmação reversa: o cliente envia o SMS, a operação não paga envio.
  if (env.OTP_PROVIDER === 'sms-reverso' && env.SMS_GATEWAY_NUMBER) {
    const pedido = await iniciarLoginPorSms({
      phone,
      ttlSeconds: env.OTP_TTL_SECONDS,
      requestIp: await currentIp(),
    });

    return {
      step: 'sms',
      phone,
      sms: {
        texto: textoDoSmsDeConfirmacao(pedido.code),
        link: linkDoSmsDeConfirmacao(env.SMS_GATEWAY_NUMBER, pedido.code),
        numero: formatPhoneBR(env.SMS_GATEWAY_NUMBER),
      },
    };
  }

  const result = await requestOtp({
    phone,
    sender: getOtpSender(),
    ttlSeconds: env.OTP_TTL_SECONDS,
    requestIp: await currentIp(),
    exposeCode: env.NODE_ENV === 'development',
  });

  return { step: 'code', phone, ...(result.code ? { devCode: result.code } : {}) };
}

async function verificarCodigo(previous: LoginState, formData: FormData): Promise<LoginState> {
  if (!(await noAppNativo())) return { ...previous, error: SO_NO_APP };

  const parsed = verifyOtpSchema.safeParse({
    phone: previous.phone,
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return { ...previous, error: 'O código tem 6 números.' };
  }

  const { phone, code } = parsed.data;
  const env = parseServerEnv();
  const { permitido, chave: limitKey } = await limitarConferenciaDeCodigo(phone, await currentIp());

  if (!permitido) {
    return { ...previous, error: 'Muitas tentativas. Peça um novo código.' };
  }

  const result = await verifyOtp({ phone, code, maxAttempts: env.OTP_MAX_ATTEMPTS });

  if (!result.ok) {
    return { ...previous, error: result.reason };
  }

  await createDatabaseSession(result.userId);
  await registrarAceiteDosTermos(result.userId, await currentIp());
  await resetRateLimit(limitKey);

  // Só caminho interno: um destino absoluto viraria redirecionamento aberto,
  // de graça, para quem montar o link.
  const destino = String(formData.get('destino') ?? '/');
  redirect(destinoInterno(destino));
}

/**
 * A tela de confirmação por SMS pergunta isto de tempos em tempos. Quando o
 * SMS chegou, a sessão já sai criada daqui e a tela só segue para o destino.
 */
export async function conferirSms(
  destino: string,
): Promise<
  { status: 'ok'; destino: string } | { status: 'aguardando' } | { status: 'erro'; reason: string }
> {
  if (!(await noAppNativo())) return { status: 'erro', reason: SO_NO_APP };

  const resultado = await conferirLoginPorSms();
  if (resultado.status !== 'ok') return resultado;

  // Só caminho interno: destino absoluto viraria redirecionamento aberto.
  return {
    status: 'ok',
    destino: destinoInterno(destino),
  };
}
