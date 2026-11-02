'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  autenticarPorSenha,
  cancelarLoginPorSms,
  conferirLoginPorSms,
  createDatabaseSession,
  registrarAceiteDosTermos,
  iniciarLoginPorSms,
  requestOtp,
  verifyOtp,
} from '@rapidinho/auth';
import { prisma } from '@rapidinho/database';
import {
  clientIpFromHeaders,
  consumeRateLimit,
  getOtpSender,
  resetRateLimit,
} from '@rapidinho/services';
import {
  estaNoAppNativo,
  formatPhoneBR,
  linkDoSmsDeConfirmacao,
  parseServerEnv,
  RATE_LIMITS,
  requestOtpSchema,
  textoDoSmsDeConfirmacao,
  verifyOtpSchema,
} from '@rapidinho/shared';
import { LOGIN_INITIAL_STATE, type LoginState } from './login-state';

/**
 * Login do painel.
 *
 * Lojista, funcionário da loja e equipe da plataforma entram com e-mail e
 * senha. Telefone e código por SMS só para o entregador, e só dentro do app
 * nativo: cada código é um SMS pago, e o app guarda a sessão.
 *
 * Mesma proteção de força bruta do app do cliente: o painel é o alvo mais
 * valioso do sistema, não faz sentido protegê-lo menos.
 */

const SO_ENTREGADOR =
  'Este número não é de entregador cadastrado. Lojista e equipe entram com e-mail e senha.';

async function currentIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

async function noAppNativo(): Promise<boolean> {
  return estaNoAppNativo((await headers()).get('user-agent'));
}

/**
 * Confere antes de mandar o SMS, para não pagar envio a quem não entraria.
 * Revela se o número é de entregador — aceitável perto do custo, e o limite
 * por telefone segura quem tentar varrer.
 */
async function ehEntregadorAtivo(phone: string): Promise<boolean> {
  const usuario = await prisma.user.findUnique({
    where: { phone },
    select: { role: true, status: true, deletedAt: true, courier: { select: { status: true } } },
  });
  // O cadastro público em /entregador já cria o usuário como COURIER, com o
  // entregador aguardando aprovação: sem olhar o status do entregador, o
  // candidato recebia SMS pago para uma sessão que o painel recusaria.
  return (
    usuario?.role === 'COURIER' &&
    usuario.status === 'ACTIVE' &&
    !usuario.deletedAt &&
    usuario.courier?.status === 'ACTIVE'
  );
}

export async function autenticar(previous: LoginState, formData: FormData): Promise<LoginState> {
  const intencao = formData.get('intencao');

  if (intencao === 'trocar-telefone') {
    await cancelarLoginPorSms();
    return LOGIN_INITIAL_STATE;
  }

  if (intencao === 'usar-senha') return { step: 'senha' };
  if (intencao === 'entrar-com-senha') return entrarComSenha(formData);

  return intencao === 'verificar' ? verificarCodigo(previous, formData) : solicitarCodigo(formData);
}

async function solicitarCodigo(formData: FormData): Promise<LoginState> {
  if (!(await noAppNativo())) {
    return { step: 'senha', error: 'Entregador entra pelo app Rapidinho no celular.' };
  }

  const parsed = requestOtpSchema.safeParse({ phone: formData.get('phone') });

  if (!parsed.success) {
    return { step: 'phone', error: 'Informe o celular com DDD, por exemplo (44) 99999-8888.' };
  }

  const { phone } = parsed.data;
  const env = parseServerEnv();

  const limit = await consumeRateLimit(
    `otp:request:phone:${phone}`,
    RATE_LIMITS.otpRequest.points,
    RATE_LIMITS.otpRequest.durationSeconds,
  );

  if (!limit.allowed) {
    return {
      step: 'phone',
      error: `Muitas tentativas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} minutos.`,
    };
  }

  if (!(await ehEntregadorAtivo(phone))) {
    return { step: 'phone', error: SO_ENTREGADOR };
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
  if (!(await noAppNativo())) {
    return { step: 'senha', error: 'Entregador entra pelo app Rapidinho no celular.' };
  }

  const parsed = verifyOtpSchema.safeParse({
    phone: previous.phone,
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return { ...previous, error: 'O código tem 6 números.' };
  }

  const { phone, code } = parsed.data;
  const env = parseServerEnv();
  const limitKey = `otp:verify:${phone}:${await currentIp()}`;

  const limit = await consumeRateLimit(
    limitKey,
    RATE_LIMITS.otpVerify.points,
    RATE_LIMITS.otpVerify.durationSeconds,
  );

  if (!limit.allowed) {
    return { ...previous, error: 'Muitas tentativas. Peça um novo código.' };
  }

  const result = await verifyOtp({ phone, code, maxAttempts: env.OTP_MAX_ATTEMPTS });

  if (!result.ok) {
    return { ...previous, error: result.reason };
  }

  // O código só sai para entregador, mas o papel pode ter mudado no meio.
  if (!(await ehEntregadorAtivo(phone))) {
    return { step: 'phone', error: SO_ENTREGADOR };
  }

  await createDatabaseSession(result.userId);
  // O entregador vê o aviso dos termos nesta tela: é aqui que o aceite é dele.
  await registrarAceiteDosTermos(result.userId, await currentIp());
  await resetRateLimit(limitKey);

  // O destino chega do formulário, mas quem decide o que o usuário pode ver é
  // a rota "/" do painel, conforme o papel — nunca este parâmetro.
  //
  // `//evil.com` começa com "/" e o navegador trata como URL absoluta de
  // mesmo protocolo: sem a segunda checagem isto seria um redirecionamento
  // aberto para quem montasse o link de login.
  const destino = String(formData.get('destino') ?? '/');
  redirect(destino.startsWith('/') && !destino.startsWith('//') ? destino : '/');
}

/**
 * E-mail e senha: lojista, funcionário da loja e equipe da plataforma.
 * Limite por IP e por e-mail, como no código.
 */
async function entrarComSenha(formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const senha = String(formData.get('senha') ?? '');

  if (!email || !senha) {
    return { step: 'senha', email, error: 'Preencha e-mail e senha.' };
  }

  const chaves = [`senha:ip:${await currentIp()}`, `senha:email:${email}`];
  for (const chave of chaves) {
    const limit = await consumeRateLimit(
      chave,
      RATE_LIMITS.senhaLogin.points,
      RATE_LIMITS.senhaLogin.durationSeconds,
    );
    if (!limit.allowed) {
      return {
        step: 'senha',
        email,
        error: `Muitas tentativas. Tente de novo em ${Math.ceil(limit.retryAfterSeconds / 60)} minutos.`,
      };
    }
  }

  const userId = await autenticarPorSenha(email, senha);
  if (!userId) {
    return { step: 'senha', email, error: 'E-mail ou senha incorretos.' };
  }

  await createDatabaseSession(userId);
  for (const chave of chaves) await resetRateLimit(chave);

  const destino = String(formData.get('destino') ?? '/');
  redirect(destino.startsWith('/') && !destino.startsWith('//') ? destino : '/');
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
  const resultado = await conferirLoginPorSms();
  if (resultado.status !== 'ok') return resultado;

  // Só caminho interno: destino absoluto viraria redirecionamento aberto.
  return {
    status: 'ok',
    destino: destino.startsWith('/') && !destino.startsWith('//') ? destino : '/',
  };
}
