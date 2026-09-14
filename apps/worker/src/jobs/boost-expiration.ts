import { prisma } from '@rapidinho/database';
import { logger } from '@rapidinho/services';

/**
 * Encerra impulsionamentos vencidos.
 *
 * Roda de hora em hora. A alternativa seria filtrar por data em toda consulta
 * da vitrine — o que funciona, mas deixa o índice trabalhando à toa em cada
 * carregamento da home, que é a página mais acessada do sistema.
 */
export async function expirarImpulsionamentos(): Promise<void> {
  const agora = new Date();

  const { count } = await prisma.storeBoost.updateMany({
    where: { status: 'ACTIVE', endsAt: { lt: agora } },
    data: { status: 'EXPIRED' },
  });

  // Impulsionamento agendado que chegou a hora entra no ar.
  const { count: ativados } = await prisma.storeBoost.updateMany({
    where: { status: 'SCHEDULED', startsAt: { lte: agora }, endsAt: { gt: agora } },
    data: { status: 'ACTIVE' },
  });

  if (count > 0 || ativados > 0) {
    logger.info({ expirados: count, ativados }, '[boost] impulsionamentos atualizados');
  }
}
