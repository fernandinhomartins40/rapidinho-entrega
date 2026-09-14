import { prisma } from '@rapidinho/database';
import {
  calculateCartItem,
  calculateOrderTotals,
  type CartItemPricingInput,
  type OrderTotals,
} from '@rapidinho/shared';
import { imagemExibivel, SELECT_IMAGEM } from './media';

/**
 * Leitura e precificação do carrinho.
 *
 * Regra que não se quebra: o preço NUNCA vem do cliente. O carrinho guarda
 * escolhas (qual produto, quais complementos, quantos gramas) e os valores são
 * recalculados aqui a partir do catálogo, a cada leitura. É isso que impede
 * que um preço alterado no navegador chegue ao pedido.
 *
 * Como efeito colateral desejado, o carrinho também acompanha mudança de preço
 * da loja: item guardado ontem por R$ 10 aparece hoje pelo preço de hoje.
 */

export interface ItemDoCarrinho {
  id: string;
  productId: string | null;
  nome: string;
  quantidade: number;
  weightGrams: number | null;
  sellingUnit: 'UNIT' | 'WEIGHT_KG';
  observacao: string | null;
  imagem: { url: string | null; blurDataUrl: string | null };
  /// Indisponível desde que o item entrou no carrinho.
  indisponivel: boolean;
  /// `grupo` e `optionId` seguem para o snapshot do pedido: a comanda precisa
  /// dizer de qual grupo veio cada escolha, mesmo que o grupo mude depois.
  complementos: {
    id: string;
    optionId: string;
    grupo: string;
    nome: string;
    quantidade: number;
    precoCents: number;
  }[];
  pizza: {
    tamanho: string;
    /// Preço de cada sabor naquele tamanho, para auditar a regra aplicada.
    sabores: { id: string; nome: string; precoCents: number }[];
    extra: string | null;
    extraPrecoCents: number;
  } | null;
  unitTotalCents: number;
  totalCents: number;
}

export interface CarrinhoResolvido {
  id: string;
  storeId: string;
  loja: {
    nome: string;
    slug: string;
    minOrderCents: number;
    commissionRate: number;
  };
  itens: ItemDoCarrinho[];
  couponId: string | null;
  addressId: string | null;
  notes: string | null;
  /// Totais SEM entrega nem desconto: dependem de endereço e cupom.
  subtotalCents: number;
  temIndisponivel: boolean;
}

/** Carrega o carrinho do usuário numa loja, já com preços recalculados. */
export async function carregarCarrinho(
  userId: string,
  storeId: string,
): Promise<CarrinhoResolvido | null> {
  const carrinho = await prisma.cart.findUnique({
    where: { userId_storeId: { userId, storeId } },
    select: {
      id: true,
      storeId: true,
      couponId: true,
      addressId: true,
      notes: true,
      store: {
        select: {
          name: true,
          slug: true,
          minOrderCents: true,
          pizzaPricingRule: true,
          subscription: { select: { plan: { select: { commissionRate: true } } } },
        },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          quantity: true,
          weightGrams: true,
          notes: true,
          product: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              sellingUnit: true,
              isAvailable: true,
              pausedUntil: true,
              deletedAt: true,
              image: { select: SELECT_IMAGEM },
            },
          },
          pizzaSize: { select: { id: true, name: true, maxFlavors: true } },
          pizzaExtra: { select: { name: true, priceCents: true, isAvailable: true } },
          complements: {
            select: {
              id: true,
              quantity: true,
              option: {
                select: {
                  id: true,
                  name: true,
                  priceCents: true,
                  isAvailable: true,
                  group: { select: { name: true } },
                },
              },
            },
          },
          flavors: {
            select: {
              flavor: {
                select: {
                  id: true,
                  name: true,
                  isAvailable: true,
                  prices: { select: { sizeId: true, priceCents: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!carrinho) return null;

  const regraDePizza = carrinho.store.pizzaPricingRule as 'HIGHEST_PRICE' | 'AVERAGE_PRICE';
  const itens: ItemDoCarrinho[] = [];

  for (const item of carrinho.items) {
    const complementos = item.complements.map((complemento) => ({
      id: complemento.id,
      nome: complemento.option.name,
      quantidade: complemento.quantity,
      precoCents: complemento.option.priceCents,
      disponivel: complemento.option.isAvailable,
      groupName: complemento.option.group.name,
      optionId: complemento.option.id,
    }));

    const entrada: CartItemPricingInput = item.pizzaSize
      ? {
          productName: `Pizza ${item.pizzaSize.name}`,
          unitPriceCents: 0,
          quantity: item.quantity,
          sellingUnit: 'UNIT',
          complements: complementos.map((c) => ({
            optionId: c.optionId,
            groupName: c.groupName,
            optionName: c.nome,
            priceCents: c.precoCents,
            quantity: c.quantidade,
          })),
          pizza: {
            rule: regraDePizza,
            maxFlavors: item.pizzaSize.maxFlavors,
            extraPriceCents: item.pizzaExtra?.priceCents ?? 0,
            flavors: item.flavors.map((sabor) => ({
              flavorId: sabor.flavor.id,
              name: sabor.flavor.name,
              priceCents:
                sabor.flavor.prices.find((preco) => preco.sizeId === item.pizzaSize?.id)
                  ?.priceCents ?? 0,
            })),
          },
        }
      : {
          productName: item.product?.name ?? 'Produto',
          unitPriceCents: item.product?.priceCents ?? 0,
          quantity: item.quantity,
          sellingUnit: (item.product?.sellingUnit ?? 'UNIT') as 'UNIT' | 'WEIGHT_KG',
          weightGrams: item.weightGrams,
          complements: complementos.map((c) => ({
            optionId: c.optionId,
            groupName: c.groupName,
            optionName: c.nome,
            priceCents: c.precoCents,
            quantity: c.quantidade,
          })),
        };

    const preco = calculateCartItem(entrada);

    // Um item vira indisponível quando qualquer peça dele sai do ar: o
    // produto, um sabor ou um complemento escolhido. Avisar antes do checkout
    // é melhor que a loja recusar o pedido depois.
    const indisponivel = item.pizzaSize
      ? item.flavors.some((sabor) => !sabor.flavor.isAvailable)
      : !item.product ||
        item.product.deletedAt != null ||
        !item.product.isAvailable ||
        (item.product.pausedUntil != null && item.product.pausedUntil > new Date());

    itens.push({
      id: item.id,
      productId: item.product?.id ?? null,
      nome: item.pizzaSize
        ? `Pizza ${item.pizzaSize.name}`
        : (item.product?.name ?? 'Produto removido'),
      quantidade: item.quantity,
      weightGrams: item.weightGrams,
      sellingUnit: (item.product?.sellingUnit ?? 'UNIT') as 'UNIT' | 'WEIGHT_KG',
      observacao: item.notes,
      imagem: imagemExibivel(item.product?.image),
      indisponivel: indisponivel || complementos.some((c) => !c.disponivel),
      complementos: complementos.map((c) => ({
        id: c.id,
        optionId: c.optionId,
        grupo: c.groupName,
        nome: c.nome,
        quantidade: c.quantidade,
        precoCents: c.precoCents,
      })),
      pizza: item.pizzaSize
        ? {
            tamanho: item.pizzaSize.name,
            sabores: item.flavors.map((sabor) => ({
              id: sabor.flavor.id,
              nome: sabor.flavor.name,
              precoCents:
                sabor.flavor.prices.find((preco) => preco.sizeId === item.pizzaSize?.id)
                  ?.priceCents ?? 0,
            })),
            extra: item.pizzaExtra?.name ?? null,
            extraPrecoCents: item.pizzaExtra?.priceCents ?? 0,
          }
        : null,
      unitTotalCents: preco.unitTotalCents,
      totalCents: preco.totalCents,
    });
  }

  return {
    id: carrinho.id,
    storeId: carrinho.storeId,
    loja: {
      nome: carrinho.store.name,
      slug: carrinho.store.slug,
      minOrderCents: carrinho.store.minOrderCents,
      commissionRate: Number(carrinho.store.subscription?.plan.commissionRate ?? 0),
    },
    itens,
    couponId: carrinho.couponId,
    addressId: carrinho.addressId,
    notes: carrinho.notes,
    subtotalCents: itens.reduce((soma, item) => soma + item.totalCents, 0),
    temIndisponivel: itens.some((item) => item.indisponivel),
  };
}

/** Totais finais, já com entrega e desconto. */
export function totaisDoCarrinho(
  carrinho: CarrinhoResolvido,
  deliveryFeeCents: number,
  discountCents: number,
): OrderTotals {
  return calculateOrderTotals({
    // Os itens já foram precificados; reaproveita o total de cada um.
    items: carrinho.itens.map((item) => ({
      productName: item.nome,
      unitPriceCents: item.unitTotalCents,
      quantity: item.quantidade,
      sellingUnit: 'UNIT' as const,
    })),
    deliveryFeeCents,
    discountCents,
    commissionRate: carrinho.loja.commissionRate,
  });
}

/** Quantos itens o usuário tem no carrinho, para o contador da navegação. */
export async function contarItensDoCarrinho(userId: string): Promise<number> {
  const resultado = await prisma.cartItem.aggregate({
    where: { cart: { userId } },
    _sum: { quantity: true },
  });

  return resultado._sum.quantity ?? 0;
}
