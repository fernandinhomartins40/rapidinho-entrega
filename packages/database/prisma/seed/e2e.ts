import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient, type Prisma } from '../../generated/client';

loadEnv({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

/**
 * Deixa todas as lojas abertas o dia inteiro, todos os dias — só para o e2e.
 *
 * O seed usa horários de comércio de verdade (8h–20h, jantar 18h–23h). Com
 * eles, o teste de pedido passava ou falhava conforme a hora em que o CI
 * rodava: entre 23h e 8h não há loja aberta, a vitrine não mostra "Abertas
 * agora" e o checkout recusa o pedido. O teste verifica o fluxo de compra,
 * não o relógio — o cálculo de horário tem testes de unidade próprios.
 *
 * Roda depois do `db:seed`. Recusa-se a rodar em produção.
 */
const DIA_INTEIRO = { opensAt: 0, closesAt: 24 * 60 } as const;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:e2e altera o horário de todas as lojas; não rode em produção.');
  }

  const prisma = new PrismaClient();

  try {
    const lojas = await prisma.store.findMany({ select: { id: true } });

    const horarios: Prisma.StoreHourCreateManyInput[] = lojas.flatMap((loja) =>
      Array.from({ length: 7 }, (_, weekday) => ({
        storeId: loja.id,
        weekday,
        ...DIA_INTEIRO,
        isActive: true,
      })),
    );

    await prisma.$transaction([
      prisma.storeHour.deleteMany({ where: { storeId: { in: lojas.map((loja) => loja.id) } } }),
      prisma.storeHour.createMany({ data: horarios }),
      // Pausa ou fechamento programado também tirariam a loja da vitrine.
      prisma.storeClosure.deleteMany({}),
      prisma.store.updateMany({ data: { isPausedUntil: null } }),
    ]);

    console.log(`✔ ${lojas.length} lojas abertas 24h para o e2e`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
