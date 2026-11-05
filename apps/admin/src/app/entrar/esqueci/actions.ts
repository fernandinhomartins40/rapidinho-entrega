'use server';

import { headers } from 'next/headers';
import { clientIpFromHeaders, consumeRateLimit } from '@rapidinho/services';
import { parsePublicEnv, RATE_LIMITS } from '@rapidinho/shared';
import type { ActionResult } from '@/lib/action-state';
import {
  MINIMO_DA_SENHA,
  enviarLinkDeRecuperacao,
  redefinirSenhaComToken,
} from '@/lib/recuperar-senha';

/** Mesma resposta exista ou não a conta: a tela não confirma e-mail cadastrado. */
const RESPOSTA =
  'Se este e-mail tiver acesso ao painel, enviamos um link para criar uma senha nova. Confira a caixa de entrada e o spam.';

export async function pedirLinkDeSenha(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, fieldErrors: { email: 'Confira o e-mail.' } };
  }

  // Por IP e por e-mail: ninguém lota a caixa de outra pessoa nem varre e-mails.
  const ip = clientIpFromHeaders(await headers());
  for (const chave of [`senha:recuperar:ip:${ip}`, `senha:recuperar:email:${email}`]) {
    const limite = await consumeRateLimit(
      chave,
      RATE_LIMITS.senhaLogin.points,
      RATE_LIMITS.senhaLogin.durationSeconds,
    );
    if (!limite.allowed) {
      return { ok: false, message: 'Muitos pedidos. Espere alguns minutos e tente de novo.' };
    }
  }

  await enviarLinkDeRecuperacao(email, parsePublicEnv(process.env).NEXT_PUBLIC_ADMIN_URL);
  return { ok: true, message: RESPOSTA };
}

export async function salvarSenhaNova(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const token = String(formData.get('token') ?? '');
  const nova = String(formData.get('nova') ?? '');
  const confirmacao = String(formData.get('confirmacao') ?? '');

  if (nova.length < MINIMO_DA_SENHA) {
    return { ok: false, fieldErrors: { nova: `Use pelo menos ${MINIMO_DA_SENHA} caracteres.` } };
  }
  if (nova !== confirmacao) {
    return { ok: false, fieldErrors: { confirmacao: 'As duas senhas não são iguais.' } };
  }

  const ip = clientIpFromHeaders(await headers());
  const limite = await consumeRateLimit(
    `senha:nova:ip:${ip}`,
    RATE_LIMITS.senhaLogin.points,
    RATE_LIMITS.senhaLogin.durationSeconds,
  );
  if (!limite.allowed) return { ok: false, message: 'Muitas tentativas. Espere alguns minutos.' };

  const erro = await redefinirSenhaComToken(token, nova);
  return erro
    ? { ok: false, message: erro }
    : { ok: true, message: 'Senha criada. Já pode entrar com o seu e-mail e a senha nova.' };
}
