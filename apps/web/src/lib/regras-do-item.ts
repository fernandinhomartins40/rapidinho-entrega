import type { z } from 'zod';
import { prisma } from '@rapidinho/database';
import type { addToCartSchema } from '@rapidinho/shared';

/**
 * As regras de um item antes de ele entrar no carrinho — de cada ramo.
 *
 * A tela ajuda o cliente a montar certo, mas a tela não é autorização: tudo o
 * que ela confere é conferido de novo aqui, no servidor.
 *
 * - Restaurante: complemento só dos grupos do próprio produto; grupo
 *   obrigatório tem de vir preenchido; mínimo e máximo de cada grupo; opção
 *   repetida só onde o grupo permite ("2x bacon").
 * - Pizzaria: tamanho ativo, sabores disponíveis e com preço naquele tamanho,
 *   até o máximo do tamanho; no máximo uma borda e uma massa; adicionais
 *   quantos quiser.
 * - Mercado: produto por peso com peso escolhido, acima do mínimo; estoque.
 * - Farmácia: remédio controlado (Portaria 344/98) não se vende à distância.
 */

type ItemDoCarrinho = z.infer<typeof addToCartSchema>['item'];

export type ResultadoDaRegra = { ok: true } | { ok: false; message: string };

const falha = (message: string): ResultadoDaRegra => ({ ok: false, message });

export async function validarItem(
  storeId: string,
  item: ItemDoCarrinho,
  opcoes: { quantidadeJaNoCarrinho?: number } = {},
): Promise<ResultadoDaRegra> {
  if (item.productId) {
    const regra = await validarProduto(storeId, item, opcoes.quantidadeJaNoCarrinho ?? 0);
    if (!regra.ok) return regra;
  }

  if (item.pizzaSizeId) {
    const regra = await validarPizza(storeId, item);
    if (!regra.ok) return regra;
  }

  return { ok: true };
}

async function validarProduto(
  storeId: string,
  item: ItemDoCarrinho,
  quantidadeJaNoCarrinho: number,
): Promise<ResultadoDaRegra> {
  const produto = await prisma.product.findFirst({
    where: { id: item.productId!, storeId, deletedAt: null },
    select: {
      isAvailable: true,
      pausedUntil: true,
      sellingUnit: true,
      minWeightGrams: true,
      weightStepGrams: true,
      stockQuantity: true,
      prescription: true,
      complementGroups: {
        select: {
          group: {
            select: {
              id: true,
              name: true,
              isActive: true,
              isRequired: true,
              minChoices: true,
              maxChoices: true,
              allowRepeat: true,
            },
          },
        },
      },
    },
  });

  if (!produto) return falha('Produto não encontrado nesta loja.');

  const pausado = produto.pausedUntil != null && produto.pausedUntil > new Date();
  if (!produto.isAvailable || pausado) return falha('Este produto está indisponível no momento.');

  if (produto.prescription === 'CONTROLLED') {
    return falha(
      'Remédio de controle especial não pode ser vendido pelo app — só no balcão da farmácia, com a receita.',
    );
  }

  if (produto.sellingUnit === 'WEIGHT_KG') {
    if (!item.weightGrams) return falha('Escolha o peso que você quer.');
    if (produto.minWeightGrams && item.weightGrams < produto.minWeightGrams) {
      return falha(`O mínimo é ${produto.minWeightGrams} g.`);
    }
  } else if (produto.stockQuantity != null) {
    // Estoque conta o que já está no carrinho: pedir 3 e depois mais 3 de um
    // item com 4 em estoque não pode passar.
    const total = quantidadeJaNoCarrinho + item.quantity;
    if (produto.stockQuantity <= 0) return falha('Produto esgotado.');
    if (total > produto.stockQuantity) {
      return falha(
        `Só temos ${produto.stockQuantity} em estoque${quantidadeJaNoCarrinho ? ` (você já tem ${quantidadeJaNoCarrinho} no carrinho)` : ''}.`,
      );
    }
  }

  return validarComplementos(
    produto.complementGroups.map((vinculo) => vinculo.group).filter((grupo) => grupo.isActive),
    item.complements,
  );
}

interface GrupoDoProduto {
  id: string;
  name: string;
  isRequired: boolean;
  minChoices: number;
  maxChoices: number;
  allowRepeat: boolean;
}

async function validarComplementos(
  grupos: GrupoDoProduto[],
  escolhidos: ItemDoCarrinho['complements'],
): Promise<ResultadoDaRegra> {
  const idsDosGrupos = grupos.map((grupo) => grupo.id);

  const opcoes = escolhidos.length
    ? await prisma.complementOption.findMany({
        where: {
          id: { in: escolhidos.map((escolha) => escolha.optionId) },
          isAvailable: true,
          // Só opção de grupo ligado A ESTE produto: sem isso dava para pôr no
          // lanche o adicional barato de outro item da loja.
          groupId: { in: idsDosGrupos },
        },
        select: { id: true, groupId: true },
      })
    : [];

  if (opcoes.length !== new Set(escolhidos.map((escolha) => escolha.optionId)).size) {
    return falha('Uma das opções escolhidas não está disponível para este produto.');
  }

  const grupoDaOpcao = new Map(opcoes.map((opcao) => [opcao.id, opcao.groupId]));

  for (const grupo of grupos) {
    const doGrupo = escolhidos.filter((escolha) => grupoDaOpcao.get(escolha.optionId) === grupo.id);
    const total = doGrupo.reduce((soma, escolha) => soma + escolha.quantity, 0);
    const minimo = Math.max(grupo.minChoices, grupo.isRequired ? 1 : 0);

    if (!grupo.allowRepeat && doGrupo.some((escolha) => escolha.quantity > 1)) {
      return falha(`Em "${grupo.name}" cada opção pode ser escolhida uma vez só.`);
    }
    if (total < minimo) {
      return falha(
        minimo === 1
          ? `Escolha uma opção em "${grupo.name}".`
          : `Escolha pelo menos ${minimo} em "${grupo.name}".`,
      );
    }
    if (total > grupo.maxChoices) {
      return falha(`Em "${grupo.name}" você pode escolher no máximo ${grupo.maxChoices}.`);
    }
  }

  return { ok: true };
}

async function validarPizza(storeId: string, item: ItemDoCarrinho): Promise<ResultadoDaRegra> {
  const tamanho = await prisma.pizzaSize.findFirst({
    where: { id: item.pizzaSizeId!, storeId, isActive: true },
    select: { id: true, maxFlavors: true, name: true },
  });
  if (!tamanho) return falha('Tamanho de pizza não encontrado.');

  if (item.flavorIds.length === 0) return falha('Escolha pelo menos um sabor.');
  if (item.flavorIds.length > tamanho.maxFlavors) {
    return falha(
      `A ${tamanho.name} aceita no máximo ${tamanho.maxFlavors} ${tamanho.maxFlavors === 1 ? 'sabor' : 'sabores'}.`,
    );
  }

  // Sabor precisa estar disponível E ter preço neste tamanho: sabor sem preço
  // no tamanho sairia de graça.
  const sabores = await prisma.pizzaFlavor.count({
    where: {
      id: { in: item.flavorIds },
      storeId,
      isAvailable: true,
      prices: { some: { sizeId: tamanho.id } },
    },
  });
  if (sabores !== new Set(item.flavorIds).size) {
    return falha('Um dos sabores escolhidos não está disponível neste tamanho.');
  }

  const idsDosExtras = [
    ...new Set([...item.pizzaExtraIds, ...(item.pizzaExtraId ? [item.pizzaExtraId] : [])]),
  ];
  if (idsDosExtras.length) {
    const extras = await prisma.pizzaExtra.findMany({
      where: { id: { in: idsDosExtras }, storeId, isAvailable: true },
      select: { kind: true },
    });
    if (extras.length !== idsDosExtras.length) {
      return falha('Uma borda, massa ou adicional escolhido não está disponível.');
    }
    if (extras.filter((extra) => extra.kind === 'EDGE').length > 1) {
      return falha('Escolha uma borda só.');
    }
    if (extras.filter((extra) => extra.kind === 'CRUST').length > 1) {
      return falha('Escolha um tipo de massa só.');
    }
  }

  return { ok: true };
}

/** Os extras da pizza normalizados (legado + lista), sem repetição. */
export function extrasDaPizza(item: ItemDoCarrinho): string[] {
  return [...new Set([...item.pizzaExtraIds, ...(item.pizzaExtraId ? [item.pizzaExtraId] : [])])];
}
