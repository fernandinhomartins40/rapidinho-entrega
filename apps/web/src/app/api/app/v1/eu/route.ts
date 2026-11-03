import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import { atualizarNome, excluirConta, usuarioDoApp } from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita, naoEncontrado, okCom } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nomeSchema = z.object({ nome: z.string().trim().min(2, 'Informe seu nome').max(120) });

async function responderUsuario(userId: string) {
  const usuario = await usuarioDoApp(userId);
  if (!usuario) throw naoEncontrado('Conta não encontrada.');
  return NextResponse.json(usuario);
}

export const GET = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  return responderUsuario(user.id);
});

export const PATCH = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  const { nome } = await lerCorpo(request, nomeSchema);
  await atualizarNome(user.id, nome);

  return responderUsuario(user.id);
});

export const DELETE = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  return okCom(exigirOk(await excluirConta(user.id)));
});
