'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@rapidinho/database';
import { destroyCurrentSession, revokeAllSessions } from '@rapidinho/auth';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Direitos do titular (LGPD, art. 18).
 *
 * Exportação e exclusão dos dados, pelo próprio usuário, sem precisar abrir
 * chamado — que é o que a lei chama de "acesso facilitado".
 */

export interface DadosExportados extends ActionResult {
  json?: string;
}

/**
 * Reúne tudo o que guardamos sobre a pessoa.
 *
 * Inclui os pedidos, que são dados dela — mas com o snapshot do que foi
 * comprado, não o catálogo da loja, que é dado de terceiro.
 */
export async function exportarMeusDados(): Promise<DadosExportados> {
  return runAuthedAction(async (user) => {
    const dados = await prisma.user.findUnique({
      where: { id: user.id },
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

    if (!dados) return { ok: false, message: 'Conta não encontrada.' };

    return {
      ok: true,
      message: 'Seus dados foram reunidos.',
      json: JSON.stringify(dados, null, 2),
    };
  });
}

/**
 * Exclusão da conta.
 *
 * Anonimiza em vez de apagar a linha: o pedido pertence também à loja, que
 * precisa dele para a contabilidade e é obrigada a guardá-lo. O que some é
 * tudo que identifica a pessoa — nome, telefone, e-mail, endereços.
 *
 * É o equilíbrio que a LGPD prevê entre o direito de exclusão (art. 18, VI) e
 * a obrigação legal de guarda fiscal (art. 16, I).
 */
export async function excluirMinhaConta(): Promise<ActionResult> {
  const resultado = await runAuthedAction(async (user) => {
    const pedidos = await prisma.order.count({
      where: {
        userId: user.id,
        status: { in: ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] },
      },
    });

    if (pedidos > 0) {
      return {
        ok: false,
        message: 'Você tem pedidos em andamento. Aguarde a entrega para excluir a conta.',
      };
    }

    const marcador = `excluido-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      await tx.address.deleteMany({ where: { userId: user.id } });
      await tx.pushSubscription.deleteMany({ where: { userId: user.id } });
      await tx.cart.deleteMany({ where: { userId: user.id } });

      // O comentário de avaliação pode conter dado pessoal escrito pela
      // própria pessoa; a nota fica, porque é métrica agregada da loja.
      await tx.review.updateMany({ where: { userId: user.id }, data: { comment: null } });

      await tx.user.update({
        where: { id: user.id },
        data: {
          name: 'Usuário excluído',
          // O telefone é único no banco: precisa de um valor, não de null.
          phone: marcador,
          email: null,
          status: 'DELETED',
          deletedAt: new Date(),
        },
      });

      // Os pedidos guardam o nome e o telefone como snapshot; também saem.
      await tx.order.updateMany({
        where: { userId: user.id },
        data: { customerName: 'Cliente excluído', customerPhone: '', addressSnapshot: undefined },
      });

      await tx.dataRequest.create({
        data: { userId: user.id, type: 'DELETION', status: 'COMPLETED', completedAt: new Date() },
      });
    });

    await revokeAllSessions(user.id);

    return { ok: true, message: 'Sua conta foi excluída.' };
  });

  if (resultado.ok) {
    await destroyCurrentSession();
    revalidatePath('/');
  }

  return resultado;
}
