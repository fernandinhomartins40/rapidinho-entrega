'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { capturarErro } from '@rapidinho/services';
import {
  CHAVE_DE_PRATO,
  criarSessaoDeFome,
  MAXIMO_DE_PRATOS,
  placarDaSessao as lerPlacar,
  votarNaSessao,
  type Placar,
} from '@rapidinho/services/regras';

/**
 * "Decidir junto": várias pessoas passam o mesmo baralho de pratos pelo mesmo
 * link, e dá match quando todas curtem o mesmo prato.
 *
 * Ninguém precisa de conta para participar — quem recebe o link no WhatsApp
 * só diz como quer ser chamado. O participante é um id aleatório num cookie
 * httpOnly; o voto só vale para os pratos daquele baralho e só enquanto a
 * sessão não expira.
 */

const COOKIE_DO_PARTICIPANTE = 'rapidinho_fome_participante';
const COOKIE_DO_APELIDO = 'rapidinho_fome_apelido';

const chaveSchema = z.string().regex(CHAVE_DE_PRATO);

export type RespostaDaSessao = { ok: true; id: string } | { ok: false; message: string };

export async function criarSessaoEmGrupo(entrada: unknown): Promise<RespostaDaSessao> {
  try {
    const dados = z
      .object({
        cidadeSlug: z.string().min(1).max(80),
        chaves: z.array(chaveSchema).min(2).max(MAXIMO_DE_PRATOS),
        apelido: z.string().trim().min(1).max(24),
      })
      .parse(entrada);

    const sessao = await criarSessaoDeFome(dados);
    if (!sessao.ok) return { ok: false, message: sessao.message };

    await identificar(dados.apelido);
    return { ok: true, id: sessao.id };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: 'Dados inválidos.' };
    void capturarErro(error, { origem: 'fome-criar-sessao' });
    return { ok: false, message: 'Não foi possível criar agora. Tente de novo.' };
  }
}

/** Guarda quem é o participante neste aparelho. */
async function identificar(apelido: string): Promise<void> {
  const jar = await cookies();
  const opcoes = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  };
  if (!jar.get(COOKIE_DO_PARTICIPANTE)?.value) {
    jar.set(COOKIE_DO_PARTICIPANTE, randomUUID(), opcoes);
  }
  jar.set(COOKIE_DO_APELIDO, encodeURIComponent(apelido.trim().slice(0, 24)), opcoes);
}

export async function entrarNaSessao(apelido: string): Promise<{ ok: boolean; message?: string }> {
  const valido = z.string().trim().min(1).max(24).safeParse(apelido);
  if (!valido.success) return { ok: false, message: 'Diga como quer ser chamado.' };
  await identificar(valido.data);
  return { ok: true };
}

/** Quem é este aparelho na sessão, se já se identificou. */
export async function participanteAtual(): Promise<{ id: string; apelido: string } | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE_DO_PARTICIPANTE)?.value;
  const apelido = jar.get(COOKIE_DO_APELIDO)?.value;
  if (!id || !apelido) return null;
  return { id, apelido: decodeURIComponent(apelido) };
}

export async function votar(entrada: unknown): Promise<{ ok: boolean; message?: string }> {
  const dados = z
    .object({ sessaoId: z.string().min(10).max(40), chave: chaveSchema, gostou: z.boolean() })
    .safeParse(entrada);
  if (!dados.success) return { ok: false, message: 'Voto inválido.' };

  const participante = await participanteAtual();
  if (!participante) return { ok: false, message: 'Diga como quer ser chamado antes de votar.' };

  return votarNaSessao({ ...dados.data, participante });
}

export type { Placar };

export async function placarDaSessao(sessaoId: string): Promise<Placar> {
  const eu = await participanteAtual();
  return lerPlacar(sessaoId, eu?.id ?? null);
}
