import { NextResponse } from 'next/server';
import { z } from 'zod';
import { exigirUsuarioDoToken, rotaDoApp } from '@rapidinho/auth';
import {
  atualizarItensQueOdeio,
  atualizarNome,
  excluirConta,
  usuarioDoApp,
} from '@rapidinho/services/regras';
import { exigirOk, lerCorpo, limitarEscrita, naoEncontrado, okCom } from '@/lib/api-do-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const atualizacaoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome').max(120).optional(),
  itensQueOdeio: z
    .array(z.string().trim().min(2, 'Escreva o nome do item').max(30, 'Use até 30 letras'))
    .max(15, 'Escolha até 15 itens')
    .optional(),
});

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

  const { nome, itensQueOdeio } = await lerCorpo(request, atualizacaoSchema);
  if (nome) await atualizarNome(user.id, nome);
  if (itensQueOdeio) await atualizarItensQueOdeio(user.id, itensQueOdeio);

  return responderUsuario(user.id);
});

export const DELETE = rotaDoApp(async (request: Request) => {
  const user = await exigirUsuarioDoToken(request);
  await limitarEscrita(user);

  return okCom(exigirOk(await excluirConta(user.id)));
});
