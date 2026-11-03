import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
}));
const user = vi.hoisted(() => ({ update: vi.fn() }));
const courier = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@rapidinho/database', () => ({ prisma: { session, user, courier } }));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { AuthorizationError } from './erros';
import { criarSessaoSemCookie, SESSION_MAX_AGE_SECONDS } from './session';
import {
  encerrarSessaoDoToken,
  exigirCadastroDeEntregadorDoToken,
  exigirEntregadorDoToken,
  exigirUsuarioDoToken,
  lerBearer,
  sessaoDoToken,
  usuarioDoToken,
} from './token';

const pedido = (authorization?: string) =>
  new Request('http://localhost/api/app/v1/eu', {
    headers: authorization ? { authorization } : {},
  });

const ativo = { id: 'u1', role: 'CUSTOMER', name: 'Ana', phone: '+5544999998888', email: null };

function sessaoNoBanco(expiraEmMs: number, status = 'ACTIVE') {
  session.findUnique.mockResolvedValue({
    id: 's1',
    expires: new Date(Date.now() + expiraEmMs),
    user: { ...ativo, status },
  });
}

const DIA = 86_400_000;

beforeEach(() => vi.clearAllMocks());

describe('lerBearer', () => {
  it('aceita Bearer, sem diferenciar maiúscula no esquema', () => {
    expect(lerBearer(pedido('Bearer abc').headers)).toBe('abc');
    expect(lerBearer(pedido('bearer abc').headers)).toBe('abc');
  });

  it('recusa outro esquema, token vazio e texto a mais', () => {
    expect(lerBearer(pedido('Basic abc').headers)).toBeNull();
    expect(lerBearer(pedido('Bearer').headers)).toBeNull();
    expect(lerBearer(pedido('Bearer a b').headers)).toBeNull();
    expect(lerBearer(pedido().headers)).toBeNull();
  });
});

describe('sessaoDoToken', () => {
  it('sem cabeçalho nem vai ao banco', async () => {
    expect(await sessaoDoToken(pedido())).toBeNull();
    expect(session.findUnique).not.toHaveBeenCalled();
  });

  it('token desconhecido não entra', async () => {
    session.findUnique.mockResolvedValue(null);
    expect(await usuarioDoToken(pedido('Bearer x'))).toBeNull();
  });

  it('devolve o CurrentUser, sem o status e sem impersonation', async () => {
    sessaoNoBanco(30 * DIA);
    const resultado = await usuarioDoToken(pedido('Bearer x'));
    expect(resultado).toEqual(ativo);
  });

  it('sessão vencida não entra e é apagada', async () => {
    sessaoNoBanco(-1000);
    expect(await usuarioDoToken(pedido('Bearer x'))).toBeNull();
    expect(session.deleteMany).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it.each(['BLOCKED', 'SUSPENDED', 'DELETED'])('usuário %s não entra', async (status) => {
    sessaoNoBanco(30 * DIA, status);
    expect(await usuarioDoToken(pedido('Bearer x'))).toBeNull();
  });

  it('renova o prazo com o uso', async () => {
    sessaoNoBanco(SESSION_MAX_AGE_SECONDS * 1000 - 2 * DIA);
    await sessaoDoToken(pedido('Bearer x'));

    const { data } = session.updateMany.mock.calls[0]![0];
    expect(data.expires.getTime()).toBeGreaterThan(
      Date.now() + SESSION_MAX_AGE_SECONDS * 1000 - 5000,
    );
  });

  it('não grava no banco a cada request', async () => {
    sessaoNoBanco(SESSION_MAX_AGE_SECONDS * 1000 - 1000);
    await sessaoDoToken(pedido('Bearer x'));
    expect(session.updateMany).not.toHaveBeenCalled();
  });
});

describe('exigências', () => {
  it('sem sessão é 401', async () => {
    await expect(exigirUsuarioDoToken(pedido())).rejects.toMatchObject({
      name: 'AuthorizationError',
      status: 401,
    });
  });

  it('entregador sem aprovação é barrado, mas o cadastro passa', async () => {
    sessaoNoBanco(30 * DIA);
    courier.findUnique.mockResolvedValue({ id: 'c1', status: 'PENDING_APPROVAL' });

    await expect(exigirEntregadorDoToken(pedido('Bearer x'))).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(exigirCadastroDeEntregadorDoToken(pedido('Bearer x'))).resolves.toMatchObject({
      courierId: 'c1',
    });
  });

  it('quem não é entregador é 403', async () => {
    sessaoNoBanco(30 * DIA);
    courier.findUnique.mockResolvedValue(null);
    await expect(exigirEntregadorDoToken(pedido('Bearer x'))).rejects.toMatchObject({ status: 403 });
  });
});

describe('sessão sem cookie', () => {
  it('cria na tabela de sempre, com o prazo longo', async () => {
    const { sessionToken, expires } = await criarSessaoSemCookie('u1');

    expect(sessionToken).toMatch(/^[0-9a-f]{64}$/);
    expect(session.create).toHaveBeenCalledWith({
      data: { sessionToken, userId: 'u1', expires },
    });
    expect(user.update).toHaveBeenCalled();
  });

  it('sair apaga só a sessão do token', async () => {
    await encerrarSessaoDoToken(pedido('Bearer x'));
    expect(session.deleteMany).toHaveBeenCalledWith({ where: { sessionToken: 'x' } });
  });
});
