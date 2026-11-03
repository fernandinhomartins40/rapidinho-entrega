import { prisma } from '@rapidinho/database';
import {
  isActiveStatus,
  ORDER_STATUS_CUSTOMER_MESSAGE,
  ORDER_STATUS_LABEL,
  faixaDeTempo,
  type OrderStatus,
} from '@rapidinho/shared';
import type {
  CarrinhoDaLoja,
  Endereco,
  EnderecoDoPedido,
  FormaDePagamento,
  PedidoDetalhado,
  PedidoResumido,
  ResumoDoCheckout,
  StatusDoPagamento,
  Usuario,
  Veiculo,
} from '@rapidinho/shared/app-api';
import { carregarCarrinho, type CarrinhoResolvido } from './carrinho';
import { calcularCheckout, formasDePagamentoAceitas } from './checkout';
import { listarEnderecos } from './enderecos';
import { CORRIDA_ATIVA } from './entregador';
import { STATUS_CANCELAVEIS_PELO_CLIENTE } from './pedidos';
import { falha, type Resultado } from './resultado';
import { termosPendentes } from './termos';

/**
 * Leituras do app: traduzem o banco para a forma do contrato. Nenhuma regra de
 * dinheiro aqui, e toda query filtra pelo dono.
 */

export async function usuarioDoApp(userId: string): Promise<Usuario | null> {
  const [usuario, pendentes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        courier: { select: { id: true, status: true } },
      },
    }),
    termosPendentes(userId),
  ]);

  if (!usuario) return null;

  return {
    id: usuario.id,
    nome: usuario.name,
    telefone: usuario.phone,
    email: usuario.email,
    papel: usuario.role,
    entregador: usuario.courier,
    termosPendentes: pendentes,
  };
}

export function paraCarrinhoDoApp(carrinho: CarrinhoResolvido, cidadeSlug: string): CarrinhoDaLoja {
  return {
    id: carrinho.id,
    lojaId: carrinho.storeId,
    loja: {
      nome: carrinho.loja.nome,
      slug: carrinho.loja.slug,
      cidadeSlug,
      pedidoMinimoCents: carrinho.loja.minOrderCents,
    },
    observacao: carrinho.notes,
    subtotalCents: carrinho.subtotalCents,
    temIndisponivel: carrinho.temIndisponivel,
    exigeReceita: carrinho.exigeReceita,
    exigeMaioridade: carrinho.exigeMaioridade,
    itens: carrinho.itens.map((item) => ({
      id: item.id,
      produtoId: item.productId,
      nome: item.nome,
      quantidade: item.quantidade,
      gramas: item.weightGrams,
      porPeso: item.sellingUnit === 'WEIGHT_KG',
      observacao: item.observacao,
      imagemUrl: item.imagem.url,
      indisponivel: item.indisponivel,
      motivoIndisponivel: item.motivoIndisponivel,
      exigeReceita: item.exigeReceita,
      maiorDeIdade: item.maiorDeIdade,
      complementos: item.complementos.map(({ optionId, ...complemento }) => ({
        ...complemento,
        opcaoId: optionId,
      })),
      pizza: item.pizza
        ? {
            tamanho: item.pizza.tamanho,
            sabores: item.pizza.sabores,
            extras: item.pizza.extras,
            extraPrecoCents: item.pizza.extraPrecoCents,
          }
        : null,
      unitarioCents: item.unitTotalCents,
      totalCents: item.totalCents,
    })),
  };
}

export async function listarPedidosDoApp(userId: string): Promise<PedidoResumido[]> {
  const pedidos = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      totalCents: true,
      store: { select: { id: true, name: true, slug: true } },
      items: { select: { productName: true, quantity: true } },
    },
  });

  return pedidos.map((pedido) => {
    const status = pedido.status as OrderStatus;
    return {
      id: pedido.id,
      numero: pedido.number,
      status,
      rotuloDoStatus: ORDER_STATUS_LABEL[status],
      ativo: isActiveStatus(status),
      criadoEm: pedido.createdAt.toISOString(),
      totalCents: pedido.totalCents,
      loja: { id: pedido.store.id, nome: pedido.store.name, slug: pedido.store.slug },
      itens: pedido.items.map((item) => ({ nome: item.productName, quantidade: item.quantity })),
    };
  });
}

/** Snapshot guardado no pedido, na forma do contrato. */
export function enderecoDoSnapshot(snapshot: unknown): EnderecoDoPedido | null {
  if (typeof snapshot !== 'object' || snapshot === null) return null;

  const dados = snapshot as Record<string, string | null | undefined>;
  return {
    rua: dados.street ?? '',
    numero: dados.number ?? null,
    complemento: dados.complement ?? null,
    bairro: dados.neighborhood ?? '',
    referencia: dados.referencePoint ?? null,
    cep: dados.zipCode ?? null,
  };
}

/**
 * A posição só existe para o dono do pedido (a query filtra por ele) e só com a
 * corrida andando: entregue ou cancelado, é o deslocamento de outra pessoa, e o
 * cliente não tem mais por que saber onde ela está.
 */
function posicaoVisivel(
  pedidoStatus: OrderStatus,
  entrega: {
    status: string;
    courier: { latitude: number | null; longitude: number | null; lastSeenAt: Date | null } | null;
  },
) {
  const ativa = (CORRIDA_ATIVA as readonly string[]).includes(entrega.status);
  const { latitude, longitude, lastSeenAt } = entrega.courier ?? {};

  if (!ativa || !isActiveStatus(pedidoStatus) || latitude == null || longitude == null) return null;

  return {
    latitude,
    longitude,
    atualizadaEm: (lastSeenAt ?? new Date()).toISOString(),
  };
}

export async function detalharPedidoDoApp(
  userId: string,
  id: string,
): Promise<PedidoDetalhado | null> {
  // Filtrado pelo dono: o pedido de outra pessoa dá 404, não "sem permissão".
  const pedido = await prisma.order.findFirst({
    where: { id, userId },
    select: {
      id: true,
      number: true,
      status: true,
      type: true,
      createdAt: true,
      estimatedReadyAt: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      discountCents: true,
      totalCents: true,
      estimatedTotalCents: true,
      notes: true,
      cancelReason: true,
      addressSnapshot: true,
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          phone: true,
          whatsapp: true,
          pixKey: true,
          city: { select: { slug: true } },
        },
      },
      payment: {
        select: {
          method: true,
          status: true,
          changeForCents: true,
          refundedCents: true,
          pixQrCode: true,
          pixExpiresAt: true,
          provider: true,
          pixProofImageId: true,
        },
      },
      items: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          pickStatus: true,
          pickedWeightGrams: true,
          replacementName: true,
          replacementPriceCents: true,
          productName: true,
          quantity: true,
          weightGrams: true,
          totalCents: true,
          notes: true,
          pizzaSizeName: true,
          pizzaExtraName: true,
          complements: { select: { id: true, optionName: true, quantity: true } },
          flavors: { select: { id: true, flavorName: true } },
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, status: true, note: true, createdAt: true },
      },
      delivery: {
        select: {
          status: true,
          courier: {
            select: {
              vehicleType: true,
              latitude: true,
              longitude: true,
              lastSeenAt: true,
              user: { select: { name: true, phone: true } },
            },
          },
        },
      },
      reviews: { select: { storeId: true, rating: true, comment: true, replyText: true } },
    },
  });

  if (!pedido) return null;

  const status = pedido.status as OrderStatus;
  const { payment, delivery } = pedido;
  const daLoja = pedido.reviews.find((avaliacao) => avaliacao.storeId != null);
  const pixNaChaveDaLoja = payment?.method === 'PIX' && payment.provider === 'OFFLINE';

  return {
    id: pedido.id,
    numero: pedido.number,
    status,
    rotuloDoStatus: ORDER_STATUS_LABEL[status],
    mensagemDoStatus: ORDER_STATUS_CUSTOMER_MESSAGE[status],
    ativo: isActiveStatus(status),
    tipo: pedido.type,
    criadoEm: pedido.createdAt.toISOString(),
    previstoProntoEm: pedido.estimatedReadyAt?.toISOString() ?? null,
    subtotalCents: pedido.subtotalCents,
    taxaEntregaCents: pedido.deliveryFeeCents,
    descontoCents: pedido.discountCents,
    totalCents: pedido.totalCents,
    totalEstimadoCents: pedido.estimatedTotalCents,
    observacao: pedido.notes,
    motivoDoCancelamento: pedido.cancelReason,
    endereco: enderecoDoSnapshot(pedido.addressSnapshot),
    loja: {
      id: pedido.store.id,
      nome: pedido.store.name,
      slug: pedido.store.slug,
      telefone: pedido.store.phone,
      whatsapp: pedido.store.whatsapp,
      cidadeSlug: pedido.store.city.slug,
    },
    pagamento: payment
      ? {
          forma: payment.method,
          status: payment.status as StatusDoPagamento,
          trocoParaCents: payment.changeForCents,
          estornadoCents: payment.refundedCents,
          pix:
            payment.method === 'PIX'
              ? {
                  chave: pixNaChaveDaLoja ? pedido.store.pixKey : null,
                  copiaECola: payment.pixQrCode,
                  expiraEm: payment.pixExpiresAt?.toISOString() ?? null,
                  comprovanteEnviado: payment.pixProofImageId != null,
                }
              : null,
        }
      : null,
    itens: pedido.items.map((item) => ({
      id: item.id,
      nome: item.productName,
      quantidade: item.quantity,
      gramas: item.weightGrams,
      totalCents: item.totalCents,
      observacao: item.notes,
      pizzaTamanho: item.pizzaSizeName,
      pizzaExtra: item.pizzaExtraName,
      complementos: item.complements.map((complemento) => ({
        id: complemento.id,
        nome: complemento.optionName,
        quantidade: complemento.quantity,
      })),
      sabores: item.flavors.map((sabor) => ({ id: sabor.id, nome: sabor.flavorName })),
      statusDaSeparacao: item.pickStatus,
      gramasSeparadas: item.pickedWeightGrams,
      substituto:
        item.replacementName != null
          ? { nome: item.replacementName, precoCents: item.replacementPriceCents ?? 0 }
          : null,
    })),
    historico: pedido.statusHistory.map((linha) => ({
      id: linha.id,
      status: linha.status as OrderStatus,
      rotulo: ORDER_STATUS_LABEL[linha.status as OrderStatus],
      nota: linha.note,
      em: linha.createdAt.toISOString(),
    })),
    entregador: delivery?.courier
      ? {
          nome: delivery.courier.user.name ?? 'Entregador',
          telefone: delivery.courier.user.phone,
          veiculo: delivery.courier.vehicleType as Veiculo,
          statusDaEntrega: delivery.status,
          posicao: posicaoVisivel(status, delivery),
        }
      : null,
    avaliacaoDaLoja: daLoja
      ? { nota: daLoja.rating, comentario: daLoja.comment, resposta: daLoja.replyText }
      : null,
    jaAvaliado: pedido.reviews.length > 0,
    podeCancelar:
      (STATUS_CANCELAVEIS_PELO_CLIENTE as readonly string[]).includes(status) &&
      payment?.status !== 'PAID',
    podeAvaliar: status === 'DELIVERED' && pedido.reviews.length === 0,
    podeEnviarComprovante: status === 'PENDING_PAYMENT' && pixNaChaveDaLoja,
  };
}

/** Marca ou desmarca a loja; o estado vem do banco, não do botão. */
export async function alternarFavoritoDoCliente(userId: string, storeId: string) {
  const loja = await prisma.store.findFirst({
    where: { id: storeId, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });
  if (!loja) return null;

  const chave = { userId_storeId: { userId, storeId: loja.id } };
  const existente = await prisma.favoriteStore.findUnique({
    where: chave,
    select: { userId: true },
  });

  if (existente) await prisma.favoriteStore.delete({ where: chave });
  else await prisma.favoriteStore.create({ data: { userId, storeId: loja.id } });

  return { favorita: !existente };
}

/** Registra o aparelho. O token é do aparelho: outra conta nele assume a linha. */
export async function registrarDispositivo(dados: {
  userId: string;
  sessionId: string;
  expoPushToken: string;
  plataforma: 'android' | 'ios';
}): Promise<void> {
  const campos = {
    userId: dados.userId,
    sessionId: dados.sessionId,
    platform: dados.plataforma,
  };

  await prisma.pushDevice.upsert({
    where: { expoPushToken: dados.expoPushToken },
    update: campos,
    create: { ...campos, expoPushToken: dados.expoPushToken },
  });
}

export function paraEnderecoDoApp(
  endereco: Awaited<ReturnType<typeof listarEnderecos>>[number],
): Endereco {
  return {
    id: endereco.id,
    rotulo: endereco.label,
    rua: endereco.street,
    numero: endereco.number,
    complemento: endereco.complement,
    bairro: endereco.neighborhood,
    bairroId: endereco.neighborhoodId,
    referencia: endereco.referencePoint,
    cep: endereco.zipCode,
    cidade: {
      id: endereco.city.id,
      slug: endereco.city.slug,
      nome: endereco.city.name,
      uf: endereco.city.state,
    },
    latitude: endereco.latitude,
    longitude: endereco.longitude,
    padrao: endereco.isDefault,
  };
}

/**
 * Pré-visualização do checkout: os mesmos cálculos da criação do pedido. Sem
 * gateway: no app o Pix é só o da chave da loja, e cartão online não existe.
 */
export async function resumoDoCheckoutDoApp(
  userId: string,
  parametros: {
    lojaId: string;
    tipo?: 'DELIVERY' | 'PICKUP';
    enderecoId?: string;
    cupom?: string;
  },
): Promise<Resultado<{ resumo: ResumoDoCheckout }>> {
  const [carrinho, loja, enderecos, ultimoPagamento] = await Promise.all([
    carregarCarrinho(userId, parametros.lojaId),
    prisma.store.findFirst({
      where: { id: parametros.lojaId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        cityId: true,
        acceptsPickup: true,
        acceptsPix: true,
        pixKey: true,
        settlementMode: true,
        acceptsCardOnline: true,
        acceptsCashOnDelivery: true,
        acceptsCardOnDelivery: true,
        avgPrepTimeMinutes: true,
        avgDeliveryTimeMinutes: true,
        segment: true,
        city: { select: { slug: true } },
      },
    }),
    listarEnderecos(userId, { lojaId: parametros.lojaId }),
    prisma.payment.findFirst({
      where: { order: { userId } },
      orderBy: { createdAt: 'desc' },
      select: { method: true },
    }),
  ]);

  if (!loja) return falha('Loja indisponível.', 'LOJA_INDISPONIVEL');
  if (!carrinho || carrinho.itens.length === 0) {
    return falha('Seu carrinho está vazio.', 'CARRINHO_VAZIO');
  }

  const tipo = parametros.tipo === 'PICKUP' && loja.acceptsPickup ? 'PICKUP' : 'DELIVERY';
  const enderecoEscolhidoId =
    parametros.enderecoId ??
    enderecos.find((endereco) => endereco.isDefault)?.id ??
    enderecos[0]?.id ??
    null;

  const valores = await calcularCheckout({
    carrinho,
    userId,
    cityId: loja.cityId,
    tipo,
    addressId: enderecoEscolhidoId,
    couponCode: parametros.cupom ?? null,
  });

  const aceitas = formasDePagamentoAceitas(loja, { pixPeloGateway: false });
  const formasDePagamento = (['PIX', 'CASH_ON_DELIVERY', 'CARD_ON_DELIVERY'] as const).filter(
    (forma): forma is FormaDePagamento => aceitas[forma],
  );
  const sugerido = formasDePagamento.find((forma) => forma === ultimoPagamento?.method);

  return {
    ok: true,
    resumo: {
      loja: {
        id: loja.id,
        nome: loja.name,
        slug: loja.slug,
        cidadeSlug: loja.city.slug,
        aceitaRetirada: loja.acceptsPickup,
        ehMercado: loja.segment === 'MARKET',
        ...faixaDeTempo(loja.avgPrepTimeMinutes, loja.avgDeliveryTimeMinutes),
      },
      carrinho: paraCarrinhoDoApp(carrinho, loja.city.slug),
      tipo,
      enderecos: enderecos.map(paraEnderecoDoApp),
      enderecoEscolhidoId,
      formasDePagamento,
      pagamentoSugerido: sugerido ?? null,
      exigencias: {
        maioridade: carrinho.exigeMaioridade,
        receita: carrinho.exigeReceita,
        temPesavel: carrinho.itens.some((item) => item.sellingUnit === 'WEIGHT_KG'),
      },
      valores: {
        subtotalCents: valores.subtotalCents,
        taxaEntregaCents: valores.deliveryFeeCents,
        motivoDaTaxa: valores.deliveryFeeReason,
        descontoCents: valores.discountCents,
        freteGratisPorCupom: valores.freteGratisPorCupom,
        totalCents: valores.totalCents,
      },
      mensagemDoCupom: valores.couponMessage,
      bloqueio: valores.bloqueio,
    },
  };
}
