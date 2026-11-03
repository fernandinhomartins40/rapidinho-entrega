import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaFalso as prisma, zerarPrisma } from './apoio-de-teste';

const fora = vi.hoisted(() => ({ publicar: vi.fn() }));

vi.mock('@rapidinho/database', async () => (await import('./apoio-de-teste')).databaseFalso);
vi.mock('../realtime/publisher', () => ({ publishRealtimeMany: fora.publicar }));

import { atividadeQueImpedeExclusao, excluirConta } from './conta';
import {
  definirEnderecoPadrao,
  excluirEnderecoDoCliente,
  salvarEnderecoDoCliente,
} from './enderecos';
import { placarDaSessao, votarNaSessao } from './fome';
import {
  anexarComprovantePix,
  avaliarPedidoDoCliente,
  cancelarPedidoDoCliente,
  repetirPedido,
} from './pedidos';
import { termosPendentes, versaoVigenteDosTermos } from './termos';

beforeEach(() => {
  zerarPrisma();
  vi.clearAllMocks();
});

describe('cancelarPedidoDoCliente', () => {
  const pedido = (status = 'PENDING') => ({
    id: 'o1',
    number: '1',
    status: 'RECEIVED',
    storeId: 'l1',
    payment: { status },
  });

  it('pedido de outra pessoa não é encontrado', async () => {
    prisma.order!.findFirst!.mockResolvedValue(null);
    expect(await cancelarPedidoDoCliente('u2', 'o1')).toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(prisma.order!.findFirst!.mock.calls[0]![0].where).toEqual({ id: 'o1', userId: 'u2' });
  });

  it('pago não se cancela por aqui', async () => {
    prisma.order!.findFirst!.mockResolvedValue(pedido('PAID'));
    expect(await cancelarPedidoDoCliente('u1', 'o1')).toMatchObject({ codigo: 'CONFLITO' });
  });

  it('aceite no mesmo instante vale: o update é condicional', async () => {
    prisma.order!.findFirst!.mockResolvedValue(pedido());
    prisma.order!.updateMany!.mockResolvedValue({ count: 0 });

    expect(await cancelarPedidoDoCliente('u1', 'o1')).toMatchObject({ codigo: 'CONFLITO' });
    expect(prisma.orderStatusHistory!.create).not.toHaveBeenCalled();
  });

  it('cancela, registra e avisa a loja', async () => {
    prisma.order!.findFirst!.mockResolvedValue(pedido());
    prisma.order!.updateMany!.mockResolvedValue({ count: 1 });

    expect(await cancelarPedidoDoCliente('u1', 'o1')).toMatchObject({ ok: true });
    expect(prisma.orderStatusHistory!.create).toHaveBeenCalledOnce();
    expect(fora.publicar).toHaveBeenCalledOnce();
  });
});

describe('avaliarPedidoDoCliente', () => {
  it('só pedido entregue, do próprio cliente', async () => {
    prisma.order!.findFirst!.mockResolvedValue(null);
    await avaliarPedidoDoCliente('u2', { orderId: 'o1', storeRating: 5 });
    expect(prisma.order!.findFirst!.mock.calls[0]![0].where).toEqual({
      id: 'o1',
      userId: 'u2',
      status: 'DELIVERED',
    });
  });

  it('não avalia duas vezes nem sem nota', async () => {
    prisma.order!.findFirst!.mockResolvedValue({
      id: 'o1',
      storeId: 'l1',
      delivery: null,
      reviews: [{ id: 'r' }],
    });
    expect(await avaliarPedidoDoCliente('u1', { orderId: 'o1', storeRating: 5 })).toMatchObject({
      codigo: 'CONFLITO',
    });

    prisma.order!.findFirst!.mockResolvedValue({
      id: 'o1',
      storeId: 'l1',
      delivery: null,
      reviews: [],
    });
    expect(await avaliarPedidoDoCliente('u1', { orderId: 'o1' })).toMatchObject({
      codigo: 'DADOS_INVALIDOS',
    });
  });
});

describe('repetirPedido', () => {
  it('loja que saiu do ar não repete', async () => {
    prisma.order!.findFirst!.mockResolvedValue({
      storeId: 'l1',
      store: { status: 'SUSPENDED', deletedAt: null, name: 'Loja' },
      items: [],
    });
    expect(await repetirPedido('u1', 'o1')).toMatchObject({ codigo: 'LOJA_INDISPONIVEL' });
  });

  it('o que não passa é pulado, e o cliente é avisado', async () => {
    prisma.order!.findFirst!.mockResolvedValue({
      storeId: 'l1',
      store: { status: 'ACTIVE', deletedAt: null, name: 'Loja' },
      items: [
        {
          productId: 'p1',
          quantity: 1,
          weightGrams: null,
          notes: null,
          pizzaSizeId: null,
          pizzaExtraId: null,
          complements: [],
          flavors: [],
          pizzaExtras: [],
        },
        {
          productId: null,
          quantity: 1,
          weightGrams: null,
          notes: null,
          pizzaSizeId: null,
          pizzaExtraId: null,
          complements: [],
          flavors: [],
          pizzaExtras: [],
        },
      ],
    });
    prisma.complementOption!.findMany!.mockResolvedValue([]);
    prisma.cart!.upsert!.mockResolvedValue({ id: 'k1' });
    prisma.cartItem!.aggregate!.mockResolvedValue({ _sum: { quantity: 0 } });
    prisma.product!.findFirst!.mockResolvedValue({
      isAvailable: true,
      pausedUntil: null,
      sellingUnit: 'UNIT',
      stockQuantity: null,
      prescription: 'NONE',
      complementGroups: [],
    });
    prisma.cartItem!.findFirst!.mockResolvedValue(null);

    const resultado = await repetirPedido('u1', 'o1');

    expect(resultado).toMatchObject({ ok: true, storeId: 'l1' });
    expect(resultado.ok && resultado.message).toContain('1 item(ns) no carrinho. 1 não');
  });
});

describe('anexarComprovantePix', () => {
  const entrada = { orderId: 'o1', mediaId: 'm1' };

  it('só pedido aguardando Pix na chave da loja, do próprio cliente', async () => {
    prisma.order!.findFirst!.mockResolvedValue(null);
    expect(await anexarComprovantePix('u2', entrada)).toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(prisma.order!.findFirst!.mock.calls[0]![0].where).toMatchObject({
      id: 'o1',
      userId: 'u2',
      status: 'PENDING_PAYMENT',
    });
  });

  it('arquivo de terceiro não entra', async () => {
    prisma.order!.findFirst!.mockResolvedValue({ id: 'o1', number: '1', storeId: 'l1' });
    prisma.mediaAsset!.findFirst!.mockResolvedValue(null);

    expect(await anexarComprovantePix('u1', entrada)).toMatchObject({ ok: false });
    expect(prisma.mediaAsset!.findFirst!.mock.calls[0]![0].where).toEqual({
      id: 'm1',
      context: 'PIX_PROOF',
      uploadedById: 'u1',
    });
    expect(prisma.payment!.update).not.toHaveBeenCalled();
  });

  it('não muda o status do pedido: quem libera é o lojista', async () => {
    prisma.order!.findFirst!.mockResolvedValue({ id: 'o1', number: '1', storeId: 'l1' });
    prisma.mediaAsset!.findFirst!.mockResolvedValue({ id: 'm1' });

    await anexarComprovantePix('u1', entrada);

    expect(prisma.payment!.update!.mock.calls[0]![0].data).toEqual({ pixProofImageId: 'm1' });
    expect(prisma.order!.update).not.toHaveBeenCalled();
  });
});

describe('exclusão da conta', () => {
  function semAtividade() {
    prisma.order!.count!.mockResolvedValue(0);
    prisma.delivery!.count!.mockResolvedValue(0);
    prisma.errand!.count!.mockResolvedValue(0);
    prisma.storeStaff!.findMany!.mockResolvedValue([]);
  }

  beforeEach(semAtividade);

  it('cliente com pedido em andamento não sai', async () => {
    prisma.order!.count!.mockResolvedValue(1);
    expect(await excluirConta('u1')).toMatchObject({ ok: false, codigo: 'CONTA_COM_ATIVIDADE' });
    expect(prisma.user!.update).not.toHaveBeenCalled();
  });

  it('entregador com corrida não sai', async () => {
    prisma.delivery!.count!.mockResolvedValue(1);
    expect(await atividadeQueImpedeExclusao('u1')).toContain('corridas');
  });

  it('entregador com corrida avulsa não sai', async () => {
    prisma.errand!.count!.mockResolvedValue(1);
    expect(await atividadeQueImpedeExclusao('u1')).toContain('corridas');
  });

  it('dono com pedido na loja não sai', async () => {
    prisma.storeStaff!.findMany!.mockResolvedValue([{ storeId: 'l1' }]);
    prisma.order!.count!.mockResolvedValueOnce(0).mockResolvedValue(2);
    expect(await atividadeQueImpedeExclusao('u1')).toContain('loja');
  });

  it('pedido aguardando Pix conta como ativo', async () => {
    await atividadeQueImpedeExclusao('u1');
    expect(prisma.order!.count!.mock.calls[0]![0].where.status.in).toContain('PENDING_PAYMENT');
  });

  it('anonimiza, apaga aparelhos e sessões, e guarda o pedido sem identificar', async () => {
    expect(await excluirConta('u1')).toMatchObject({ ok: true });

    expect(prisma.user!.update!.mock.calls[0]![0].data).toMatchObject({
      name: 'Usuário excluído',
      email: null,
      status: 'DELETED',
    });
    expect(prisma.pushDevice!.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.session!.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.order!.updateMany!.mock.calls[0]![0].data).toMatchObject({
      customerName: 'Cliente excluído',
      customerPhone: '',
    });
  });
});

describe('endereços', () => {
  const dados = {
    street: 'Rua A',
    neighborhood: 'Centro',
    referencePoint: 'Igreja',
    cityId: 'c1',
    isDefault: true,
  };

  beforeEach(() => prisma.city!.findFirst!.mockResolvedValue({ id: 'c1' }));

  it('id de outra pessoa não salva nem mexe no padrão dela', async () => {
    prisma.address!.updateMany!
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    expect(await salvarEnderecoDoCliente('u2', dados, 'alheio')).toMatchObject({
      codigo: 'NAO_ENCONTRADO',
    });
    expect(prisma.address!.updateMany!.mock.calls[1]![0].where).toEqual({
      id: 'alheio',
      userId: 'u2',
    });
  });

  it('o primeiro endereço nasce padrão', async () => {
    prisma.address!.count!.mockResolvedValue(0);
    prisma.address!.create!.mockResolvedValue({ id: 'e1' });

    await salvarEnderecoDoCliente('u1', { ...dados, isDefault: false });

    expect(prisma.address!.create!.mock.calls[0]![0].data.isDefault).toBe(true);
  });

  it('bairro de outra cidade é recusado', async () => {
    prisma.neighborhood!.findFirst!.mockResolvedValue(null);
    expect(
      await salvarEnderecoDoCliente('u1', { ...dados, neighborhoodId: 'b1' }),
    ).toMatchObject({ codigo: 'DADOS_INVALIDOS' });
  });

  it('definir padrão e excluir filtram pelo dono', async () => {
    prisma.address!.findFirst!.mockResolvedValue(null);
    expect(await definirEnderecoPadrao('u2', 'e1')).toMatchObject({ codigo: 'NAO_ENCONTRADO' });

    prisma.address!.deleteMany!.mockResolvedValue({ count: 0 });
    expect(await excluirEnderecoDoCliente('u2', 'e1')).toMatchObject({ codigo: 'NAO_ENCONTRADO' });
    expect(prisma.address!.deleteMany).toHaveBeenCalledWith({ where: { id: 'e1', userId: 'u2' } });
  });
});

describe('termos', () => {
  it('a versão vigente tem uma fonte só, e pendente é não ter aceite dela', async () => {
    const versao = await versaoVigenteDosTermos();

    prisma.consentRecord!.findFirst!.mockResolvedValue(null);
    expect(await termosPendentes('u1')).toBe(true);
    expect(prisma.consentRecord!.findFirst!.mock.calls[0]![0].where).toMatchObject({
      userId: 'u1',
      version: versao,
      kind: 'terms',
    });

    prisma.consentRecord!.findFirst!.mockResolvedValue({ id: 'x' });
    expect(await termosPendentes('u1')).toBe(false);
  });
});

describe('Tô com fome', () => {
  it('voto só vale para prato do baralho, enquanto a sessão vive', async () => {
    const participante = { id: 'app:u1', apelido: 'Ana' };

    prisma.cravingSession!.findFirst!.mockResolvedValue(null);
    expect(
      await votarNaSessao({ sessaoId: 's', chave: 'p:x', gostou: true, participante }),
    ).toMatchObject({ codigo: 'NAO_ENCONTRADO' });

    prisma.cravingSession!.findFirst!.mockResolvedValue({ id: 's', items: ['p:a'] });
    expect(
      await votarNaSessao({ sessaoId: 's', chave: 'p:b', gostou: true, participante }),
    ).toMatchObject({ codigo: 'DADOS_INVALIDOS' });
    expect(prisma.cravingVote!.upsert).not.toHaveBeenCalled();
  });

  it('dá match quando duas pessoas ou mais curtem o mesmo prato', async () => {
    prisma.cravingSession!.findUnique!.mockResolvedValue({
      items: ['p:a', 'p:b'],
      expiresAt: new Date(Date.now() + 60_000),
      votes: [
        { participantId: 'x', nickname: 'Ana', itemKey: 'p:a', liked: true },
        { participantId: 'y', nickname: 'Bia', itemKey: 'p:a', liked: true },
        { participantId: 'y', nickname: 'Bia', itemKey: 'p:b', liked: false },
      ],
    });

    const placar = await placarDaSessao('s', 'x');

    expect(placar.match).toBe('p:a');
    expect(placar.participantes.find((pessoa) => pessoa.souEu)?.apelido).toBe('Ana');
  });
});
