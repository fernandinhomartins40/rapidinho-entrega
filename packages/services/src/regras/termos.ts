import { prisma } from '@rapidinho/database';
import { VERSAO_DOS_TERMOS } from '@rapidinho/shared';

/**
 * Versão vigente dos termos: o único lugar que a responde.
 *
 * Assíncrona de propósito: quando o admin passar a publicar versões, a leitura
 * muda para o banco aqui, sem tocar em quem pergunta.
 */
export async function versaoVigenteDosTermos(): Promise<string> {
  return VERSAO_DOS_TERMOS;
}

export async function termosPendentes(userId: string): Promise<boolean> {
  const versao = await versaoVigenteDosTermos();
  const aceite = await prisma.consentRecord.findFirst({
    where: { userId, kind: 'terms', version: versao, granted: true },
    select: { id: true },
  });
  return aceite == null;
}
