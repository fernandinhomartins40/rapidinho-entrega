import { beforeEach, describe, expect, it, vi } from 'vitest';
import { erroDoPrisma, prismaFalso as prisma, zerarPrisma } from './apoio-de-teste';

const fora = vi.hoisted(() => ({
  publicar: vi.fn(),
  notificar: vi.fn(),
  redis: { sadd: vi.fn(), expire: vi.fn(), exec: vi.fn(), smembers: vi.fn() },
}));

vi.mock('@rapidinho/database', async () => (await import('./apoio-de-teste')).databaseFalso);
vi.mock('../realtime/publisher', () => ({ publishRealtimeMany: fora.publicar }));
vi.mock('../notifications', () => ({ notificarUsuario: fora.notificar }));
vi.mock('../redis', () => ({
  getRedis: () => ({
    multi: () => {
      const cadeia = {
        sadd: (...args: unknown[]) => (fora.redis.sadd(...args), cadeia),
        expire: () => cadeia,
        exec: async () => [],
      };
      return cadeia;
    },
    smembers: fora.redis.smembers,
  }),
}));

import {
  aceitarCorridaDoPedido,
  avancarCorridaAvulsaDoEntregador,
  avancarCorridaDoPedido,
  enviarDocumentoDoEntregador,
  recusarCorrida,
  registrarPosicaoDoEntregador,
} from './entregador';

const posicao = { latitude: -24.1, longitude: -51.3 };

beforeEach(() => {
  zerarPrisma();
  vi.clearAllMocks();
  prisma.courier!.findUniqueOrThrow!.mockResolvedValue({ cityId: 'c1', storeId: null });
  prisma.delivery!.count!.mockResolvedValue(0);
  prisma.errand!.count!.mockResolvedValue(0);
});

describe('aceitarCorridaDoPedido', () => {
  it('só enxerga corrida da cidade do entregador', async () => {
    prisma.delivery!.findFirst!.mockResolvedValue(null);

    expect(await aceitarCorridaDoPedido('e1', 'd1')).toMatchObject({ codigo: 'CONFLITO' });
    expect(prisma.delivery!.findFirst!.mock.calls[0]![0].where.order).toEqual({ cityId: 'c1' });
  });

  it('entregador de loja fica na própria loja', async () => {
    prisma.courier!.findUniqueOrThrow!.mockResolvedValue({ cityId: 'c1', storeId: 'l1' });
    prisma.delivery!.findFirst!.mockResolvedValue(null);

    await aceitarCorridaDoPedido('e1', 'd1');

    expect(prisma.delivery!.findFirst!.mock.calls[0]![0].where.order).toEqual({
      cityId: 'c1',
      storeId: 'l1',
    });
  });

  it('dois tocando juntos: o segundo perde, sem sobrescrever', async () => {
    prisma.delivery!.findFirst!.mockResolvedValue({
      id: 'd1',
      orderId: 'o1',
      order: { storeId: 'l1', number: '1' },
    });
    prisma.delivery!.updateMany!.mockResolvedValue({ count: 0 });

    expect(await aceitarCorridaDoPedido('e2', 'd1')).toMatchObject({ codigo: 'CONFLITO' });
    expect(prisma.delivery!.updateMany!.mock.calls[0]![0].where).toMatchObject({
      courierId: null,
      status: 'PENDING',
    });
    expect(fora.publicar).not.toHaveBeenCalled();
  });
});

describe('avancarCorridaDoPedido', () => {
  const entrega = (status: string) => ({
    id: 'd1',
    status,
    orderId: 'o1',
    order: { storeId: 'l1', number: '1', status: 'READY', userId: 'u1' },
  });

  it('corrida de outro entregador não é encontrada', async () => {
    prisma.delivery!.findFirst!.mockResolvedValue(null);

    expect(
      await avancarCorridaDoPedido('e2', { deliveryId: 'd1', status: 'PICKED_UP' }),
    ).toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(prisma.delivery!.findFirst!.mock.calls[0]![0].where).toEqual({
      id: 'd1',
      courierId: 'e2',
    });
  });

  it('não pula etapa', async () => {
    prisma.delivery!.findFirst!.mockResolvedValue(entrega('ACCEPTED'));
    expect(
      await avancarCorridaDoPedido('e1', { deliveryId: 'd1', status: 'DELIVERED' }),
    ).toMatchObject({ codigo: 'CONFLITO' });
  });

  it('retirar leva o pedido junto e avisa o cliente', async () => {
    prisma.delivery!.findFirst!.mockResolvedValue(entrega('ACCEPTED'));

    expect(
      await avancarCorridaDoPedido('e1', { deliveryId: 'd1', status: 'PICKED_UP' }),
    ).toMatchObject({ ok: true });

    expect(prisma.order!.update!.mock.calls[0]![0].data.status).toBe('OUT_FOR_DELIVERY');
    expect(fora.notificar).toHaveBeenCalledOnce();
  });

  it('entregar sem outra corrida apaga a posição', async () => {
    prisma.delivery!.findFirst!.mockResolvedValue(entrega('PICKED_UP'));

    await avancarCorridaDoPedido('e1', { deliveryId: 'd1', status: 'DELIVERED' });

    expect(prisma.courier!.update).toHaveBeenCalledWith({
      where: { id: 'e1' },
      data: { latitude: null, longitude: null },
    });
  });

  it('pedido cancelado no meio devolve aviso, não erro interno', async () => {
    prisma.delivery!.findFirst!.mockResolvedValue(entrega('PICKED_UP'));
    prisma.delivery!.update!.mockRejectedValue(erroDoPrisma('P2025'));

    expect(
      await avancarCorridaDoPedido('e1', { deliveryId: 'd1', status: 'DELIVERED' }),
    ).toMatchObject({ codigo: 'CONFLITO' });
  });
});

describe('registrarPosicaoDoEntregador', () => {
  it('sem corrida ativa não grava nem publica, e apaga o que restou', async () => {
    prisma.delivery!.findMany!.mockResolvedValue([]);

    expect(await registrarPosicaoDoEntregador('e1', posicao)).toEqual({
      ok: true,
      gravada: false,
    });
    expect(prisma.courier!.update!.mock.calls[0]![0].data).toMatchObject({
      latitude: null,
      longitude: null,
    });
    expect(fora.publicar).not.toHaveBeenCalled();
  });

  it('com corrida, grava e publica só na sala dos pedidos dele', async () => {
    prisma.delivery!.findMany!.mockResolvedValue([{ orderId: 'o1' }, { orderId: 'o2' }]);

    expect(await registrarPosicaoDoEntregador('e1', posicao)).toEqual({ ok: true, gravada: true });

    const [canais, evento, carga] = fora.publicar.mock.calls[0]!;
    expect(canais).toEqual(['courier:e1', 'order:o1', 'order:o2']);
    expect(evento).toBe('courier:location');
    expect(carga).toMatchObject(posicao);
    expect(prisma.delivery!.findMany!.mock.calls[0]![0].where).toMatchObject({ courierId: 'e1' });
  });

  it('corrida avulsa grava, sem sala de pedido', async () => {
    prisma.delivery!.findMany!.mockResolvedValue([]);
    prisma.errand!.count!.mockResolvedValue(1);

    await registrarPosicaoDoEntregador('e1', posicao);

    expect(fora.publicar.mock.calls[0]![0]).toEqual(['courier:e1']);
  });
});

describe('recusarCorrida', () => {
  it('aceita e não retirada volta para a fila', async () => {
    prisma.delivery!.updateMany!.mockResolvedValue({ count: 1 });
    prisma.delivery!.findUniqueOrThrow!.mockResolvedValue({
      orderId: 'o1',
      order: { storeId: 'l1' },
    });

    expect(await recusarCorrida('e1', { id: 'd1', tipo: 'pedido', motivo: 'pneu' })).toMatchObject({
      ok: true,
    });

    const { where, data } = prisma.delivery!.updateMany!.mock.calls[0]![0];
    expect(where).toMatchObject({ id: 'd1', courierId: 'e1' });
    expect(where.status.in).not.toContain('PICKED_UP');
    expect(data).toMatchObject({ courierId: null, status: 'PENDING', refuseReason: 'pneu' });
  });

  it('da fila, some só para quem recusou', async () => {
    prisma.delivery!.updateMany!.mockResolvedValue({ count: 0 });
    prisma.delivery!.findFirst!.mockResolvedValue({ id: 'd1' });

    await recusarCorrida('e1', { id: 'd1', tipo: 'pedido' });

    expect(fora.redis.sadd).toHaveBeenCalledWith('entregador:recusas:e1', 'pedido:d1');
    expect(prisma.delivery!.updateMany!.mock.calls).toHaveLength(1);
  });

  it('corrida de outro entregador não é devolvida', async () => {
    prisma.delivery!.updateMany!.mockResolvedValue({ count: 0 });
    prisma.delivery!.findFirst!.mockResolvedValue(null);

    expect(await recusarCorrida('e2', { id: 'd1', tipo: 'pedido' })).toMatchObject({
      codigo: 'NAO_ENCONTRADO',
    });
  });
});

describe('corrida avulsa', () => {
  it('só o dono, e só na ordem', async () => {
    prisma.errand!.updateMany!.mockResolvedValue({ count: 0 });

    expect(
      await avancarCorridaAvulsaDoEntregador('e2', { corridaId: 'x', status: 'DELIVERED' }),
    ).toMatchObject({ codigo: 'CONFLITO' });
    expect(prisma.errand!.updateMany!.mock.calls[0]![0].where).toEqual({
      id: 'x',
      courierId: 'e2',
      status: 'PICKED_UP',
    });
  });
});

describe('enviarDocumentoDoEntregador', () => {
  const entregador = { courierId: 'e1', userId: 'u1' };

  it('imagem de terceiro não entra', async () => {
    prisma.mediaAsset!.findFirst!.mockResolvedValue(null);

    expect(
      await enviarDocumentoDoEntregador(entregador, { tipo: 'CNH', imagemId: 'm1' }),
    ).toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(prisma.mediaAsset!.findFirst!.mock.calls[0]![0].where).toEqual({
      id: 'm1',
      context: 'COURIER_DOCUMENT',
      uploadedById: 'u1',
    });
  });

  it('imagem sem dizer qual documento é recusada', async () => {
    expect(await enviarDocumentoDoEntregador(entregador, { imagemId: 'm1' })).toMatchObject({
      codigo: 'DADOS_INVALIDOS',
    });
  });

  it('reenviar substitui, e os dados do veículo vão junto', async () => {
    prisma.mediaAsset!.findFirst!.mockResolvedValue({ id: 'm1' });

    await enviarDocumentoDoEntregador(entregador, {
      tipo: 'CNH',
      imagemId: 'm1',
      veiculo: 'CAR',
      placa: 'ABC1D23',
    });

    expect(prisma.courierDocument!.deleteMany).toHaveBeenCalledWith({
      where: { courierId: 'e1', label: 'CNH' },
    });
    expect(prisma.courier!.update!.mock.calls[0]![0].data).toEqual({
      vehicleType: 'CAR',
      vehiclePlate: 'ABC1D23',
    });
  });
});
