import { prisma } from '@rapidinho/database';
import { notificarUsuario } from '@rapidinho/services';
import { formatCents } from '@rapidinho/shared';

/**
 * Cobrança mensal dos planos.
 *
 * Gera a fatura e avisa o lojista; não movimenta dinheiro sozinho. Débito
 * automático numa plataforma que está começando é o tipo de automação que,
 * quando erra, custa a confiança de quem depende dela para trabalhar.
 *
 * Plano gratuito não gera fatura — é o caso da maioria no início, e uma fatura
 * de R$ 0,00 por mês só confunde.
 */
export async function cobrarMensalidades(): Promise<void> {
  const agora = new Date();

  const assinaturas = await prisma.storeSubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      currentPeriodEnd: { lte: agora },
      plan: { monthlyPriceCents: { gt: 0 } },
    },
    select: {
      id: true,
      storeId: true,
      currentPeriodEnd: true,
      currentPeriodStart: true,
      planId: true,
      plan: { select: { name: true, monthlyPriceCents: true } },
      store: {
        select: {
          name: true,
          staff: {
            where: { role: 'OWNER', isActive: true },
            select: { userId: true },
            take: 1,
          },
        },
      },
    },
  });

  for (const assinatura of assinaturas) {
    const inicio = assinatura.currentPeriodEnd ?? agora;
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + 1);

    // Vencimento em 5 dias: quem trabalha no balcão não olha o painel todo
    // dia, e cortar o serviço no mesmo dia seria hostil.
    const vencimento = new Date(agora);
    vencimento.setDate(vencimento.getDate() + 5);

    // A comissão dos pedidos do período fecha junto com a mensalidade: cobrar
    // as duas coisas em faturas separadas dobraria o trabalho do lojista e a
    // chance de uma ficar esquecida.
    const comissao = await prisma.order.aggregate({
      where: {
        storeId: assinatura.storeId,
        status: 'DELIVERED',
        createdAt: {
          gte: assinatura.currentPeriodStart ?? inicio,
          lt: inicio,
        },
      },
      _sum: { commissionCents: true },
    });

    try {
      await prisma.$transaction([
        prisma.planInvoice.create({
          data: {
            storeId: assinatura.storeId,
            planId: assinatura.planId,
            amountCents: assinatura.plan.monthlyPriceCents,
            commissionCents: comissao._sum.commissionCents ?? 0,
            // OPEN, não PENDING: a fatura está emitida e aguardando
            // pagamento, que é o vocabulário do enum do banco.
            status: 'OPEN',
            periodStart: assinatura.currentPeriodStart ?? inicio,
            periodEnd: inicio,
            dueDate: vencimento,
          },
        }),
        prisma.storeSubscription.update({
          where: { id: assinatura.id },
          data: { status: 'ACTIVE', currentPeriodStart: inicio, currentPeriodEnd: fim },
        }),
      ]);

      const dono = assinatura.store.staff[0];

      if (dono) {
        await notificarUsuario({
          userId: dono.userId,
          title: `Fatura do plano ${assinatura.plan.name}`,
          body:
            `${formatCents(assinatura.plan.monthlyPriceCents + (comissao._sum.commissionCents ?? 0))} ` +
            `com vencimento em ${vencimento.toLocaleDateString('pt-BR')} ` +
            `(mensalidade ${formatCents(assinatura.plan.monthlyPriceCents)} + comissão ` +
            `${formatCents(comissao._sum.commissionCents ?? 0)}).`,
          url: '/loja/financeiro',
          canais: ['WHATSAPP', 'EMAIL'],
          entity: { type: 'Store', id: assinatura.storeId },
        });
      }
    } catch (erro) {
      // Uma assinatura com problema não pode impedir a cobrança das outras.
      console.error('[cobranca] falhou para uma assinatura', {
        subscriptionId: assinatura.id,
        erro,
      });
    }
  }

  console.warn(`[cobranca] ${assinaturas.length} assinatura(s) processada(s)`);
}
