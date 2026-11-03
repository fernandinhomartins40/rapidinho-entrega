import { beforeEach, describe, expect, it, vi } from 'vitest';
import { erroDoPrisma, prismaFalso as prisma, zerarPrisma } from './apoio-de-teste';

const fora = vi.hoisted(() => ({
  gateway: vi.fn(),
  publicar: vi.fn(),
  expirar: vi.fn(),
  lembrete: vi.fn(),
}));

vi.mock('@rapidinho/database', async () => (await import('./apoio-de-teste')).databaseFalso);
vi.mock('../providers', () => ({ getPaymentGateway: fora.gateway }));
vi.mock('../realtime/publisher', () => ({ publishRealtime: fora.publicar }));
vi.mock('../queues', () => ({
  agendarExpiracaoDePedido: fora.expirar,
  agendarLembreteDaLoja: fora.lembrete,
}));
vi.mock('../observability', () => ({ capturarErro: vi.fn() }));

import { calcularCheckout, criarPedido, formasDePagamentoAceitas } from './checkout';

const usuario = { id: 'u1', name: 'Ana', phone: '+5544999998888' };

const dados = {
  storeId: 'l1',
  type: 'DELIVERY' as const,
  addressId: 'e1',
  paymentMethod: 'PIX' as const,
};

const entrada = (extra = {}) => ({
  usuario,
  dados,
  confirmaMaioridade: false,
  pixPeloGateway: false,
  ...extra,
});

/** Loja aberta o dia todo, em todos os dias. */
const horarios = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  opensAt: 0,
  closesAt: 1440,
  isActive: true,
}));

const loja = (extra = {}) => ({
  id: 'l1',
  cityId: 'c1',
  slug: 'loja',
  name: 'Loja',
  acceptsPix: true,
  acceptsCardOnline: false,
  acceptsCashOnDelivery: true,
  acceptsCardOnDelivery: true,
  acceptsPickup: true,
  autoAcceptOrders: false,
  pixKey: 'chave@loja.com',
  settlementMode: 'STORE_COLLECTS',
  city: { name: 'Palmital' },
  avgPrepTimeMinutes: 30,
  isPausedUntil: null,
  pauseReason: null,
  hours: horarios,
  closures: [],
  subscription: null,
  segment: 'RESTAURANT',
  deliveryFeeMode: 'FIXED',
  deliveryFeeCents: 500,
  pricePerKmCents: 0,
  freeDeliveryAboveCents: null,
  deliveryRadiusMeters: 8000,
  minOrderCents: 0,
  latitude: null,
  longitude: null,
  deliveryZones: [],
  ...extra,
});

const carrinhoDoBanco = (extra = {}) => ({
  id: 'k1',
  storeId: 'l1',
  couponId: null,
  addressId: null,
  notes: null,
  store: {
    name: 'Loja',
    slug: 'loja',
    minOrderCents: 0,
    pizzaPricingRule: 'HIGHEST_PRICE',
    subscription: null,
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
      pizzaExtras: [],
      complements: [],
      flavors: [],
    },
  ],
  ...extra,
});

function prepararPedidoValido() {
  prisma.order!.findUnique!.mockResolvedValue(null);
  prisma.cart!.findUnique!.mockResolvedValue(carrinhoDoBanco());
  prisma.store!.findFirst!.mockResolvedValue(loja());
  prisma.store!.findUniqueOrThrow!.mockResolvedValue(loja());
  prisma.address!.findFirst!.mockResolvedValue({
    id: 'e1',
    cityId: 'c1',
    neighborhoodId: null,
    latitude: null,
    longitude: null,
    street: 'Rua A',
    number: '1',
    complement: null,
    neighborhood: 'Centro',
    referencePoint: 'Igreja',
    zipCode: null,
  });
  prisma.product!.findMany!.mockResolvedValue([]);
  prisma.order!.create!.mockResolvedValue({
    id: 'o1',
    number: '02110001',
    status: 'PENDING_PAYMENT',
  });
}

beforeEach(() => {
  zerarPrisma();
  vi.clearAllMocks();
});

describe('formasDePagamentoAceitas', () => {
  const base = {
    acceptsPix: true,
    settlementMode: 'STORE_COLLECTS',
    pixKey: null as string | null,
    acceptsCardOnline: true,
    acceptsCashOnDelivery: true,
    acceptsCardOnDelivery: false,
  };

  it('no app, Pix só com a chave da própria loja', () => {
    expect(formasDePagamentoAceitas(base, { pixPeloGateway: false }).PIX).toBe(false);
    expect(formasDePagamentoAceitas({ ...base, pixKey: 'x' }, { pixPeloGateway: false }).PIX).toBe(
      true,
    );
  });

  it('cartão online fica fora mesmo com o campo ligado na loja', () => {
    expect(formasDePagamentoAceitas(base, { pixPeloGateway: true }).CREDIT_CARD_ONLINE).toBe(false);
  });
});

describe('calcularCheckout', () => {
  const carrinho = {
    id: 'k1',
    storeId: 'l1',
    subtotalCents: 2000,
    itens: [{ nome: 'Arroz', unitTotalCents: 1000, quantidade: 2, totalCents: 2000 }],
    temIndisponivel: false,
    loja: { commissionRate: 0 },
  } as never;

  const calcular = (extra = {}) =>
    calcularCheckout({
      carrinho,
      userId: 'u1',
      cityId: 'c1',
      tipo: 'DELIVERY',
      addressId: 'e1',
      couponCode: null,
      ...extra,
    });

  beforeEach(() => {
    prisma.store!.findUniqueOrThrow!.mockResolvedValue(loja());
    prisma.address!.findFirst!.mockResolvedValue({
      cityId: 'c1',
      neighborhoodId: null,
      latitude: null,
      longitude: null,
    });
  });

  it('soma a taxa da loja, recalculada no servidor', async () => {
    expect(await calcular()).toMatchObject({
      subtotalCents: 2000,
      deliveryFeeCents: 500,
      totalCents: 2500,
      commissionCents: 0,
      bloqueio: null,
    });
  });

  it('endereço de outra pessoa ou de outra cidade bloqueia', async () => {
    prisma.address!.findFirst!.mockResolvedValue(null);
    expect((await calcular()).bloqueio).toBe('Escolha um endereço de entrega.');

    prisma.address!.findFirst!.mockResolvedValue({ cityId: 'outra' });
    expect((await calcular()).bloqueio).toContain('outra cidade');
    expect(prisma.address!.findFirst!.mock.calls[0]![0].where).toMatchObject({ userId: 'u1' });
  });

  it('loja fechada aparece no resumo', async () => {
    prisma.store!.findUniqueOrThrow!.mockResolvedValue(loja({ hours: [] }));
    expect((await calcular()).bloqueio).toContain('Loja fechada agora');
  });

  it('pedido mínimo diz quanto falta', async () => {
    prisma.store!.findUniqueOrThrow!.mockResolvedValue(loja({ minOrderCents: 3000 }));
    expect((await calcular()).bloqueio).toContain('Faltam 10,00 reais');
  });

  // R3-015: a taxa não pode sair duas vezes (zerada e descontada).
  it('cupom de frete grátis desconta a taxa uma vez só', async () => {
    prisma.coupon!.findFirst!.mockResolvedValue({
      id: 'cp',
      code: 'FRETE',
      scope: 'STORE',
      storeId: 'l1',
      cityId: null,
      discountType: 'FREE_DELIVERY',
      discountValue: 0,
      maxDiscountCents: null,
      minOrderCents: 0,
      usageLimit: null,
      usagePerUser: 1,
      usageCount: 0,
      firstOrderOnly: false,
      startsAt: new Date(0),
      endsAt: null,
      isActive: true,
    });
    prisma.couponRedemption!.count!.mockResolvedValue(0);
    prisma.order!.count!.mockResolvedValue(0);

    expect(await calcular({ couponCode: ' frete ' })).toMatchObject({
      subtotalCents: 2000,
      deliveryFeeCents: 500,
      discountCents: 500,
      totalCents: 2000,
      freteGratisPorCupom: true,
      deliveryFeeReason: 'Entrega grátis pelo cupom',
      couponId: 'cp',
    });
  });

  it('cupom que não existe não dá desconto', async () => {
    prisma.coupon!.findFirst!.mockResolvedValue(null);
    expect(await calcular({ couponCode: 'NADA' })).toMatchObject({
      discountCents: 0,
      couponMessage: 'Cupom não encontrado ou não vale nesta loja.',
    });
  });
});

describe('criarPedido', () => {
  beforeEach(prepararPedidoValido);

  it('carrinho vazio não vira pedido', async () => {
    prisma.cart!.findUnique!.mockResolvedValue(null);
    expect(await criarPedido(entrada())).toMatchObject({ ok: false, codigo: 'CARRINHO_VAZIO' });
  });

  it('forma de pagamento que a loja não aceita é recusada', async () => {
    prisma.store!.findFirst!.mockResolvedValue(loja({ pixKey: null }));
    expect(await criarPedido(entrada())).toMatchObject({ codigo: 'PAGAMENTO_NAO_ACEITO' });
  });

  it('item +18 exige a declaração', async () => {
    const com18 = carrinhoDoBanco();
    com18.items[0]!.product.ageRestricted = true;
    prisma.cart!.findUnique!.mockResolvedValue(com18);

    expect(await criarPedido(entrada())).toMatchObject({ codigo: 'MAIORIDADE_OBRIGATORIA' });
  });

  it('receita só vale se o arquivo for da própria pessoa', async () => {
    const comReceita = carrinhoDoBanco();
    comReceita.items[0]!.product.prescription = 'REQUIRED';
    prisma.cart!.findUnique!.mockResolvedValue(comReceita);
    prisma.mediaAsset!.findFirst!.mockResolvedValue(null);

    expect(await criarPedido(entrada({ prescriptionImageId: 'alheia' }))).toMatchObject({
      codigo: 'RECEITA_OBRIGATORIA',
    });
    expect(prisma.mediaAsset!.findFirst!.mock.calls[0]![0].where).toMatchObject({
      id: 'alheia',
      uploadedById: 'u1',
    });
  });

  it('troco menor que o total é recusado', async () => {
    const dinheiro = { ...dados, paymentMethod: 'CASH_ON_DELIVERY' as const, changeForCents: 100 };
    expect(await criarPedido(entrada({ dados: dinheiro }))).toMatchObject({
      codigo: 'TROCO_INVALIDO',
    });
  });

  it('grava os valores do servidor, sem comissão, e o Pix fica na chave da loja', async () => {
    const resultado = await criarPedido(entrada({ chaveDeIdempotencia: 'chave-123' }));

    expect(resultado).toMatchObject({ ok: true, repetido: false });
    expect(prisma.order!.create!.mock.calls[0]![0].data).toMatchObject({
      idempotencyKey: 'chave-123',
      status: 'PENDING_PAYMENT',
      subtotalCents: 2000,
      deliveryFeeCents: 500,
      totalCents: 2500,
      commissionCents: 0,
      commissionRate: 0,
    });
    expect(fora.gateway).not.toHaveBeenCalled();
    expect(prisma.payment!.update!.mock.calls[0]![0].data.provider).toBe('OFFLINE');
    // Pix confirmado à mão pelo lojista: nunca expira sozinho.
    expect(fora.expirar).not.toHaveBeenCalled();
    expect(fora.publicar).toHaveBeenCalledOnce();
  });

  it('dinheiro entra direto para a loja', async () => {
    const dinheiro = { ...dados, paymentMethod: 'CASH_ON_DELIVERY' as const };
    prisma.order!.create!.mockResolvedValue({ id: 'o1', number: '1', status: 'RECEIVED' });

    await criarPedido(entrada({ dados: dinheiro }));

    expect(prisma.order!.create!.mock.calls[0]![0].data.status).toBe('RECEIVED');
    expect(fora.lembrete).toHaveBeenCalledOnce();
  });

  it('estoque que acabou no meio desfaz com aviso claro', async () => {
    prisma.product!.findMany!.mockResolvedValue([{ id: 'p1', name: 'Arroz' }]);
    prisma.product!.updateMany!.mockResolvedValue({ count: 0 });

    expect(await criarPedido(entrada())).toMatchObject({ codigo: 'ESTOQUE_INSUFICIENTE' });
    expect(prisma.order!.create).not.toHaveBeenCalled();
  });

  describe('idempotência', () => {
    const chave = 'chave-123';
    const existente = { id: 'o9', number: '9', status: 'RECEIVED', storeId: 'l1' };

    it('a mesma chave devolve o pedido já criado e não cria outro', async () => {
      prisma.order!.findUnique!.mockResolvedValue(existente);

      expect(await criarPedido(entrada({ chaveDeIdempotencia: chave }))).toMatchObject({
        ok: true,
        repetido: true,
        pedido: { id: 'o9' },
      });
      expect(prisma.order!.create).not.toHaveBeenCalled();
    });

    it('a chave é por usuário', async () => {
      await criarPedido(entrada({ chaveDeIdempotencia: chave }));
      expect(prisma.order!.findUnique!.mock.calls[0]![0].where).toEqual({
        userId_idempotencyKey: { userId: 'u1', idempotencyKey: chave },
      });
    });

    it('chave usada em outra loja é erro, não pedido errado', async () => {
      prisma.order!.findUnique!.mockResolvedValue({ ...existente, storeId: 'outra' });
      expect(await criarPedido(entrada({ chaveDeIdempotencia: chave }))).toMatchObject({
        codigo: 'CHAVE_REUTILIZADA',
      });
    });

    it('envio gêmeo que perde a corrida responde com o pedido do vencedor', async () => {
      prisma.order!.findUnique!.mockResolvedValueOnce(null).mockResolvedValue(existente);
      prisma.order!.create!.mockRejectedValue(erroDoPrisma('P2002', ['userId', 'idempotencyKey']));

      expect(await criarPedido(entrada({ chaveDeIdempotencia: chave }))).toMatchObject({
        ok: true,
        repetido: true,
        pedido: { id: 'o9' },
      });
    });
  });
});
