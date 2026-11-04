import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  criarSessaoSemCookie,
  entrarComTelefoneConfirmado,
  ErroDaRota,
  registrarAceiteDosTermos,
  rotaDoApp,
} from '@rapidinho/auth';
import { clientIpFromHeaders } from '@rapidinho/services';
import { usuarioDoApp } from '@rapidinho/services/regras';
import { normalizePhoneBR, parseServerEnv, RATE_LIMITS } from '@rapidinho/shared';
import type { RespostaEntrar } from '@rapidinho/shared/app-api';
import { lerCorpo, limitarPorIp } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({
  telefone: z.string().min(1).max(32),
  codigo: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

/**
 * Conta de revisão da Google Play.
 *
 * O revisor não recebe SMS, então o número fictício de `APP_REVISAO_TELEFONE`
 * entra com o código fixo de `APP_REVISAO_CODIGO`, que só existe no `.env` da
 * VPS. Sem código no corpo, a rota só diz se o número é o de revisão (o app
 * pula o Firebase); com código, cria a sessão como `auth/firebase` faria.
 */
export const POST = rotaDoApp(async (request: Request) => {
  await limitarPorIp(request, 'revisao', RATE_LIMITS.appFirebase);

  const { APP_REVISAO_TELEFONE, APP_REVISAO_CODIGO } = parseServerEnv();
  const { telefone, codigo } = await lerCorpo(request, entradaSchema);

  const daRevisao = APP_REVISAO_TELEFONE ? normalizePhoneBR(APP_REVISAO_TELEFONE) : null;
  const ehRevisao =
    daRevisao != null && APP_REVISAO_CODIGO != null && normalizePhoneBR(telefone) === daRevisao;

  if (codigo === undefined) return NextResponse.json({ revisao: ehRevisao });

  if (!ehRevisao || !mesmoCodigo(codigo, APP_REVISAO_CODIGO!)) {
    throw new ErroDaRota('Código errado. Confira e tente de novo.', 'DADOS_INVALIDOS');
  }

  const entrada = await entrarComTelefoneConfirmado(daRevisao);
  if (!entrada.ok) throw new ErroDaRota(entrada.reason, 'PROIBIDO');

  const { sessionToken, expires } = await criarSessaoSemCookie(entrada.userId);
  await registrarAceiteDosTermos(entrada.userId, clientIpFromHeaders(request.headers));

  const usuario = await usuarioDoApp(entrada.userId);
  if (!usuario) throw new ErroDaRota('Conta não encontrada.', 'NAO_ENCONTRADO');

  const resposta: RespostaEntrar = {
    token: sessionToken,
    expiraEm: expires.toISOString(),
    usuario,
    novoUsuario: entrada.isNewUser,
  };

  return NextResponse.json(resposta);
});

function mesmoCodigo(digitado: string, esperado: string) {
  const a = Buffer.from(digitado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
