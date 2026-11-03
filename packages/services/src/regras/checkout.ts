import { Prisma, prisma } from '@rapidinho/database';
import {
  applyCoupon,
  buildPixBrCode,
  calculateDeliveryFee,
  CARTAO_ONLINE_DISPONIVEL,
  COMISSAO_HABILITADA,
  isStoreOpen,
  normalizePhoneBR,
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
  type CheckoutInput,
} from '@rapidinho/shared';
import { capturarErro } from '../observability';
import { getPaymentGateway } from '../providers';
import { agendarExpiracaoDePedido, agendarLembreteDaLoja } from '../queues';
import { publishRealtime } from '../realtime/publisher';
import { carregarCarrinho, totaisDoCarrinho, type CarrinhoResolvido } from './carrinho';
import { falha, type Resultado } from './resultado';

/**
 * Cálculo do que o cliente vai pagar.
 *
 * Roda igual na pré-visualização do checkout e na criação do pedido, a partir
 * dos mesmos dados. Duas rotas calculando por conta própria é como surgem
 * pedidos com total diferente do que o cliente aceitou na tela.
 */

export interface ResumoDoCheckout {
  deliveryFeeCents: number;
  deliveryFeeReason: string | null;
  discountCents: number;
  freteGratisPorCupom: boolean;
  couponMessage: string | null;
  couponId: string | null;
  subtotalCents: number;
  totalCents: number;
  commissionCents: number;
  /// Impede o pedido quando preenchido; o texto explica o porquê ao cliente.
  bloqueio: string | null;
}

interface Entrada {
  carrinho: CarrinhoResolvido;
  userId: string;
  cityId: string;
  tipo: 'DELIVERY' | 'PICKUP';
  addressId: string | null;
  couponCode: string | null;
}

export async function calcularCheckout({
  carrinho,
  userId,
  cityId,
  tipo,
  addressId,
  couponCode,
}: Entrada): Promise<ResumoDoCheckout> {
  const loja = await prisma.store.findUniqueOrThrow({
    where: { id: carrinho.storeId },
    select: {
      isPausedUntil: true,
      pauseReason: true,
      hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
      closures: {
        where: { endsAt: { gte: new Date() } },
        select: { startsAt: true, endsAt: true, reason: true },
      },
      deliveryFeeMode: true,
      deliveryFeeCents: true,
      pricePerKmCents: true,
      freeDeliveryAboveCents: true,
      deliveryRadiusMeters: true,
      minOrderCents: true,
      latitude: true,
      longitude: true,
      deliveryZones: {
        select: {
          id: true,
          name: true,
          neighborhoodId: true,
          feeCents: true,
          minOrderCents: true,
          estimatedMinutes: true,
          isActive: true,
        },
      },
    },
  });

  const endereco =
    tipo === 'DELIVERY' && addressId
      ? await prisma.address.findFirst({
          where: { id: addressId, userId, deletedAt: null },
          select: { cityId: true, neighborhoodId: true, latitude: true, longitude: true },
        })
      : null;

  let deliveryFeeCents = 0;
  let deliveryFeeReason: string | null = null;
  let bloqueioDeEntrega: string | null = null;

  if (tipo === 'DELIVERY') {
    if (!endereco) {
      bloqueioDeEntrega = 'Escolha um endereço de entrega.';
    } else if (endereco.cityId !== cityId) {
      // A loja entrega na cidade dela. Com taxa fixa o cálculo passaria, e a
      // loja receberia uma entrega em outra cidade.
      bloqueioDeEntrega = 'Este endereço é de outra cidade. Escolha um endereço desta cidade.';
    } else {
      const resultado = calculateDeliveryFee({
        mode: loja.deliveryFeeMode as 'FIXED' | 'BY_DISTANCE' | 'BY_ZONE' | 'FREE',
        deliveryFeeCents: loja.deliveryFeeCents,
        pricePerKmCents: loja.pricePerKmCents,
        deliveryRadiusMeters: loja.deliveryRadiusMeters,
        freeDeliveryAboveCents: loja.freeDeliveryAboveCents,
        subtotalCents: carrinho.subtotalCents,
        zones: loja.deliveryZones,
        neighborhoodId: endereco.neighborhoodId,
        storeCoordinates:
          loja.latitude != null && loja.longitude != null
            ? { latitude: loja.latitude, longitude: loja.longitude }
            : null,
        addressCoordinates:
          endereco.latitude != null && endereco.longitude != null
            ? { latitude: endereco.latitude, longitude: endereco.longitude }
            : null,
      });

      if (resultado.available) {
        deliveryFeeCents = resultado.feeCents;
        if (resultado.isFreeByThreshold) {
          deliveryFeeReason = 'Entrega grátis pelo valor do pedido';
        }
      } else {
        bloqueioDeEntrega = resultado.reason;
      }
    }
  }

  let discountCents = 0;
  let freteGratisPorCupom = false;
  let couponMessage: string | null = null;
  let couponId: string | null = null;

  if (couponCode?.trim()) {
    const codigo = couponCode.trim().toUpperCase();

    const cupom = await prisma.coupon.findFirst({
      where: {
        code: codigo,
        // Cupom da própria loja, ou global da plataforma (com ou sem cidade).
        OR: [
          { storeId: carrinho.storeId },
          { scope: 'PLATFORM', OR: [{ cityId }, { cityId: null }] },
        ],
      },
    });

    if (!cupom) {
      couponMessage = 'Cupom não encontrado ou não vale nesta loja.';
    } else {
      const [usosDoCliente, pedidosAnteriores] = await Promise.all([
        prisma.couponRedemption.count({ where: { couponId: cupom.id, userId } }),
        prisma.order.count({
          where: { userId, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        }),
      ]);

      const resultado = applyCoupon(
        {
          id: cupom.id,
          code: cupom.code,
          scope: cupom.scope as 'PLATFORM' | 'STORE',
          storeId: cupom.storeId,
          cityId: cupom.cityId,
          discountType: cupom.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_DELIVERY',
          discountValue: cupom.discountValue,
          maxDiscountCents: cupom.maxDiscountCents,
          minOrderCents: cupom.minOrderCents,
          usageLimit: cupom.usageLimit,
          usagePerUser: cupom.usagePerUser,
          usageCount: cupom.usageCount,
          firstOrderOnly: cupom.firstOrderOnly,
          startsAt: cupom.startsAt,
          endsAt: cupom.endsAt,
          isActive: cupom.isActive,
        },
        {
          subtotalCents: carrinho.subtotalCents,
          deliveryFeeCents,
          storeId: carrinho.storeId,
          cityId,
          userRedemptionCount: usosDoCliente,
          isFirstOrder: pedidosAnteriores === 0,
        },
      );

      if (resultado.valid) {
        discountCents = resultado.discountCents;
        freteGratisPorCupom = resultado.freeDelivery;
        couponId = cupom.id;

        if (resultado.freeDelivery) {
          deliveryFeeCents = 0;
          deliveryFeeReason = 'Entrega grátis pelo cupom';
        }
      } else {
        couponMessage = resultado.reason;
      }
    }
  }

  const totais = totaisDoCarrinho(carrinho, deliveryFeeCents, discountCents);

  const faltamCentavos = loja.minOrderCents - carrinho.subtotalCents;

  // Loja fechada aparece aqui, na tela, e não só ao enviar: antes o cliente
  // preenchia tudo e descobria no último toque.
  const abertura = isStoreOpen({
    hours: loja.hours,
    closures: loja.closures,
    pausedUntil: loja.isPausedUntil,
    pauseReason: loja.pauseReason,
  });
  const bloqueioDeHorario = abertura.isOpen
    ? null
    : `${abertura.reason ?? 'Loja fechada agora'}. Seu carrinho fica guardado para quando ela abrir.`;

  const bloqueio =
    bloqueioDeHorario ??
    bloqueioDeEntrega ??
    (carrinho.itens.length === 0
      ? 'Seu carrinho está vazio.'
      : carrinho.temIndisponivel
        ? 'Há itens indisponíveis no carrinho. Remova-os para continuar.'
        : faltamCentavos > 0
          ? `Esta loja tem pedido mínimo. Faltam ${(faltamCentavos / 100).toFixed(2).replace('.', ',')} reais.`
          : null);

  return {
    deliveryFeeCents,
    deliveryFeeReason,
    discountCents,
    freteGratisPorCupom,
    couponMessage,
    couponId,
    subtotalCents: totais.subtotalCents,
    totalCents: totais.totalCents,
    commissionCents: totais.commissionCents,
    bloqueio,
  };
}

/** Estoque acabou entre o carrinho e o "Fazer pedido": desfaz a transação. */
class EstoqueInsuficiente extends Error {
  constructor(readonly produto: string) {
    super(`Estoque insuficiente: ${produto}`);
  }
}

/**
 * Criação do pedido.
 *
 * Tudo é recalculado aqui — preços, taxa de entrega e desconto — a partir do
 * catálogo e das regras da loja. O cliente informa apenas escolhas; nenhum
 * valor vindo do navegador entra no banco.
 *
 * O pedido guarda SNAPSHOTS do que foi comprado: nome do produto, preço, nome
 * do complemento, endereço. O catálogo muda, o pedido não pode mudar junto —
 * uma comanda de ontem precisa continuar dizendo o que foi vendido ontem.
 */

/** Número curto e legível, que o cliente dita no telefone. */
async function gerarNumeroDoPedido(): Promise<string> {
  const hoje = new Date();
  const prefixo = `${String(hoje.getDate()).padStart(2, '0')}${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  // Tenta algumas vezes: a coluna é única e uma colisão em horário de pico é
  // possível, ainda que rara.
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const sufixo = String(Math.floor(Math.random() * 10_000)).padStart(4, '0');
    const numero = `${prefixo}${sufixo}`;

    const existe = await prisma.order.findUnique({
      where: { number: numero },
      select: { id: true },
    });
    if (!existe) return numero;
  }

  // Último recurso: o timestamp não colide, só é feio de ditar.
  return `${prefixo}${Date.now().toString().slice(-6)}`;
}

export interface EntradaDoPedido {
  usuario: { id: string; name: string | null; phone: string | null };
  dados: CheckoutInput;
  confirmaMaioridade: boolean;
  prescriptionImageId?: string | null;
  substitutionPolicy?: string | null;
  /** Falso no app: o cliente paga na chave da loja, sem gateway no caminho. */
  pixPeloGateway: boolean;
  chaveDeIdempotencia?: string | null;
}

export type PedidoCriado = Resultado<{
  pedido: { id: string; number: string; status: string };
  repetido: boolean;
}>;

/**
 * Formas de pagamento que esta loja aceita agora. O Pix só aparece quando dá
 * para pagar: na chave da própria loja ou, no site, por gateway real.
 */
export function formasDePagamentoAceitas(
  loja: {
    acceptsPix: boolean;
    settlementMode: string;
    pixKey: string | null;
    acceptsCardOnline: boolean;
    acceptsCashOnDelivery: boolean;
    acceptsCardOnDelivery: boolean;
  },
  opcoes: { pixPeloGateway: boolean },
) {
  return {
    PIX:
      loja.acceptsPix &&
      ((loja.settlementMode === 'STORE_COLLECTS' && !!loja.pixKey) || opcoes.pixPeloGateway),
    CREDIT_CARD_ONLINE: CARTAO_ONLINE_DISPONIVEL && loja.acceptsCardOnline,
    CASH_ON_DELIVERY: loja.acceptsCashOnDelivery,
    CARD_ON_DELIVERY: loja.acceptsCardOnDelivery,
  };
}

export async function criarPedido(entrada: EntradaDoPedido): Promise<PedidoCriado> {
  const { usuario, dados } = entrada;

  /** Pedido que esta chave já criou, se criou. Chave de outra loja é engano. */
  const pedidoDaChave = async (): Promise<PedidoCriado | null> => {
    if (!entrada.chaveDeIdempotencia) return null;

    const existente = await prisma.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: usuario.id,
          idempotencyKey: entrada.chaveDeIdempotencia,
        },
      },
      select: { id: true, number: true, status: true, storeId: true },
    });
    if (!existente) return null;

    if (existente.storeId !== dados.storeId) {
      return falha('Esta chave já foi usada em outro pedido.', 'CHAVE_REUTILIZADA');
    }
    return {
      ok: true,
      message: `Pedido #${existente.number} enviado!`,
      pedido: { id: existente.id, number: existente.number, status: existente.status },
      repetido: true,
    };
  };

  const jaCriado = await pedidoDaChave();
  if (jaCriado) return jaCriado;

  const carrinho = await carregarCarrinho(usuario.id, dados.storeId);

  if (!carrinho || carrinho.itens.length === 0) {
    // Com chave, carrinho vazio pode ser o envio gêmeo que acabou de fechar o
    // pedido: o carrinho some na mesma transação que grava a chave.
    return (await pedidoDaChave()) ?? falha('Seu carrinho está vazio.', 'CARRINHO_VAZIO');
  }

  const loja = await prisma.store.findFirst({
    where: { id: dados.storeId, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true,
      cityId: true,
      slug: true,
      acceptsPix: true,
      acceptsCardOnline: true,
      acceptsCashOnDelivery: true,
      acceptsCardOnDelivery: true,
      acceptsPickup: true,
      autoAcceptOrders: true,
      name: true,
      pixKey: true,
      settlementMode: true,
      city: { select: { name: true } },
      avgPrepTimeMinutes: true,
      isPausedUntil: true,
      pauseReason: true,
      hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
      closures: {
        where: { endsAt: { gte: new Date() } },
        select: { startsAt: true, endsAt: true, reason: true },
      },
      subscription: { select: { plan: { select: { commissionRate: true } } } },
      segment: true,
    },
  });

  if (!loja) return falha('Loja indisponível.', 'LOJA_INDISPONIVEL');

  // ---- Regras de cada ramo ------------------------------------------------

  // Bebida alcoólica e afins (Lei 13.106/15): o cliente declara ter 18 anos
  // e o entregador confere o documento com foto na entrega.
  if (carrinho.exigeMaioridade && !entrada.confirmaMaioridade) {
    return falha(
      'Confirme que você tem 18 anos ou mais para pedir este item.',
      'MAIORIDADE_OBRIGATORIA',
      { confirmaMaioridade: 'Obrigatório para item +18' },
    );
  }

  // Remédio que exige receita (RDC 44/2009): a foto vai para o farmacêutico
  // avaliar; a receita original é conferida na entrega. Controlado nem chega
  // aqui — é barrado ao entrar no carrinho.
  let receitaId: string | null = null;
  if (carrinho.exigeReceita) {
    const enviada = entrada.prescriptionImageId ?? '';
    const receita = enviada
      ? await prisma.mediaAsset.findFirst({
          where: { id: enviada, context: 'PRESCRIPTION', uploadedById: usuario.id },
          select: { id: true },
        })
      : null;
    if (!receita) {
      return falha(
        'Envie a foto da receita: a farmácia precisa avaliar antes de separar.',
        'RECEITA_OBRIGATORIA',
        { prescriptionImageId: 'Foto da receita obrigatória' },
      );
    }
    receitaId = receita.id;
  }

  // Mercado: o que fazer se um item faltar na separação.
  const politicas = ['SUBSTITUTE_SIMILAR', 'CONTACT_ME', 'REMOVE_ITEM'] as const;
  const escolhida = entrada.substitutionPolicy ?? '';
  const politicaDeSubstituicao =
    loja.segment === 'MARKET'
      ? (politicas.find((politica) => politica === escolhida) ?? 'CONTACT_ME')
      : null;

  // A loja pode ter fechado entre montar o carrinho e confirmar: deixar
  // passar geraria um pedido que ninguém vai preparar.
  const abertura = isStoreOpen({
    hours: loja.hours,
    closures: loja.closures,
    pausedUntil: loja.isPausedUntil,
    pauseReason: loja.pauseReason,
  });

  if (!abertura.isOpen) {
    return falha(`A loja fechou. ${abertura.reason ?? ''}`.trim(), 'LOJA_FECHADA');
  }

  if (dados.type === 'PICKUP' && !loja.acceptsPickup) {
    return falha('Esta loja não aceita retirada no local.', 'REGRA_DE_NEGOCIO');
  }

  const aceita = formasDePagamentoAceitas(loja, { pixPeloGateway: entrada.pixPeloGateway });

  if (!aceita[dados.paymentMethod]) {
    return falha('Esta loja não aceita essa forma de pagamento.', 'PAGAMENTO_NAO_ACEITO');
  }

  const resumo = await calcularCheckout({
    carrinho,
    userId: usuario.id,
    cityId: loja.cityId,
    tipo: dados.type,
    addressId: dados.addressId ?? null,
    couponCode: dados.couponCode ?? null,
  });

  if (resumo.bloqueio) return falha(resumo.bloqueio);

  if (dados.paymentMethod === 'CASH_ON_DELIVERY' && dados.changeForCents != null) {
    if (dados.changeForCents < resumo.totalCents) {
      return falha('O valor do troco precisa ser maior que o total do pedido.', 'TROCO_INVALIDO', {
        changeForCents: 'Valor menor que o total',
      });
    }
  }

  const endereco =
    dados.type === 'DELIVERY' && dados.addressId
      ? await prisma.address.findFirst({
          // Mesma cidade da loja e não excluído: o cálculo já barra, mas a
          // ação não confia no que a tela mandou.
          where: {
            id: dados.addressId,
            userId: usuario.id,
            cityId: loja.cityId,
            deletedAt: null,
          },
          select: {
            id: true,
            street: true,
            number: true,
            complement: true,
            neighborhood: true,
            referencePoint: true,
            zipCode: true,
          },
        })
      : null;

  const nomeDoCliente = dados.customerName ?? usuario.name;
  const telefoneDoCliente = dados.customerPhone
    ? normalizePhoneBR(dados.customerPhone)
    : usuario.phone;

  if (!nomeDoCliente || !telefoneDoCliente) {
    return falha(
      'Informe seu nome e telefone para a loja entrar em contato.',
      'DADOS_INVALIDOS',
      nomeDoCliente ? undefined : { customerName: 'Informe seu nome' },
    );
  }

  const numero = await gerarNumeroDoPedido();
  const comissao = COMISSAO_HABILITADA ? Number(loja.subscription?.plan.commissionRate ?? 0) : 0;

  // Pagamento online só vira pedido de verdade quando o dinheiro entra: até
  // lá fica em PENDING_PAYMENT e nem aparece na tela do lojista. Pagamento
  // na entrega entra direto, porque o acerto é com o entregador.
  const pagamentoOnline =
    dados.paymentMethod === 'PIX' || dados.paymentMethod === 'CREDIT_CARD_ONLINE';

  const statusInicial = pagamentoOnline
    ? 'PENDING_PAYMENT'
    : // O aceite automático pula a confirmação para lojas que sempre aceitam.
      loja.autoAcceptOrders
      ? 'ACCEPTED'
      : 'RECEIVED';

  let pedido: { id: string; number: string; status: string };
  try {
    pedido = await prisma.$transaction(async (tx) => {
      // Baixa do estoque dentro da mesma transação do pedido: se dois clientes
      // pedirem a última unidade ao mesmo tempo, só o primeiro leva — o
      // `updateMany` condicionado a "tem estoque suficiente" não deixa passar
      // o segundo, e a transação inteira volta.
      const porProduto = new Map<string, number>();
      for (const item of carrinho.itens) {
        if (item.productId && item.sellingUnit !== 'WEIGHT_KG') {
          porProduto.set(item.productId, (porProduto.get(item.productId) ?? 0) + item.quantidade);
        }
      }
      const controlados = await tx.product.findMany({
        where: { id: { in: [...porProduto.keys()] }, stockQuantity: { not: null } },
        select: { id: true, name: true },
      });
      for (const produto of controlados) {
        const quantidade = porProduto.get(produto.id)!;
        const { count } = await tx.product.updateMany({
          where: { id: produto.id, stockQuantity: { gte: quantidade } },
          data: { stockQuantity: { decrement: quantidade } },
        });
        if (count === 0) throw new EstoqueInsuficiente(produto.name);
      }

      const criado = await tx.order.create({
        data: {
          number: numero,
          cityId: loja.cityId,
          storeId: loja.id,
          userId: usuario.id,
          idempotencyKey: entrada.chaveDeIdempotencia ?? null,
          type: dados.type,
          status: statusInicial,
          customerName: nomeDoCliente,
          customerPhone: telefoneDoCliente,
          addressId: endereco?.id ?? null,
          // Snapshot: o cliente pode editar o endereço depois, e a comanda
          // precisa continuar mostrando para onde foi entregue.
          addressSnapshot: endereco
            ? {
                street: endereco.street,
                number: endereco.number,
                complement: endereco.complement,
                neighborhood: endereco.neighborhood,
                referencePoint: endereco.referencePoint,
                zipCode: endereco.zipCode,
              }
            : undefined,
          subtotalCents: resumo.subtotalCents,
          deliveryFeeCents: resumo.deliveryFeeCents,
          discountCents: resumo.discountCents,
          totalCents: resumo.totalCents,
          commissionCents: resumo.commissionCents,
          commissionRate: comissao,
          couponId: resumo.couponId,
          notes: dados.notes ?? null,
          substitutionPolicy: politicaDeSubstituicao,
          ageConfirmedAt: carrinho.exigeMaioridade ? new Date() : null,
          prescriptionImageId: receitaId,
          estimatedPrepMinutes: loja.avgPrepTimeMinutes,
          ...(statusInicial === 'ACCEPTED' ? { acceptedAt: new Date() } : {}),
          items: {
            create: carrinho.itens.map((item) => ({
              productId: item.productId,
              productName: item.nome,
              productType: item.pizza ? 'PIZZA' : 'SIMPLE',
              quantity: item.quantidade,
              weightGrams: item.weightGrams,
              unitPriceCents: item.unitTotalCents,
              totalCents: item.totalCents,
              notes: item.observacao,
              pizzaSizeName: item.pizza?.tamanho ?? null,
              pizzaExtraName: item.pizza?.extra ?? null,
              complements: {
                create: item.complementos.map((complemento) => ({
                  optionId: complemento.optionId,
                  groupName: complemento.grupo,
                  optionName: complemento.nome,
                  quantity: complemento.quantidade,
                  priceCents: complemento.precoCents,
                })),
              },
              flavors: {
                create: (item.pizza?.sabores ?? []).map((sabor) => ({
                  flavorId: sabor.id,
                  flavorName: sabor.nome,
                  priceCents: sabor.precoCents,
                })),
              },
              pizzaExtraPriceCents: item.pizza?.extraPrecoCents ?? null,
              pizzaExtras: {
                create: (item.pizza?.extras ?? []).map((extra) => ({
                  extraId: extra.id,
                  name: extra.nome,
                  kind: extra.tipo,
                  priceCents: extra.precoCents,
                })),
              },
            })),
          },
          statusHistory: {
            create: { status: statusInicial, changedById: usuario.id },
          },
          payment: {
            create: {
              method: dados.paymentMethod,
              // Sempre PENDING no início: Pix e cartão aguardam o webhook,
              // dinheiro e maquininha são acertados na entrega.
              status: 'PENDING',
              provider: pagamentoOnline ? undefined : 'OFFLINE',
              amountCents: resumo.totalCents,
              changeForCents: dados.changeForCents ?? null,
              platformFeeCents: resumo.commissionCents,
              settlementMode: loja.settlementMode,
            },
          },
        },
        select: { id: true, number: true, status: true },
      });

      if (resumo.couponId) {
        await tx.couponRedemption.create({
          data: {
            couponId: resumo.couponId,
            userId: usuario.id,
            orderId: criado.id,
            discountCents: resumo.discountCents,
          },
        });
        await tx.coupon.update({
          where: { id: resumo.couponId },
          data: { usageCount: { increment: 1 } },
        });
      }

      // O carrinho só some depois que o pedido existe: falhar no meio deixaria
      // o cliente sem carrinho e sem pedido.
      await tx.cart.delete({ where: { id: carrinho.id } });

      return criado;
    });
  } catch (error) {
    if (error instanceof EstoqueInsuficiente) {
      return falha(
        `Acabou o estoque de "${error.produto}" enquanto você finalizava. Ajuste o carrinho e tente de novo.`,
        'ESTOQUE_INSUFICIENTE',
      );
    }
    // Dois envios com a mesma chave ao mesmo tempo: o índice único deixa um só
    // passar, a transação do outro volta inteira e ele responde com o que ficou.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      String(error.meta?.target).includes('idempotencyKey')
    ) {
      const existente = await pedidoDaChave();
      if (existente) return existente;
    }
    throw error;
  }

  if (dados.paymentMethod === 'PIX') {
    await gerarCobrancaPix({
      orderId: pedido.id,
      numero: pedido.number,
      totalCents: resumo.totalCents,
      comissaoCents: resumo.commissionCents,
      cliente: { nome: nomeDoCliente, telefone: telefoneDoCliente },
      loja: {
        nome: loja.name,
        cidade: loja.city.name,
        pixKey: loja.pixKey,
        recebeDireto: loja.settlementMode === 'STORE_COLLECTS',
      },
    });
  }

  // Pedido aguardando pagamento ainda não é trabalho para a loja: o aviso
  // sai quando o webhook confirmar.
  // Exceção: Pix na chave da loja não tem webhook, quem confirma é o lojista
  // ("Pix para conferir" no painel), então a loja precisa saber já.
  const pixNaChaveDaLoja =
    dados.paymentMethod === 'PIX' && loja.settlementMode === 'STORE_COLLECTS' && !!loja.pixKey;
  if (statusInicial !== 'PENDING_PAYMENT' || pixNaChaveDaLoja) {
    await publishRealtime(REALTIME_CHANNELS.store(loja.id), REALTIME_EVENTS.orderCreated, {
      orderId: pedido.id,
      number: pedido.number,
    });
  }

  await agendarAcompanhamento({
    orderId: pedido.id,
    status: statusInicial,
    // Pix direto na chave da loja é confirmado à mão pelo lojista: cancelar
    // sozinho poderia derrubar um pedido já pago. Só o gateway, que avisa
    // pelo webhook, tem prazo automático.
    expiraSozinho: statusInicial === 'PENDING_PAYMENT' && !pixNaChaveDaLoja,
  });

  // Nome digitado no primeiro pedido vai para o perfil: no próximo, o
  // checkout não pergunta de novo, e a loja e o painel deixam de ver "Sem nome".
  if (!usuario.name && dados.customerName) {
    await prisma.user.update({ where: { id: usuario.id }, data: { name: dados.customerName } });
  }


  return {
    ok: true,
    message: `Pedido #${pedido.number} enviado!`,
    pedido,
    repetido: false,
  };
}

/**
 * O que precisa ser conferido depois que o pedido existe:
 *
 * - pagamento online não confirmado em 35 min (30 da cobrança + folga) é
 *   cancelado e devolve o cupom — o job existia, mas nunca era agendado;
 * - pedido que entrou para a loja e não foi aceito em alguns minutos vira
 *   lembrete para a equipe dela.
 *
 * Falha na fila não derruba o pedido, que já está gravado.
 */
async function agendarAcompanhamento(entrada: {
  orderId: string;
  status: string;
  expiraSozinho: boolean;
}): Promise<void> {
  try {
    if (entrada.expiraSozinho) {
      await agendarExpiracaoDePedido({ orderId: entrada.orderId }, 35 * 60);
    }
    if (entrada.status === 'RECEIVED') {
      await agendarLembreteDaLoja({ orderId: entrada.orderId });
    }
  } catch (error) {
    void capturarErro(error, { origem: 'checkout-agendamento', orderId: entrada.orderId });
  }
}

/**
 * Cria a cobrança Pix do pedido.
 *
 * Duas situações, e as duas existem no interior:
 *
 * - a loja recebe direto na própria chave (STORE_COLLECTS): geramos o BR Code
 *   nós mesmos, sem intermediário e sem tarifa. A confirmação é manual, pelo
 *   lojista — que é como ele já faz hoje no balcão;
 * - a plataforma intermedia: o gateway cria a cobrança, devolve o QR e avisa
 *   pelo webhook quando o dinheiro cai.
 *
 * Falhar aqui NÃO derruba o pedido: ele já está gravado. O cliente vê a tela
 * de pagamento pedindo para tentar de novo, em vez de perder tudo o que montou.
 */
async function gerarCobrancaPix(entrada: {
  orderId: string;
  numero: string;
  totalCents: number;
  comissaoCents: number;
  cliente: { nome: string; telefone: string };
  loja: { nome: string; cidade: string; pixKey: string | null; recebeDireto: boolean };
}): Promise<void> {
  try {
    if (entrada.loja.recebeDireto && entrada.loja.pixKey) {
      await prisma.payment.update({
        where: { orderId: entrada.orderId },
        data: {
          provider: 'OFFLINE',
          pixQrCode: buildPixBrCode({
            pixKey: entrada.loja.pixKey,
            amountCents: entrada.totalCents,
            merchantName: entrada.loja.nome,
            merchantCity: entrada.loja.cidade,
            txid: entrada.numero,
            description: `Pedido ${entrada.numero}`,
          }),
          pixExpiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });
      return;
    }

    const cobranca = await getPaymentGateway().createPixCharge({
      orderId: entrada.orderId,
      amountCents: entrada.totalCents,
      description: `Pedido ${entrada.numero} — ${entrada.loja.nome}`,
      payer: { name: entrada.cliente.nome, phone: entrada.cliente.telefone },
      expiresInSeconds: 30 * 60,
      platformFeeCents: entrada.comissaoCents,
    });

    await prisma.payment.update({
      where: { orderId: entrada.orderId },
      data: {
        externalId: cobranca.externalId,
        pixQrCode: cobranca.qrCode,
        pixQrCodeImage: cobranca.qrCodeImage ?? null,
        pixExpiresAt: cobranca.expiresAt ?? null,
      },
    });
  } catch (error) {
    void capturarErro(error, { origem: 'checkout-pix', orderId: entrada.orderId });
  }
}
