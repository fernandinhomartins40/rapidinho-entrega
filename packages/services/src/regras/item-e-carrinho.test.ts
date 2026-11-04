import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaFalso as prisma, zerarPrisma } from './apoio-de-teste';

vi.mock('@rapidinho/database', async () => (await import('./apoio-de-teste')).databaseFalso);

import { adicionarItemAoCarrinho, alterarQuantidadeDoItem, carregarCarrinho } from './carrinho';
import { validarItem } from './item';

const item = (extra = {}) => ({
  productId: 'p1',
  quantity: 1,
  complements: [],
  pizzaExtraIds: [],
  flavorIds: [],
  marmita: [],
  ...extra,
});

const produto = (extra = {}) => ({
  isAvailable: true,
  pausedUntil: null,
  sellingUnit: 'UNIT',
  minWeightGrams: null,
  weightStepGrams: null,
  stockQuantity: null,
  prescription: 'NONE',
  complementGroups: [],
  ...extra,
});

beforeEach(() => zerarPrisma());

describe('validarItem', () => {
  it('barra remédio controlado', async () => {
    prisma.product!.findFirst!.mockResolvedValue(produto({ prescription: 'CONTROLLED' }));
    expect((await validarItem('l1', item())).ok).toBe(false);
  });

  it('o estoque conta o que já está no carrinho', async () => {
    prisma.product!.findFirst!.mockResolvedValue(produto({ stockQuantity: 4 }));
    const resultado = await validarItem('l1', item({ quantity: 3 }), { quantidadeJaNoCarrinho: 3 });
    expect(resultado).toMatchObject({ ok: false, message: expect.stringContaining('Só temos 4') });
  });

  it('produto por peso exige peso acima do mínimo', async () => {
    prisma.product!.findFirst!.mockResolvedValue(
      produto({ sellingUnit: 'WEIGHT_KG', minWeightGrams: 200 }),
    );
    expect(await validarItem('l1', item())).toMatchObject({
      message: 'Escolha o peso que você quer.',
    });
    expect(await validarItem('l1', item({ weightGrams: 100 }))).toMatchObject({
      message: 'O mínimo é 200 g.',
    });
  });

  it('grupo obrigatório precisa vir preenchido', async () => {
    prisma.product!.findFirst!.mockResolvedValue(
      produto({
        complementGroups: [
          {
            group: {
              id: 'g1',
              name: 'Ponto',
              isActive: true,
              isRequired: true,
              minChoices: 0,
              maxChoices: 1,
              allowRepeat: false,
            },
          },
        ],
      }),
    );
    expect(await validarItem('l1', item())).toMatchObject({
      message: 'Escolha uma opção em "Ponto".',
    });
  });

  it('pizza respeita o máximo de sabores do tamanho', async () => {
    prisma.pizzaSize!.findFirst!.mockResolvedValue({ id: 't1', maxFlavors: 1, name: 'Broto' });
    const pizza = item({ productId: undefined, pizzaSizeId: 't1', flavorIds: ['a', 'b'] });
    expect(await validarItem('l1', pizza)).toMatchObject({ ok: false });
  });

  it('sabor sem preço no tamanho não passa: sairia de graça', async () => {
    prisma.pizzaSize!.findFirst!.mockResolvedValue({ id: 't1', maxFlavors: 2, name: 'G' });
    prisma.pizzaFlavor!.count!.mockResolvedValue(1);
    const pizza = item({ productId: undefined, pizzaSizeId: 't1', flavorIds: ['a', 'b'] });
    expect((await validarItem('l1', pizza)).ok).toBe(false);
  });

  it('aceita uma borda só', async () => {
    prisma.pizzaSize!.findFirst!.mockResolvedValue({ id: 't1', maxFlavors: 2, name: 'G' });
    prisma.pizzaFlavor!.count!.mockResolvedValue(1);
    prisma.pizzaExtra!.findMany!.mockResolvedValue([{ kind: 'EDGE' }, { kind: 'EDGE' }]);
    const pizza = item({
      productId: undefined,
      pizzaSizeId: 't1',
      flavorIds: ['a'],
      pizzaExtraIds: ['e1', 'e2'],
    });
    expect(await validarItem('l1', pizza)).toMatchObject({ message: 'Escolha uma borda só.' });
  });
});

describe('adicionarItemAoCarrinho', () => {
  const entrada = { storeId: 'l1', item: { productId: 'p1', quantity: 2 } };

  beforeEach(() => {
    prisma.store!.findFirst!.mockResolvedValue({ id: 'l1', slug: 'loja' });
    prisma.cartItem!.aggregate!.mockResolvedValue({ _sum: { quantity: 0 } });
    prisma.product!.findFirst!.mockResolvedValue(produto());
    prisma.cart!.upsert!.mockResolvedValue({ id: 'c1' });
    prisma.cartItem!.findFirst!.mockResolvedValue(null);
  });

  it('loja fora do ar não recebe item', async () => {
    prisma.store!.findFirst!.mockResolvedValue(null);
    expect(await adicionarItemAoCarrinho('u1', entrada)).toMatchObject({
      ok: false,
      codigo: 'LOJA_INDISPONIVEL',
    });
  });

  it('item de outra loja abre outro carrinho e não apaga o anterior', async () => {
    await adicionarItemAoCarrinho('u1', entrada);

    expect(prisma.cart!.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_storeId: { userId: 'u1', storeId: 'l1' } } }),
    );
    expect(prisma.cart!.deleteMany).not.toHaveBeenCalled();
    expect(prisma.cart!.delete).not.toHaveBeenCalled();
  });

  it('item simples igual soma na mesma linha, com teto de 99', async () => {
    prisma.cartItem!.findFirst!.mockResolvedValue({ id: 'i1', quantity: 98 });
    await adicionarItemAoCarrinho('u1', entrada);

    expect(prisma.cartItem!.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { quantity: 99 },
    });
    expect(prisma.cartItem!.create).not.toHaveBeenCalled();
  });

  it('item com observação é outro item', async () => {
    await adicionarItemAoCarrinho('u1', {
      storeId: 'l1',
      item: { productId: 'p1', notes: 'sem cebola' },
    });
    expect(prisma.cartItem!.findFirst).not.toHaveBeenCalled();
    expect(prisma.cartItem!.create).toHaveBeenCalledOnce();
  });

  it('preço enviado não tem onde aterrissar', async () => {
    await adicionarItemAoCarrinho('u1', {
      storeId: 'l1',
      item: { productId: 'p1', quantity: 1, priceCents: 1 },
    });
    const { data } = prisma.cartItem!.create!.mock.calls[0]![0];
    expect(JSON.stringify(data)).not.toContain('priceCents');
  });
});

describe('alterarQuantidadeDoItem', () => {
  it('item de outra pessoa não é encontrado: o filtro é pelo dono', async () => {
    prisma.cartItem!.findFirst!.mockResolvedValue(null);

    expect(await alterarQuantidadeDoItem('u2', { cartItemId: 'i1', quantity: 3 })).toMatchObject({
      codigo: 'NAO_ENCONTRADO',
    });
    expect(prisma.cartItem!.findFirst!.mock.calls[0]![0].where).toEqual({
      id: 'i1',
      cart: { userId: 'u2' },
    });
  });

  it('aumentar respeita o estoque somando as outras linhas', async () => {
    prisma.cartItem!.findFirst!.mockResolvedValue({
      id: 'i1',
      quantity: 1,
      cartId: 'c1',
      product: { id: 'p1', stockQuantity: 3, sellingUnit: 'UNIT' },
    });
    prisma.cartItem!.aggregate!.mockResolvedValue({ _sum: { quantity: 2 } });

    expect(await alterarQuantidadeDoItem('u1', { cartItemId: 'i1', quantity: 2 })).toMatchObject({
      codigo: 'ESTOQUE_INSUFICIENTE',
    });
  });

  it('quantidade zero remove', async () => {
    prisma.cartItem!.findFirst!.mockResolvedValue({
      id: 'i1',
      quantity: 1,
      cartId: 'c1',
      product: null,
    });

    await alterarQuantidadeDoItem('u1', { cartItemId: 'i1', quantity: 0 });
    expect(prisma.cartItem!.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
  });
});

describe('carregarCarrinho', () => {
  it('recalcula do catálogo e não aplica a comissão do plano, que está desligada', async () => {
    prisma.cart!.findUnique!.mockResolvedValue({
      id: 'c1',
      storeId: 'l1',
      couponId: null,
      addressId: null,
      notes: null,
      store: {
        name: 'Loja',
        slug: 'loja',
        minOrderCents: 0,
        pizzaPricingRule: 'HIGHEST_PRICE',
        subscription: { plan: { commissionRate: 12 } },
      },
      items: [
        {
          id: 'i1',
          quantity: 2,
          weightGrams: null,
          notes: null,
          product: {
            id: 'p1',
            name: 'Arroz',
            priceCents: 1000,
            sellingUnit: 'UNIT',
            isAvailable: true,
            pausedUntil: null,
            deletedAt: null,
            stockQuantity: null,
            prescription: 'NONE',
            ageRestricted: false,
            image: null,
          },
          pizzaSize: null,
          marmitaSize: null,
          marmita: [],
          pizzaExtras: [],
          complements: [],
          flavors: [],
        },
      ],
    });

    const carrinho = await carregarCarrinho('u1', 'l1');

    expect(carrinho?.subtotalCents).toBe(2000);
    expect(carrinho?.loja.commissionRate).toBe(0);
  });
});
