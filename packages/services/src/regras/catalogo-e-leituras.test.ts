import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaFalso as prisma, zerarPrisma } from './apoio-de-teste';

vi.mock('@rapidinho/database', async () => (await import('./apoio-de-teste')).databaseFalso);
vi.mock('../realtime/publisher', () => ({ publishRealtimeMany: vi.fn() }));
vi.mock('../notifications', () => ({ notificarUsuario: vi.fn() }));
vi.mock('../redis', () => ({ getRedis: vi.fn() }));
vi.mock('../providers', () => ({ getPaymentGateway: vi.fn() }));
vi.mock('../queues', () => ({}));
vi.mock('../observability', () => ({ capturarErro: vi.fn() }));

import {
  compararLojasDaVitrine,
  contarNoBanner,
  filtroDeBannerAtivo,
  paraLike,
  produtoDoApp,
  vitrineDoApp,
} from './catalogo';
import { detalharPedidoDoApp, usuarioDoApp } from './leituras';

beforeEach(() => {
  zerarPrisma();
  vi.stubEnv('NEXT_PUBLIC_WEB_URL', 'http://localhost');
  vi.stubEnv('NEXT_PUBLIC_ADMIN_URL', 'http://localhost');
  vi.stubEnv('NEXT_PUBLIC_SOCKET_URL', 'http://localhost');
});

const imagem = {
  thumbKey: 'public/x-thumb.webp',
  mediumKey: 'public/x-medium.webp',
  largeKey: 'public/x-large.webp',
  blurDataUrl: null,
};

describe('ordem da vitrine', () => {
  const loja = (extra = {}) => ({
    aberta: true,
    patrocinada: false,
    precoDeBalcao: false,
    nota: 4,
    ...extra,
  });

  it('abertas, patrocinadas, preço de balcão e nota, nesta ordem', () => {
    const lojas = [
      loja({ aberta: false, patrocinada: true, nota: 5 }),
      loja({ nota: 5 }),
      loja({ precoDeBalcao: true, nota: 1 }),
      loja({ patrocinada: true, nota: 1 }),
    ];

    expect([...lojas].sort(compararLojasDaVitrine)).toEqual([
      lojas[3],
      lojas[2],
      lojas[1],
      lojas[0],
    ]);
  });
});

describe('banners', () => {
  it('sem data vale sempre, e banner sem cidade é da plataforma', () => {
    const agora = new Date();
    expect(filtroDeBannerAtivo('c1', agora)).toEqual({
      isActive: true,
      OR: [{ cityId: 'c1' }, { cityId: null }],
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: agora } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: agora } }] },
      ],
    });
  });

  it('banner fora do ar não conta', async () => {
    prisma.banner!.updateMany!.mockResolvedValue({ count: 0 });

    expect(await contarNoBanner('b1', 'clicks')).toBe(false);
    expect(prisma.banner!.updateMany).toHaveBeenCalledWith({
      where: { id: 'b1', isActive: true },
      data: { clicks: { increment: 1 } },
    });
  });
});

describe('vitrineDoApp', () => {
  const lojaDoBanco = {
    id: 'l1',
    name: 'Mercado',
    slug: 'mercado',
    description: null,
    ratingAverage: 4.5,
    ratingCount: 10,
    deliveryFeeMode: 'FIXED',
    deliveryFeeCents: 500,
    minOrderCents: 1000,
    avgPrepTimeMinutes: 20,
    avgDeliveryTimeMinutes: 10,
    isPausedUntil: null,
    pauseReason: null,
    sellsAtCounterPrice: false,
    segment: 'MARKET',
    city: { slug: 'cidade' },
    category: { name: 'Mercados', slug: 'mercados' },
    logo: imagem,
    cover: null,
    hours: [],
    closures: [],
  };

  beforeEach(() => {
    prisma.city!.findFirst!.mockResolvedValue({
      id: 'c1',
      slug: 'cidade',
      name: 'Cidade',
      state: 'PR',
    });
    prisma.store!.findMany!.mockResolvedValue([lojaDoBanco]);
    prisma.storeBoost!.findMany!.mockResolvedValue([]);
    prisma.banner!.findMany!.mockResolvedValue([]);
    prisma.coupon!.findMany!.mockResolvedValue([]);
  });

  it('cidade inativa não tem vitrine', async () => {
    prisma.city!.findFirst!.mockResolvedValue(null);
    expect(await vitrineDoApp('x')).toBeNull();
  });

  it('entrega a forma do contrato, em centavos', async () => {
    const vitrine = await vitrineDoApp('cidade');

    expect(vitrine?.cidade).toEqual({ id: 'c1', slug: 'cidade', nome: 'Cidade', uf: 'PR' });
    expect(vitrine?.categorias).toEqual([
      { slug: 'mercados', nome: 'Mercados', segmento: 'MARKET', quantidadeDeLojas: 1 },
    ]);
    expect(vitrine?.lojas[0]).toMatchObject({
      slug: 'mercado',
      categoria: 'Mercados',
      categoriaSlug: 'mercados',
      segmento: 'MARKET',
      nota: 4.5,
      taxaCents: 500,
      pedidoMinimoCents: 1000,
      tempoMin: 30,
      tempoMax: 40,
      aberta: false,
      rotuloHorario: 'Loja fechada agora',
      patrocinada: false,
    });
  });

  it('banner mostra loja no ar e cupom ainda válido', async () => {
    prisma.banner!.findMany!.mockResolvedValue([
      {
        id: 'b1',
        title: 'Promo',
        linkUrl: 'https://rapidinho.com/x?cupom=festa10',
        storeId: 'l1',
        image: imagem,
        store: { slug: 'mercado', status: 'ACTIVE', deletedAt: null },
      },
    ]);
    prisma.coupon!.findMany!.mockResolvedValue([
      { code: 'FESTA10', usageLimit: null, usageCount: 0, scope: 'STORE', storeId: 'l1' },
    ]);

    const [banner] = (await vitrineDoApp('cidade'))!.banners;

    expect(banner).toMatchObject({ id: 'b1', lojaSlug: 'mercado', cupom: 'FESTA10' });
    expect(banner?.imagemUrl).toContain('x-large');
  });

  it('cupom esgotado e loja suspensa somem do banner', async () => {
    prisma.banner!.findMany!.mockResolvedValue([
      {
        id: 'b1',
        title: 'Promo',
        linkUrl: 'https://rapidinho.com/x?cupom=FESTA10',
        storeId: 'l1',
        image: imagem,
        store: { slug: 'mercado', status: 'SUSPENDED', deletedAt: null },
      },
    ]);
    prisma.coupon!.findMany!.mockResolvedValue([
      { code: 'FESTA10', usageLimit: 5, usageCount: 5, scope: 'STORE', storeId: 'l1' },
    ]);

    expect((await vitrineDoApp('cidade'))!.banners[0]).toMatchObject({
      lojaSlug: null,
      cupom: null,
    });
  });

  it('banner cuja imagem ainda não foi processada fica de fora', async () => {
    prisma.banner!.findMany!.mockResolvedValue([
      { id: 'b1', title: 'x', linkUrl: null, storeId: null, image: null, store: null },
    ]);
    expect((await vitrineDoApp('cidade'))!.banners).toEqual([]);
  });
});

describe('paraLike', () => {
  it('neutraliza os curingas do usuário', () => {
    expect(paraLike('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});

describe('produtoDoApp', () => {
  it('produto de outra cidade não aparece: o filtro é pela cidade da rota', async () => {
    prisma.product!.findFirst!.mockResolvedValue(null);

    expect(await produtoDoApp('cidade', 'p1')).toBeNull();
    expect(prisma.product!.findFirst!.mock.calls[0]![0].where.store).toMatchObject({
      city: { slug: 'cidade', isActive: true },
      status: 'ACTIVE',
    });
  });
});

describe('usuarioDoApp', () => {
  it('traz termosPendentes', async () => {
    prisma.user!.findUnique!.mockResolvedValue({
      id: 'u1',
      name: 'Ana',
      phone: '+55',
      email: null,
      role: 'CUSTOMER',
      courier: null,
    });
    prisma.consentRecord!.findFirst!.mockResolvedValue(null);

    expect(await usuarioDoApp('u1')).toMatchObject({ papel: 'CUSTOMER', termosPendentes: true });
  });
});

describe('detalharPedidoDoApp', () => {
  const pedido = (status: string, entregaStatus: string, extra = {}) => ({
    id: 'o1',
    number: '1',
    status,
    type: 'DELIVERY',
    createdAt: new Date(),
    estimatedReadyAt: null,
    subtotalCents: 2000,
    deliveryFeeCents: 500,
    discountCents: 0,
    totalCents: 2500,
    estimatedTotalCents: null,
    notes: null,
    cancelReason: null,
    addressSnapshot: { street: 'Rua A', neighborhood: 'Centro' },
    store: {
      id: 'l1',
      name: 'Loja',
      slug: 'loja',
      phone: '44',
      whatsapp: null,
      pixKey: 'chave@loja.com',
      city: { slug: 'cidade' },
    },
    payment: null,
    items: [],
    statusHistory: [],
    delivery: {
      status: entregaStatus,
      courier: {
        vehicleType: 'MOTORCYCLE',
        latitude: -24,
        longitude: -51,
        lastSeenAt: new Date(),
        user: { name: 'Beto', phone: '44' },
      },
    },
    reviews: [],
    ...extra,
  });

  it('filtra pelo dono: pedido alheio dá null', async () => {
    prisma.order!.findFirst!.mockResolvedValue(null);

    expect(await detalharPedidoDoApp('u2', 'o1')).toBeNull();
    expect(prisma.order!.findFirst!.mock.calls[0]![0].where).toEqual({ id: 'o1', userId: 'u2' });
  });

  it('mostra a posição com a corrida andando', async () => {
    prisma.order!.findFirst!.mockResolvedValue(pedido('OUT_FOR_DELIVERY', 'PICKED_UP'));

    const detalhe = await detalharPedidoDoApp('u1', 'o1');

    expect(detalhe?.entregador?.posicao).toMatchObject({ latitude: -24, longitude: -51 });
  });

  it.each([
    ['DELIVERED', 'DELIVERED'],
    ['CANCELLED', 'CANCELLED'],
    ['CANCELLED', 'PICKED_UP'],
    ['READY', 'PENDING'],
  ])('com pedido %s e corrida %s, a posição não aparece', async (status, corrida) => {
    prisma.order!.findFirst!.mockResolvedValue(pedido(status, corrida));

    expect((await detalharPedidoDoApp('u1', 'o1'))?.entregador?.posicao).toBeNull();
  });

  it('Pix traz a chave da loja e libera o comprovante', async () => {
    prisma.order!.findFirst!.mockResolvedValue(
      pedido('PENDING_PAYMENT', 'PENDING', {
        delivery: null,
        payment: {
          method: 'PIX',
          status: 'PENDING',
          changeForCents: null,
          refundedCents: 0,
          pixQrCode: 'br-code',
          pixExpiresAt: null,
          provider: 'OFFLINE',
          pixProofImageId: null,
        },
      }),
    );

    const detalhe = await detalharPedidoDoApp('u1', 'o1');

    expect(detalhe?.pagamento?.pix).toMatchObject({
      chave: 'chave@loja.com',
      copiaECola: 'br-code',
      comprovanteEnviado: false,
    });
    expect(detalhe).toMatchObject({ podeEnviarComprovante: true, podeCancelar: true });
  });
});
