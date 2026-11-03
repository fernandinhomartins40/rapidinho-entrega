import { decodeProtectedHeader, errors, importX509, jwtVerify, type KeyLike } from 'jose';

/**
 * Validação do idToken do Firebase Phone Auth, sem service account nem
 * firebase-admin: só a assinatura e as claims, contra as chaves públicas que o
 * Google publica. O token prova a posse do telefone uma vez; a sessão continua
 * sendo a nossa, e ele não é guardado nem registrado em log.
 */

const URL_DAS_CHAVES =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** Relógio de dois servidores nunca bate exato. */
const FOLGA_DE_RELOGIO_SEGUNDOS = 5;

export type ValidacaoDoFirebase =
  | { ok: true; telefone: string }
  /** `indisponivel`: não deu para buscar as chaves, e o token pode estar certo. */
  | { ok: false; motivo: 'invalido' | 'indisponivel' };

interface CacheDeChaves {
  certificados: Record<string, string>;
  validoAte: number;
}

let cache: CacheDeChaves | null = null;

/** Para os testes: cada um começa sem chaves em memória. */
export function esquecerChavesDoFirebase(): void {
  cache = null;
}

/** `max-age` do Cache-Control em segundos; 0 quando não há. */
export function maxAgeDoCacheControl(valor: string | null): number {
  const achado = /(?:^|[\s,])max-age=(\d+)/i.exec(valor ?? '');
  return achado ? Number(achado[1]) : 0;
}

async function certificadosAtuais(
  buscar: typeof fetch,
  agoraMs: number,
): Promise<Record<string, string>> {
  if (cache && cache.validoAte > agoraMs) return cache.certificados;

  const resposta = await buscar(URL_DAS_CHAVES, { signal: AbortSignal.timeout(5_000) });
  if (!resposta.ok) throw new Error(`Chaves do Firebase: HTTP ${resposta.status}`);

  const certificados = (await resposta.json()) as Record<string, string>;
  cache = {
    certificados,
    validoAte: agoraMs + maxAgeDoCacheControl(resposta.headers.get('cache-control')) * 1000,
  };

  return certificados;
}

export async function validarIdTokenDoFirebase(
  idToken: string,
  opcoes: {
    projectId: string;
    /** Trocados nos testes, que nunca chamam o Google. */
    buscar?: typeof fetch;
    agora?: Date;
  },
): Promise<ValidacaoDoFirebase> {
  const agora = opcoes.agora ?? new Date();

  let kid: string | undefined;
  try {
    ({ kid } = decodeProtectedHeader(idToken));
  } catch {
    return { ok: false, motivo: 'invalido' };
  }
  if (!kid) return { ok: false, motivo: 'invalido' };

  let certificados: Record<string, string>;
  try {
    certificados = await certificadosAtuais(opcoes.buscar ?? fetch, agora.getTime());
  } catch {
    return { ok: false, motivo: 'indisponivel' };
  }

  const certificado = certificados[kid];
  if (!certificado) return { ok: false, motivo: 'invalido' };

  try {
    const chave: KeyLike = await importX509(certificado, 'RS256');

    const { payload } = await jwtVerify(idToken, chave, {
      // Lista fechada: sem ela, um token `alg: none` ou HS256 chegaria à conferência.
      algorithms: ['RS256'],
      audience: opcoes.projectId,
      issuer: `https://securetoken.google.com/${opcoes.projectId}`,
      requiredClaims: ['exp', 'iat', 'auth_time', 'sub'],
      currentDate: agora,
      clockTolerance: FOLGA_DE_RELOGIO_SEGUNDOS,
    });

    const limite = agora.getTime() / 1000 + FOLGA_DE_RELOGIO_SEGUNDOS;
    const { iat, auth_time: autenticadoEm, sub, phone_number: telefone } = payload;

    // O jose só confere `exp`: emissão no futuro é token forjado ou relógio torto.
    if (typeof iat !== 'number' || iat > limite) return { ok: false, motivo: 'invalido' };
    if (typeof autenticadoEm !== 'number' || autenticadoEm > limite) {
      return { ok: false, motivo: 'invalido' };
    }
    if (typeof sub !== 'string' || sub === '') return { ok: false, motivo: 'invalido' };
    if (typeof telefone !== 'string' || telefone === '') return { ok: false, motivo: 'invalido' };

    return { ok: true, telefone };
  } catch (erro) {
    if (erro instanceof errors.JOSEError || erro instanceof TypeError) {
      return { ok: false, motivo: 'invalido' };
    }
    throw erro;
  }
}
