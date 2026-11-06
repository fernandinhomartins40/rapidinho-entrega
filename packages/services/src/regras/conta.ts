import { Prisma, prisma } from '@rapidinho/database';
import { falha, type Resultado } from './resultado';

/**
 * Direitos do titular (LGPD, art. 18) e dados básicos da conta.
 */

/** Tudo que ainda não terminou: um pedido só encerra entregue ou cancelado. */
const PEDIDO_EM_ANDAMENTO = {
  in: ['PENDING_PAYMENT', 'RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'],
} satisfies Prisma.EnumOrderStatusFilter;

/**
 * Por que esta conta não pode sair agora, ou null se pode. Vale para os três
 * lados: quem pediu, quem está levando e quem vendeu. Anonimizar no meio de uma
 * entrega deixaria alguém sem saber para quem entregar ou de quem cobrar.
 */
export async function atividadeQueImpedeExclusao(userId: string): Promise<string | null> {
  const [comoCliente, corridas, avulsas, lojas] = await Promise.all([
    prisma.order.count({ where: { userId, status: PEDIDO_EM_ANDAMENTO } }),
    prisma.delivery.count({
      where: { courier: { userId }, status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP'] } },
    }),
    prisma.errand.count({
      where: { courier: { userId }, status: { in: ['ACCEPTED', 'PICKED_UP'] } },
    }),
    prisma.storeStaff.findMany({
      where: { userId, role: 'OWNER', isActive: true },
      select: { storeId: true },
    }),
  ]);

  if (comoCliente > 0) {
    return 'Você tem pedidos em andamento. Aguarde a entrega para excluir a conta.';
  }
  if (corridas + avulsas > 0) {
    return 'Você tem corridas em andamento. Conclua as entregas para excluir a conta.';
  }

  if (lojas.length > 0) {
    const storeId = { in: lojas.map((loja) => loja.storeId) };
    const [pedidosDaLoja, avulsasDaLoja] = await Promise.all([
      prisma.order.count({ where: { storeId, status: PEDIDO_EM_ANDAMENTO } }),
      prisma.errand.count({
        where: { storeId, status: { in: ['OPEN', 'ACCEPTED', 'PICKED_UP'] } },
      }),
    ]);
    if (pedidosDaLoja + avulsasDaLoja > 0) {
      return 'Sua loja tem pedidos em andamento. Conclua todos para excluir a conta.';
    }
  }

  return null;
}

/**
 * Exclusão da conta.
 *
 * Anonimiza em vez de apagar a linha: o pedido pertence também à loja, que
 * precisa dele para a contabilidade e é obrigada a guardá-lo. O que some é tudo
 * que identifica a pessoa: nome, telefone, e-mail, endereços.
 *
 * É o equilíbrio que a LGPD prevê entre o direito de exclusão (art. 18, VI) e a
 * obrigação legal de guarda fiscal (art. 16, I). A linha do usuário fica, então
 * a cascata do banco não apaga nada aqui: cada dado sai de forma explícita.
 */
export async function excluirConta(userId: string): Promise<Resultado> {
  const impedimento = await atividadeQueImpedeExclusao(userId);
  if (impedimento) return falha(impedimento, 'CONTA_COM_ATIVIDADE');

  const marcador = `excluido-${Date.now()}`;

  await prisma.$transaction(async (tx) => {
    await tx.address.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.pushDevice.deleteMany({ where: { userId } });
    await tx.cart.deleteMany({ where: { userId } });

    // O comentário de avaliação pode conter dado pessoal escrito pela própria
    // pessoa; a nota fica, porque é métrica agregada da loja.
    await tx.review.updateMany({ where: { userId }, data: { comment: null } });

    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Usuário excluído',
        // O telefone é único no banco: precisa de um valor, não de null.
        phone: marcador,
        email: null,
        dislikedItems: [],
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    // Os pedidos guardam o nome e o telefone como snapshot; também saem.
    await tx.order.updateMany({
      where: { userId },
      // `undefined` não mexe no campo: o JSON nulo é o que apaga o endereço.
      data: {
        customerName: 'Cliente excluído',
        customerPhone: '',
        addressSnapshot: Prisma.JsonNull,
      },
    });

    await tx.dataRequest.create({
      data: { userId, type: 'DELETION', status: 'COMPLETED', completedAt: new Date() },
    });

    // Dentro da transação: conta excluída com sessão viva seguiria entrando.
    await tx.session.deleteMany({ where: { userId } });
  });

  return { ok: true, message: 'Sua conta foi excluída.' };
}

/**
 * Tudo o que guardamos sobre a pessoa, em JSON (LGPD, art. 18).
 *
 * Inclui os pedidos, que são dados dela, mas com o snapshot do que foi comprado,
 * não o catálogo da loja, que é dado de terceiro. Cada exportação fica registrada
 * como pedido do titular atendido: é a prova de que o direito foi cumprido.
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
      dislikedItems: true,
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
      pushDevices: { select: { platform: true, createdAt: true } },
    },
  });

  if (!dados) return null;

  await prisma.dataRequest.create({
    data: { userId, type: 'EXPORT', status: 'COMPLETED', completedAt: new Date() },
  });

  return JSON.stringify(dados, null, 2);
}

export async function atualizarNome(userId: string, nome: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { name: nome } });
}

export async function atualizarItensQueOdeio(userId: string, itens: string[]): Promise<void> {
  // "Cebola" e "cebola" são o mesmo item: fica a primeira grafia.
  const vistos = new Set<string>();
  const unicos = itens.filter((item) => {
    const chave = item.toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  await prisma.user.update({ where: { id: userId }, data: { dislikedItems: unicos } });
}
