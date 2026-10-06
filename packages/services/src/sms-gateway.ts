import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '@rapidinho/database';
import { parseServerEnv } from '@rapidinho/shared';
import { gerarHashDeSenha, senhaConfere } from '@rapidinho/shared/senha';
import { getRedis } from './redis';

/**
 * Gateway de SMS: o celular Android da operação que recebe os SMS de
 * confirmação dos clientes e os repassa ao servidor.
 *
 * O app se identifica com `Authorization: Bearer <SMS_GATEWAY_TOKEN>`. A
 * comparação é por hash em tempo constante: o tamanho do token não vaza, e um
 * token errado leva o mesmo tempo para ser recusado que um quase certo.
 */

function hash(valor: string): Buffer {
  return createHash('sha256').update(valor).digest();
}

export function gatewayAutorizado(headers: Headers): boolean {
  const esperado = parseServerEnv().SMS_GATEWAY_TOKEN;
  if (!esperado) return false;

  const recebido = headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  return timingSafeEqual(hash(recebido), hash(esperado));
}

/**
 * Login do app gateway com e-mail e senha: devolve o token quando confere, ou
 * null. O usuário é do banco (criado pelo seed essencial), ativo, admin e com
 * senha; quem entra ganha o poder de confirmar login de qualquer número.
 */
export async function tokenParaLoginDoApp(email: string, senha: string): Promise<string | null> {
  const token = parseServerEnv().SMS_GATEWAY_TOKEN;
  if (!token) return null;

  const usuario = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { passwordHash: true, role: true, status: true, deletedAt: true },
  });

  const autorizado =
    usuario != null &&
    usuario.status === 'ACTIVE' &&
    usuario.deletedAt == null &&
    (usuario.role === 'SUPER_ADMIN' || usuario.role === 'ADMIN');

  // Confere a senha mesmo sem usuário, para o tempo de resposta não revelar
  // quais e-mails existem.
  const senhaCerta = senhaConfere(senha, usuario?.passwordHash ?? hashDeEnchimento());
  return autorizado && senhaCerta ? token : null;
}

let enchimento: string | undefined;
function hashDeEnchimento(): string {
  enchimento ??= gerarHashDeSenha(randomBytes(16).toString('hex'));
  return enchimento;
}

const CHAVE_DO_SINAL = 'sms-gateway:sinal';

export interface SinalDoGateway {
  /** Último contato do app (ISO). */
  em: string;
  versao?: string;
  bateria?: number;
  /** SMS que o app ainda não conseguiu entregar ao servidor. */
  pendentes?: number;
  /** Último SMS de confirmação repassado (ISO). */
  ultimoSms?: string;
}

/** O app avisa que está vivo a cada SMS e de 15 em 15 minutos. */
export async function registrarSinalDoGateway(sinal: Omit<SinalDoGateway, 'em'>): Promise<void> {
  const anterior = await lerSinalDoGateway();
  const atual: SinalDoGateway = {
    ...anterior,
    ...Object.fromEntries(Object.entries(sinal).filter(([, valor]) => valor !== undefined)),
    em: new Date().toISOString(),
  };
  // Uma semana: sinal mais velho que isso não diz nada sobre o app hoje.
  await getRedis().set(CHAVE_DO_SINAL, JSON.stringify(atual), 'EX', 7 * 24 * 3600);
}

export async function lerSinalDoGateway(): Promise<SinalDoGateway | null> {
  const bruto = await getRedis().get(CHAVE_DO_SINAL);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as SinalDoGateway;
  } catch {
    return null;
  }
}
