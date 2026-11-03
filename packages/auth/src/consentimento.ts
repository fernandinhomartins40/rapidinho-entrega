import { prisma } from '@rapidinho/database';
// Subcaminho: o barril de `services` carrega fila e S3, sem nada a ver com isto.
import { versaoVigenteDosTermos } from '@rapidinho/services/regras/termos';

/**
 * Grava a ciência dos termos de uso e da política de privacidade.
 *
 * A tela de login diz "Ao continuar você aceita os termos": é o momento em que
 * a pessoa viu o aviso, então é aqui que fica a prova (LGPD art. 8º §2º cabe
 * ao controlador provar). O histórico vai em `ConsentRecord`, com versão e IP;
 * os campos de `User` guardam a primeira data, para quem já os lê.
 *
 * Idempotente por versão: logar de novo não duplica o registro, e uma versão
 * nova dos termos gera um registro novo no próximo login.
 */
export async function registrarAceiteDosTermos(userId: string, ipAddress?: string | null) {
  const versao = await versaoVigenteDosTermos();
  const jaRegistrado = await prisma.consentRecord.findFirst({
    where: { userId, kind: 'terms', version: versao, granted: true },
    select: { id: true },
  });
  if (jaRegistrado) return;

  const agora = new Date();
  await prisma.$transaction([
    prisma.consentRecord.createMany({
      data: [
        { userId, kind: 'terms', version: versao, granted: true, ipAddress },
        { userId, kind: 'privacy', version: versao, granted: true, ipAddress },
      ],
    }),
    prisma.user.updateMany({
      where: { id: userId, acceptedTermsAt: null },
      data: { acceptedTermsAt: agora, acceptedPrivacyAt: agora },
    }),
  ]);
}
