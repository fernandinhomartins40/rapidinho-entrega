import { PrismaClient } from '../generated/client';

/**
 * Singleton do Prisma. Em desenvolvimento o hot-reload do Next recria os
 * módulos a cada alteração; sem o cache global isso abriria uma conexão nova
 * a cada reload até estourar o pool do Postgres.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
