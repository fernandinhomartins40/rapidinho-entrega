import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  criarSessaoSemCookie,
  entrarComTelefoneConfirmado,
  ErroDaRota,
  registrarAceiteDosTermos,
  rotaDoApp,
  validarIdTokenDoFirebase,
} from '@rapidinho/auth';
import { clientIpFromHeaders } from '@rapidinho/services';
import { usuarioDoApp } from '@rapidinho/services/regras';
import { normalizePhoneBR, parseServerEnv, RATE_LIMITS } from '@rapidinho/shared';
import type { RespostaEntrar } from '@rapidinho/shared/app-api';
import { lerCorpo, limitarPorIp } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entradaSchema = z.object({ idToken: z.string().min(1).max(8192) });

/**
 * Login do app: o Firebase confirma o telefone e o app troca o idToken pela
 * sessão nossa. O idToken vale só para esta troca, e não é guardado.
 */
export const POST = rotaDoApp(async (request: Request) => {
  const { FIREBASE_PROJECT_ID: projectId } = parseServerEnv();
  if (!projectId) {
    throw new ErroDaRota('Login pelo Firebase desligado.', 'FIREBASE_DESLIGADO');
  }

  await limitarPorIp(request, 'firebase', RATE_LIMITS.appFirebase);

  const { idToken } = await lerCorpo(request, entradaSchema);
  const validacao = await validarIdTokenDoFirebase(idToken, { projectId });

  if (!validacao.ok) {
    if (validacao.motivo === 'indisponivel') {
      throw new ErroDaRota('Não foi possível entrar agora. Tente de novo.', 'FIREBASE_INDISPONIVEL');
    }
    throw new ErroDaRota('Não foi possível confirmar seu telefone.', 'TOKEN_FIREBASE_INVALIDO');
  }

  const telefone = normalizePhoneBR(validacao.telefone);
  if (!telefone) {
    throw new ErroDaRota('Use um celular do Brasil.', 'DADOS_INVALIDOS');
  }

  const entrada = await entrarComTelefoneConfirmado(telefone);
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
