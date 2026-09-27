'use server';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { capturarErro } from '@rapidinho/services';

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
/** A decisão de uma refeição: depois disso a sessão some. */
const HORAS_DE_VALIDADE = 6;
const MAXIMO_DE_PRATOS = 40;

const chaveSchema = z.string().regex(/^[ps]:[a-z0-9-]{10,40}$/i);

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

    const cidade = await prisma.city.findFirst({
      where: { slug: dados.cidadeSlug, isActive: true },
      select: { id: true },
    });
    if (!cidade) return { ok: false, message: 'Cidade indisponível.' };

    // Limpeza de carona: sessões vencidas há mais de um dia saem junto com
    // a criação de uma nova, sem precisar de rotina à parte.
    await prisma.cravingSession.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 3_600_000) } },
    });

    const sessao = await prisma.cravingSession.create({
      data: {
        cityId: cidade.id,
        items: [...new Set(dados.chaves)],
        expiresAt: new Date(Date.now() + HORAS_DE_VALIDADE * 3_600_000),
      },
      select: { id: true },
    });

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

async function sessaoValida(id: string) {
  return prisma.cravingSession.findFirst({
    where: { id, expiresAt: { gt: new Date() } },
    select: { id: true, items: true },
  });
}

export async function votar(entrada: unknown): Promise<{ ok: boolean; message?: string }> {
  const dados = z
    .object({ sessaoId: z.string().min(10).max(40), chave: chaveSchema, gostou: z.boolean() })
    .safeParse(entrada);
  if (!dados.success) return { ok: false, message: 'Voto inválido.' };

  const participante = await participanteAtual();
  if (!participante) return { ok: false, message: 'Diga como quer ser chamado antes de votar.' };

  const sessao = await sessaoValida(dados.data.sessaoId);
  if (!sessao) return { ok: false, message: 'Esta escolha em grupo já acabou.' };

  // Só vale voto em prato do baralho desta sessão.
  const chaves = sessao.items as string[];
  if (!chaves.includes(dados.data.chave)) return { ok: false, message: 'Prato fora do baralho.' };

  await prisma.cravingVote.upsert({
    where: {
      sessionId_participantId_itemKey: {
        sessionId: sessao.id,
        participantId: participante.id,
        itemKey: dados.data.chave,
      },
    },
    update: { liked: dados.data.gostou, nickname: participante.apelido },
    create: {
      sessionId: sessao.id,
      participantId: participante.id,
      nickname: participante.apelido,
      itemKey: dados.data.chave,
      liked: dados.data.gostou,
    },
  });

  return { ok: true };
}

export interface Placar {
  participantes: { apelido: string; votos: number; souEu: boolean }[];
  /** Curtidas por prato, do mais curtido ao menos. */
  curtidas: { chave: string; total: number; quem: string[] }[];
  /** Prato que todos (duas pessoas ou mais) curtiram. */
  match: string | null;
  totalDePratos: number;
  expirada: boolean;
}

export async function placarDaSessao(sessaoId: string): Promise<Placar> {
  const sessao = await prisma.cravingSession.findUnique({
    where: { id: sessaoId },
    select: {
      items: true,
      expiresAt: true,
      votes: { select: { participantId: true, nickname: true, itemKey: true, liked: true } },
    },
  });

  if (!sessao) {
    return { participantes: [], curtidas: [], match: null, totalDePratos: 0, expirada: true };
  }

  const eu = await participanteAtual();
  const porParticipante = new Map<string, { apelido: string; votos: number }>();
  const porPrato = new Map<string, Set<string>>();

  for (const voto of sessao.votes) {
    const atual = porParticipante.get(voto.participantId) ?? { apelido: voto.nickname, votos: 0 };
    atual.votos += 1;
    atual.apelido = voto.nickname;
    porParticipante.set(voto.participantId, atual);
    if (voto.liked) {
      const quem = porPrato.get(voto.itemKey) ?? new Set<string>();
      quem.add(voto.participantId);
      porPrato.set(voto.itemKey, quem);
    }
  }

  const ordem = sessao.items as string[];
  const curtidas = [...porPrato.entries()]
    .map(([chave, quem]) => ({
      chave,
      total: quem.size,
      quem: [...quem].map((id) => porParticipante.get(id)?.apelido ?? 'Alguém'),
    }))
    .sort((a, b) => b.total - a.total || ordem.indexOf(a.chave) - ordem.indexOf(b.chave));

  const pessoas = porParticipante.size;
  const match =
    pessoas >= 2 ? (curtidas.find((linha) => linha.total === pessoas)?.chave ?? null) : null;

  return {
    participantes: [...porParticipante.entries()].map(([id, dados]) => ({
      ...dados,
      souEu: id === eu?.id,
    })),
    curtidas,
    match,
    totalDePratos: ordem.length,
    expirada: sessao.expiresAt <= new Date(),
  };
}
