import { prisma } from '@rapidinho/database';
import { capturarErro, logger, notificarUsuario } from '@rapidinho/services';
import {
  COMISSAO_HABILITADA,
  DIAS_ATE_SUSPENDER,
  formatCents,
  INICIO_DA_SUSPENSAO,
} from '@rapidinho/shared';

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
    const comissaoCents = COMISSAO_HABILITADA
      ? ((
          await prisma.order.aggregate({
            where: {
              storeId: assinatura.storeId,
              status: 'DELIVERED',
              createdAt: {
                gte: assinatura.currentPeriodStart ?? inicio,
                lt: inicio,
              },
            },
            _sum: { commissionCents: true },
          })
        )._sum.commissionCents ?? 0)
      : 0;

    try {
      await prisma.$transaction([
        prisma.planInvoice.create({
          data: {
            storeId: assinatura.storeId,
            planId: assinatura.planId,
            amountCents: assinatura.plan.monthlyPriceCents,
            commissionCents: comissaoCents,
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
            `${formatCents(assinatura.plan.monthlyPriceCents + comissaoCents)} ` +
            `com vencimento em ${vencimento.toLocaleDateString('pt-BR')}` +
            (comissaoCents > 0
              ? ` (mensalidade ${formatCents(assinatura.plan.monthlyPriceCents)} + comissão ` +
                `${formatCents(comissaoCents)}).`
              : '.'),
          url: '/loja/financeiro',
          canais: ['WHATSAPP', 'EMAIL'],
          entity: { type: 'Store', id: assinatura.storeId },
        });
      }
    } catch (erro) {
      // Uma assinatura com problema não pode impedir a cobrança das outras.
      void capturarErro(erro, { origem: 'cobranca', subscriptionId: assinatura.id });
    }
  }

  logger.info({ total: assinaturas.length }, '[cobranca] assinaturas processadas');
}

/**
 * Tira do ar a loja com fatura vencida há mais de DIAS_ATE_SUSPENDER dias.
 *
 * `suspendedForNonPaymentAt` separa esta suspensão da manual: só ela volta
 * sozinha ao dar baixa. Fatura anterior a INICIO_DA_SUSPENSAO não conta.
 */
export async function suspenderInadimplentes(): Promise<void> {
  const agora = new Date();
  const limite = new Date(agora.getTime() - DIAS_ATE_SUSPENDER * 24 * 3600 * 1000);

  await prisma.planInvoice.updateMany({
    where: { status: 'OPEN', dueDate: { lt: agora }, createdAt: { gte: INICIO_DA_SUSPENSAO } },
    data: { status: 'OVERDUE' },
  });

  const vencidas = await prisma.planInvoice.findMany({
    where: {
      status: 'OVERDUE',
      dueDate: { lt: limite },
      createdAt: { gte: INICIO_DA_SUSPENSAO },
      store: { status: 'ACTIVE', deletedAt: null },
    },
    distinct: ['storeId'],
    select: {
      storeId: true,
      store: {
        select: {
          name: true,
          staff: { where: { role: 'OWNER', isActive: true }, select: { userId: true }, take: 1 },
        },
      },
    },
  });

  for (const fatura of vencidas) {
    try {
      // Condicional: uma baixa no mesmo instante não é atropelada.
      const { count } = await prisma.store.updateMany({
        where: { id: fatura.storeId, status: 'ACTIVE' },
        data: { status: 'SUSPENDED', suspendedForNonPaymentAt: agora },
      });

      const dono = fatura.store.staff[0];
      if (count > 0 && dono) {
        await notificarUsuario({
          userId: dono.userId,
          title: 'Sua loja foi suspensa',
          body: `A ${fatura.store.name} saiu do ar por fatura vencida. Ela volta assim que o pagamento for confirmado.`,
          url: '/loja/financeiro',
          canais: ['WHATSAPP', 'EMAIL'],
          entity: { type: 'Store', id: fatura.storeId },
        });
      }
    } catch (erro) {
      void capturarErro(erro, { origem: 'suspensao', storeId: fatura.storeId });
    }
  }

  logger.info({ total: vencidas.length }, '[cobranca] lojas suspensas por inadimplência');
}
