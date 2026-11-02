import { prisma } from '@rapidinho/database';

/**
 * Tudo o que guardamos sobre a pessoa, em JSON (LGPD, art. 18).
 *
 * Inclui os pedidos, que são dados dela — mas com o snapshot do que foi
 * comprado, não o catálogo da loja, que é dado de terceiro. Cada exportação
 * fica registrada como pedido do titular atendido: é a prova de que o
 * direito de acesso foi cumprido.
 */
export async function reunirDadosDoTitular(userId: string): Promise<string | null> {
  const dados = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
      acceptedTermsAt: true,
      acceptedPrivacyAt: true,
      addresses: {
        select: {
          street: true,
          number: true,
          complement: true,
          neighborhood: true,
          referencePoint: true,
          zipCode: true,
          createdAt: true,
          city: { select: { name: true, state: true } },
        },
      },
      orders: {
        select: {
          number: true,
          status: true,
          createdAt: true,
          totalCents: true,
          store: { select: { name: true } },
          items: {
            select: { productName: true, quantity: true, totalCents: true },
          },
        },
      },
      reviews: { select: { rating: true, comment: true, createdAt: true } },
      consents: { select: { kind: true, version: true, granted: true, createdAt: true } },
    },
  });

  if (!dados) return null;

  await prisma.dataRequest.create({
    data: { userId, type: 'EXPORT', status: 'COMPLETED', completedAt: new Date() },
  });

  return JSON.stringify(dados, null, 2);
}
