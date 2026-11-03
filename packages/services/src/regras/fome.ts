import { prisma } from '@rapidinho/database';
import { falha, type Resultado } from './resultado';

/**
 * "Decidir junto": várias pessoas passam o mesmo baralho de pratos pelo mesmo
 * link, e dá match quando todas curtem o mesmo prato. Quem é o participante fica
 * a cargo de quem chama: cookie no site, usuário do token no app.
 */

/** A decisão de uma refeição: depois disso a sessão some. */
const HORAS_DE_VALIDADE = 6;

export const CHAVE_DE_PRATO = /^[ps]:[a-z0-9-]{10,40}$/i;
export const MAXIMO_DE_PRATOS = 40;

export async function criarSessaoDeFome(dados: {
  cidadeSlug: string;
  chaves: string[];
}): Promise<Resultado<{ id: string }>> {
  const cidade = await prisma.city.findFirst({
    where: { slug: dados.cidadeSlug, isActive: true },
    select: { id: true },
  });
  if (!cidade) return falha('Cidade indisponível.', 'NAO_ENCONTRADO');

  // Limpeza de carona: sessões vencidas há mais de um dia saem junto com a
  // criação de uma nova, sem precisar de rotina à parte.
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

  return { ok: true, id: sessao.id };
}

export async function votarNaSessao(dados: {
  sessaoId: string;
  chave: string;
  gostou: boolean;
  participante: { id: string; apelido: string };
}): Promise<Resultado> {
  const sessao = await prisma.cravingSession.findFirst({
    where: { id: dados.sessaoId, expiresAt: { gt: new Date() } },
    select: { id: true, items: true },
  });
  if (!sessao) return falha('Esta escolha em grupo já acabou.', 'NAO_ENCONTRADO');

  // Só vale voto em prato do baralho desta sessão.
  const chaves = sessao.items as string[];
  if (!chaves.includes(dados.chave)) return falha('Prato fora do baralho.', 'DADOS_INVALIDOS');

  await prisma.cravingVote.upsert({
    where: {
      sessionId_participantId_itemKey: {
        sessionId: sessao.id,
        participantId: dados.participante.id,
        itemKey: dados.chave,
      },
    },
    update: { liked: dados.gostou, nickname: dados.participante.apelido },
    create: {
      sessionId: sessao.id,
      participantId: dados.participante.id,
      nickname: dados.participante.apelido,
      itemKey: dados.chave,
      liked: dados.gostou,
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

export async function placarDaSessao(
  sessaoId: string,
  participanteId: string | null,
): Promise<Placar> {
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
      souEu: id === participanteId,
    })),
    curtidas,
    match,
    totalDePratos: ordem.length,
    expirada: sessao.expiresAt <= new Date(),
  };
}
