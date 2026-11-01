import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { normalizePhoneBR } from '@rapidinho/shared';
import {
  PrismaClient,
  type Prisma,
  type StoreStaffRole,
  type UserRole,
  type UserStatus,
} from '../../generated/client';

loadEnv({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true });

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

/**
 * Perfis que a matriz de permissões precisa e o seed principal não cria
 * (docs/revisao/MATRIZ-DE-PERMISSOES.md). Equipe vinculada à loja do lojista
 * do e2e, (44) 99000-0000.
 */
const PERFIS: {
  telefone: string;
  nome: string;
  papel: UserRole;
  status?: UserStatus;
  equipe?: StoreStaffRole;
}[] = [
  { telefone: '44 99800-0001', nome: 'Cliente B do e2e', papel: 'CUSTOMER' },
  { telefone: '44 99800-0002', nome: 'Gerente do e2e', papel: 'STORE_STAFF', equipe: 'MANAGER' },
  { telefone: '44 99800-0003', nome: 'Operador do e2e', papel: 'STORE_STAFF', equipe: 'OPERATOR' },
  { telefone: '44 99800-0004', nome: 'Admin do e2e', papel: 'ADMIN' },
  { telefone: '44 99800-0005', nome: 'Bloqueado do e2e', papel: 'CUSTOMER', status: 'BLOCKED' },
];

async function semearPerfis(prisma: PrismaClient) {
  const dono = await prisma.user.findUnique({
    where: { phone: normalizePhoneBR('44 99000-0000') ?? '' },
    select: { storeStaff: { where: { role: 'OWNER' }, select: { storeId: true }, take: 1 } },
  });
  const lojaId = dono?.storeStaff[0]?.storeId;
  if (!lojaId) throw new Error('Rode o db:seed antes: loja do lojista do e2e não encontrada.');

  for (const perfil of PERFIS) {
    const phone = normalizePhoneBR(perfil.telefone);
    if (!phone) throw new Error(`Telefone inválido no seed: ${perfil.telefone}`);

    const dados = { role: perfil.papel, status: perfil.status ?? 'ACTIVE', name: perfil.nome };
    const usuario = await prisma.user.upsert({
      where: { phone },
      update: dados,
      create: { ...dados, phone, phoneVerified: new Date() },
    });

    if (perfil.equipe) {
      await prisma.storeStaff.upsert({
        where: { storeId_userId: { storeId: lojaId, userId: usuario.id } },
        update: { role: perfil.equipe, isActive: true },
        create: { storeId: lojaId, userId: usuario.id, role: perfil.equipe },
      });
    }
  }
}

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

    console.warn(`✔ ${lojas.length} lojas abertas 24h para o e2e`);

    await semearPerfis(prisma);
    console.warn(`✔ ${PERFIS.length} perfis extras da matriz de permissões (44 99800-000x)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
