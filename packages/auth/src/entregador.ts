import { prisma } from '@rapidinho/database';
import { AuthorizationError } from './erros';

/** Cadastro do entregador, aprovado ou não. Base das duas conferências abaixo. */
export async function cadastroDeEntregador(userId: string): Promise<string> {
  const courier = await prisma.courier.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!courier) throw new AuthorizationError('Cadastro de entregador não encontrado');

  return courier.id;
}

/** Entregador aprovado: quem ainda não foi conferido não pega corrida. */
export async function conferirEntregador(userId: string): Promise<string> {
  const courier = await prisma.courier.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });

  if (!courier) throw new AuthorizationError('Cadastro de entregador não encontrado');
  if (courier.status !== 'ACTIVE') {
    throw new AuthorizationError('Seu cadastro de entregador ainda não foi aprovado');
  }

  return courier.id;
}
