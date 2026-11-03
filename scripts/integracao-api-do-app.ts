/**
 * Integração da API do app contra o ambiente local (web em :3000), sem navegador.
 *
 *   pnpm --filter @rapidinho/database exec tsx ../../scripts/integracao-api-do-app.ts
 *
 * Cria dois clientes descartáveis com sessão direto na tabela `sessions` (o login
 * real é pelo Firebase, que não se chama em teste), roda um caso por grupo de
 * rotas, inclusive sem token e com o token do outro (IDOR), e apaga tudo no fim.
 */
import { randomBytes } from 'node:crypto';
import { prisma } from '../packages/database/src/index';

const API = `${process.env.API_URL ?? 'http://localhost:3000'}/api/app/v1`;
const MARCA = `+55009${Date.now().toString().slice(-8)}`;

let falhas = 0;
function conferir(nome: string, ok: boolean, detalhe = '') {
  if (!ok) falhas += 1;
  console.log(`${ok ? 'ok  ' : 'FALHOU'} ${nome}${ok ? '' : `  ${detalhe}`}`);
}

async function chamar(caminho: string, token?: string, init: RequestInit = {}) {
  const resposta = await fetch(`${API}/${caminho}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // IP próprio por execução: o limite por IP não esbarra nos revisores.
      'X-Real-IP': `10.99.${Date.now() % 250}.1`,
    },
  });
  const corpo = await resposta.json().catch(() => null);
  return { status: resposta.status, corpo: corpo as Record<string, unknown> | null };
}

async function clienteDeTeste(sufixo: string) {
  const user = await prisma.user.create({
    data: { phone: `${MARCA}${sufixo}`, name: `Teste ${sufixo}`, role: 'CUSTOMER' },
  });
  const sessionToken = randomBytes(32).toString('hex');
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 86_400_000) },
  });
  return { id: user.id, token: sessionToken };
}

async function main() {
  const cidade = await prisma.city.findFirst({ where: { isActive: true, stores: { some: { status: 'ACTIVE' } } } });
  const produto = await prisma.product.findFirst({
    where: {
      deletedAt: null,
      isAvailable: true,
      sellingUnit: 'UNIT',
      stockQuantity: null,
      prescription: 'NONE',
      productType: 'SIMPLE',
      complementGroups: { none: {} },
      store: { status: 'ACTIVE', deletedAt: null, cityId: cidade?.id },
    },
    select: { id: true, storeId: true },
  });
  if (!cidade || !produto) throw new Error('Sem cidade ou produto no banco local');

  const ana = await clienteDeTeste('1');
  const bia = await clienteDeTeste('2');

  try {
    // ---- públicas
    conferir('configuracao', (await chamar('configuracao')).corpo?.loginPorFirebase !== undefined);
    const vitrine = await chamar(`cidades/${cidade.slug}/vitrine`);
    conferir('vitrine', vitrine.status === 200 && Array.isArray(vitrine.corpo?.lojas));
    conferir('cidade inexistente 404', (await chamar('cidades/nao-existe/vitrine')).status === 404);
    conferir('busca', (await chamar(`cidades/${cidade.slug}/busca?q=ar`)).status === 200);
    conferir('produto', (await chamar(`cidades/${cidade.slug}/produtos/${produto.id}`)).status === 200);

    // ---- auth
    const firebase = await chamar('auth/firebase', undefined, {
      method: 'POST',
      body: JSON.stringify({ idToken: 'x.y.z' }),
    });
    conferir(
      'auth/firebase recusa token falso (401) ou está desligado (503)',
      (firebase.status === 401 && firebase.corpo?.codigo === 'TOKEN_FIREBASE_INVALIDO') ||
        (firebase.status === 503 && firebase.corpo?.codigo === 'FIREBASE_DESLIGADO'),
      JSON.stringify(firebase),
    );

    // ---- conta
    conferir('eu sem token 401', (await chamar('eu')).status === 401);
    conferir('eu com token lixo 401', (await chamar('eu', 'lixo')).status === 401);
    const eu = await chamar('eu', ana.token);
    conferir('eu', eu.corpo?.id === ana.id && typeof eu.corpo?.termosPendentes === 'boolean');
    const nome = await chamar('eu', ana.token, { method: 'PATCH', body: JSON.stringify({ nome: 'A' }) });
    conferir('PATCH eu valida (422 DADOS_INVALIDOS)', nome.status === 422 && nome.corpo?.codigo === 'DADOS_INVALIDOS');

    // ---- endereços
    const endereco = await chamar('enderecos', ana.token, {
      method: 'POST',
      body: JSON.stringify({ rua: 'Rua Teste', bairro: 'Centro', referencia: 'Perto da igreja', cidadeId: cidade.id }),
    });
    const enderecoId = endereco.corpo?.id as string;
    conferir('cria endereço', endereco.status === 201 && endereco.corpo?.padrao === true);
    conferir('IDOR endereço GET', (await chamar(`enderecos/${enderecoId}`, bia.token)).status === 404);
    conferir('IDOR endereço DELETE', (await chamar(`enderecos/${enderecoId}`, bia.token, { method: 'DELETE' })).status === 404);

    // ---- carrinho
    const item = await chamar('carrinho/itens', ana.token, {
      method: 'POST',
      body: JSON.stringify({ lojaId: produto.storeId, item: { produtoId: produto.id, quantidade: 2 } }),
    });
    const carrinhos = item.corpo?.carrinhos as { itens: { id: string }[] }[] | undefined;
    const itemId = carrinhos?.[0]?.itens[0]?.id;
    conferir('adiciona ao carrinho', item.status === 201 && !!itemId, JSON.stringify(item.corpo));
    conferir('carrinho sem token 401', (await chamar('carrinho')).status === 401);
    const alheio = await chamar(`carrinho/itens/${itemId}`, bia.token, {
      method: 'PATCH',
      body: JSON.stringify({ quantidade: 5 }),
    });
    conferir('IDOR item do carrinho', alheio.status === 404);

    // ---- checkout e pedido
    const resumo = await chamar(`checkout/resumo?lojaId=${produto.storeId}&enderecoId=${enderecoId}`, ana.token);
    conferir('resumo do checkout', resumo.status === 200 && typeof (resumo.corpo?.valores as { totalCents?: number })?.totalCents === 'number');
    const vazio = await chamar('pedidos', bia.token, {
      method: 'POST',
      body: JSON.stringify({ chaveDeIdempotencia: 'teste-vazio-123', lojaId: produto.storeId, tipo: 'PICKUP', formaDePagamento: 'CASH_ON_DELIVERY' }),
    });
    conferir('pedido de carrinho vazio 409', vazio.status === 409 && vazio.corpo?.codigo === 'CARRINHO_VAZIO', JSON.stringify(vazio));
    const cartao = await chamar('pedidos', ana.token, {
      method: 'POST',
      body: JSON.stringify({ chaveDeIdempotencia: 'teste-cartao-1', lojaId: produto.storeId, formaDePagamento: 'CREDIT_CARD_ONLINE' }),
    });
    conferir('cartão online recusado (422)', cartao.status === 422);

    // Pedido real só se a loja estiver aberta: o resumo diz.
    if (!resumo.corpo?.bloqueio) {
      const corpo = JSON.stringify({ chaveDeIdempotencia: `teste-${MARCA}`, lojaId: produto.storeId, enderecoId, formaDePagamento: 'CASH_ON_DELIVERY' });
      const [p1, p2] = await Promise.all([
        chamar('pedidos', ana.token, { method: 'POST', body: corpo }),
        chamar('pedidos', ana.token, { method: 'POST', body: corpo }),
      ]);
      conferir('idempotência: dois envios, um pedido', p1.corpo?.id === p2.corpo?.id && !!p1.corpo?.id, JSON.stringify([p1, p2]));
      const pedidoId = p1.corpo?.id as string;
      conferir('IDOR pedido GET', (await chamar(`pedidos/${pedidoId}`, bia.token)).status === 404);
      conferir('IDOR pedido cancelar', (await chamar(`pedidos/${pedidoId}/cancelar`, bia.token, { method: 'POST' })).status === 404);
      conferir('IDOR token de tempo real', (await chamar(`realtime/token?canal=pedido&id=${pedidoId}`, bia.token)).status === 404);
      conferir('token de tempo real do dono', (await chamar(`realtime/token?canal=pedido&id=${pedidoId}`, ana.token)).corpo?.canal === `order:${pedidoId}`);
      const cancelado = await chamar(`pedidos/${pedidoId}/cancelar`, ana.token, { method: 'POST' });
      conferir('dono cancela antes do aceite', cancelado.status === 200 || cancelado.status === 409, JSON.stringify(cancelado));
    } else {
      console.log(`aviso: loja fechada (${String(resumo.corpo.bloqueio)}); pedido real não testado`);
    }

    // ---- favoritos, dispositivos, entregador, uploads
    const favorito = await chamar('favoritos/alternar', ana.token, { method: 'POST', body: JSON.stringify({ lojaId: produto.storeId }) });
    conferir('alterna favorito', favorito.corpo?.favorita === true);
    const aparelho = await chamar('dispositivos', ana.token, {
      method: 'POST',
      body: JSON.stringify({ expoPushToken: `ExponentPushToken[teste${Date.now()}]`, plataforma: 'android' }),
    });
    conferir('registra aparelho', aparelho.status === 200, JSON.stringify(aparelho));
    conferir('cliente no painel do entregador 403', (await chamar('entregador/painel', ana.token)).status === 403);
    conferir('localização sem token 401', (await chamar('entregador/localizacao', undefined, { method: 'POST', body: '{}' })).status === 401);
    conferir('upload sem token 401', (await chamar('uploads', undefined, { method: 'POST' })).status === 401);

    // ---- exclusão e saída
    const sair = await chamar('auth/sair', bia.token, { method: 'POST' });
    conferir('sair', sair.status === 200 && (await chamar('eu', bia.token)).status === 401);
    const aparelhos = await prisma.pushDevice.count({ where: { userId: ana.id } });
    conferir('aparelho preso à sessão', aparelhos === 1);
  } finally {
    const ids = [ana.id, bia.id];
    const pedidos = await prisma.order.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    await prisma.order.deleteMany({ where: { id: { in: pedidos.map((pedido) => pedido.id) } } });
    await prisma.consentRecord.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

void main();
