import { Prisma, prisma } from '@rapidinho/database';
import {
  avisoDeStatusAoCliente,
  inicioDoDia,
  REALTIME_CHANNELS,
  REALTIME_EVENTS,
} from '@rapidinho/shared';
import { notificarUsuario } from '../notifications';
import { publishRealtimeMany } from '../realtime/publisher';
import { getRedis } from '../redis';
import { falha, type Resultado } from './resultado';

/**
 * Regras do entregador.
 *
 * Tudo recebe o `courierId` de quem autenticou, nunca um id vindo do formulário:
 * sem isso um entregador aceitaria a corrida de outro trocando o id.
 */

/** Corrida em andamento: aceita e ainda não entregue. */
export const CORRIDA_ATIVA = ['ACCEPTED', 'PICKED_UP'] as const;

/** Recusa da fila: tempo suficiente para a corrida sair das mãos de alguém. */
const RECUSA_SEGUNDOS = 2 * 60 * 60;

type TipoDeCorrida = 'pedido' | 'avulsa';

/** Recorte da fila: o entregador de loja só vê a loja; o da plataforma, a cidade. */
function recorteDoEntregador(entregador: { cityId: string; storeId: string | null }) {
  return {
    cityId: entregador.cityId,
    ...(entregador.storeId ? { storeId: entregador.storeId } : {}),
  };
}

function dadosDoEntregador(courierId: string) {
  return prisma.courier.findUniqueOrThrow({
    where: { id: courierId },
    select: { cityId: true, storeId: true },
  });
}

/**
 * Aceita uma corrida.
 *
 * O `updateMany` com `courierId: null` no filtro é o que evita dois entregadores
 * pegarem a mesma entrega: quem chegar depois atualiza zero linhas e recebe o
 * aviso, em vez de sobrescrever o primeiro.
 */
export async function aceitarCorridaDoPedido(
  courierId: string,
  deliveryId: string,
): Promise<Resultado> {
  // Mesmo recorte da lista de corridas: sem isto, um id de corrida de outra
  // cidade (ou de outra loja) era aceito direto.
  const entregador = await dadosDoEntregador(courierId);

  const entrega = await prisma.delivery.findFirst({
    where: {
      id: deliveryId,
      status: 'PENDING',
      courierId: null,
      order: recorteDoEntregador(entregador),
    },
    select: { id: true, orderId: true, order: { select: { storeId: true, number: true } } },
  });

  if (!entrega) return falha('Essa corrida já foi aceita por outro entregador.', 'CONFLITO');

  const { count } = await prisma.delivery.updateMany({
    where: { id: entrega.id, courierId: null, status: 'PENDING' },
    data: { courierId, status: 'ACCEPTED', assignedAt: new Date(), acceptedAt: new Date() },
  });

  if (count === 0) return falha('Essa corrida já foi aceita por outro entregador.', 'CONFLITO');

  await publishRealtimeMany(
    [
      REALTIME_CHANNELS.store(entrega.order.storeId),
      REALTIME_CHANNELS.order(entrega.orderId),
      REALTIME_CHANNELS.courier(courierId),
    ],
    REALTIME_EVENTS.deliveryAssigned,
    { deliveryId: entrega.id, orderId: entrega.orderId, number: entrega.order.number },
  );

  return { ok: true, message: `Corrida do pedido #${entrega.order.number} é sua.` };
}

/** Avança a corrida e sincroniza o status do pedido. */
export async function avancarCorridaDoPedido(
  courierId: string,
  dados: { deliveryId: string; status: 'PICKED_UP' | 'DELIVERED' },
): Promise<Resultado> {
  const entrega = await prisma.delivery.findFirst({
    where: { id: dados.deliveryId, courierId },
    select: {
      id: true,
      status: true,
      orderId: true,
      order: { select: { storeId: true, number: true, status: true, userId: true } },
    },
  });

  if (!entrega) return falha('Corrida não encontrada.', 'NAO_ENCONTRADO');

  const permitido: Record<string, string[]> = {
    ACCEPTED: ['PICKED_UP'],
    PICKED_UP: ['DELIVERED'],
  };

  if (!permitido[entrega.status]?.includes(dados.status)) {
    return falha('Essa mudança não é possível agora.', 'CONFLITO');
  }

  const agora = new Date();
  // O status do pedido acompanha o da entrega: o cliente olha o pedido, não a
  // corrida, e os dois não podem contar histórias diferentes.
  const statusDoPedido = dados.status === 'PICKED_UP' ? 'OUT_FOR_DELIVERY' : 'DELIVERED';

  // Corrida e pedido condicionados ao que foi lido: dois toques não contam a
  // entrega duas vezes, e um pedido cancelado pela loja não vira entregue. Sem a
  // linha, o update falha (P2025) e a transação inteira volta.
  try {
    await prisma.$transaction([
      prisma.delivery.update({
        where: { id: entrega.id, status: entrega.status },
        data: {
          status: dados.status,
          ...(dados.status === 'PICKED_UP' ? { pickedUpAt: agora } : { deliveredAt: agora }),
        },
      }),
      prisma.order.update({
        where: {
          id: entrega.orderId,
          status: { notIn: ['CANCELLED', 'REJECTED', 'DELIVERED'] },
        },
        data: {
          status: statusDoPedido,
          ...(dados.status === 'PICKED_UP' ? { dispatchedAt: agora } : { deliveredAt: agora }),
        },
      }),
      prisma.orderStatusHistory.create({
        data: { orderId: entrega.orderId, status: statusDoPedido },
      }),
      ...(dados.status === 'DELIVERED'
        ? [
            prisma.courier.update({
              where: { id: courierId },
              data: { deliveryCount: { increment: 1 } },
            }),
          ]
        : []),
    ]);
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2025') {
      return falha('Este pedido mudou (talvez foi cancelado). Atualize a tela.', 'CONFLITO');
    }
    throw erro;
  }

  if (dados.status === 'DELIVERED') await apagarPosicaoSemCorrida(courierId);

  await publishRealtimeMany(
    [
      REALTIME_CHANNELS.store(entrega.order.storeId),
      REALTIME_CHANNELS.order(entrega.orderId),
      REALTIME_CHANNELS.courier(courierId),
    ],
    REALTIME_EVENTS.deliveryStatusChanged,
    { deliveryId: entrega.id, orderId: entrega.orderId, status: dados.status },
  );

  // Mesmo aviso que o cliente recebe quando é a loja que avança: com entregador
  // da plataforma, "saiu" e "chegou" são marcados aqui, e sem isto quem fechou o
  // app só descobria o pedido na porta.
  if (entrega.order.userId) {
    await notificarUsuario({
      userId: entrega.order.userId,
      title: `Pedido #${entrega.order.number}`,
      ...avisoDeStatusAoCliente(entrega.orderId, statusDoPedido),
      canais: ['PUSH', 'WHATSAPP'],
      entity: { type: 'Order', id: entrega.orderId },
      tag: `pedido-${entrega.orderId}`,
    });
  }

  return {
    ok: true,
    message:
      dados.status === 'PICKED_UP'
        ? 'Pedido retirado. Boa entrega!'
        : `Pedido #${entrega.order.number} entregue.`,
  };
}

export async function alterarDisponibilidadeDoEntregador(
  courierId: string,
  online: boolean,
): Promise<Resultado> {
  await prisma.courier.update({
    where: { id: courierId },
    data: { isOnline: online, lastSeenAt: new Date() },
  });

  return { ok: true, message: online ? 'Você está online.' : 'Você está offline.' };
}

/** Sem corrida, a última posição não fica guardada: é dado de deslocamento. */
async function apagarPosicaoSemCorrida(courierId: string): Promise<void> {
  const ativas = await prisma.delivery.count({
    where: { courierId, status: { in: [...CORRIDA_ATIVA] } },
  });
  const avulsas = await prisma.errand.count({
    where: { courierId, status: { in: [...CORRIDA_ATIVA] } },
  });
  if (ativas + avulsas > 0) return;

  await prisma.courier.update({
    where: { id: courierId },
    data: { latitude: null, longitude: null },
  });
}

/**
 * Posição do entregador, só durante corrida: é a condição para rastrear alguém.
 *
 * Vai para a sala de cada pedido que ele leva, e o token dessa sala só é dado ao
 * dono do pedido. Fora de corrida nada é gravado nem publicado, e o que restou
 * de antes é apagado (uma corrida cancelada pela loja não passa por aqui).
 */
export async function registrarPosicaoDoEntregador(
  courierId: string,
  dados: { latitude: number; longitude: number },
): Promise<Resultado<{ gravada: boolean }>> {
  const [corridas, avulsas] = await Promise.all([
    prisma.delivery.findMany({
      where: {
        courierId,
        status: { in: [...CORRIDA_ATIVA] },
        order: { status: { notIn: ['DELIVERED', 'CANCELLED', 'REJECTED'] } },
      },
      select: { orderId: true },
    }),
    prisma.errand.count({ where: { courierId, status: { in: [...CORRIDA_ATIVA] } } }),
  ]);

  if (corridas.length === 0 && avulsas === 0) {
    await prisma.courier.update({
      where: { id: courierId },
      data: { latitude: null, longitude: null, lastSeenAt: new Date() },
    });
    return { ok: true, gravada: false };
  }

  const agora = new Date();
  await prisma.courier.update({
    where: { id: courierId },
    data: { latitude: dados.latitude, longitude: dados.longitude, lastSeenAt: agora },
  });

  await publishRealtimeMany(
    [
      REALTIME_CHANNELS.courier(courierId),
      ...corridas.map((corrida) => REALTIME_CHANNELS.order(corrida.orderId)),
    ],
    REALTIME_EVENTS.courierLocation,
    { ...dados, atualizadaEm: agora.toISOString() },
  );

  return { ok: true, gravada: true };
}

/**
 * Corrida avulsa (chamada pela loja, fora do app). Mesma trava da corrida de
 * pedido: o `updateMany` só pega a corrida se ela ainda estiver aberta e sem dono.
 */
export async function aceitarCorridaAvulsaDoEntregador(
  courierId: string,
  corridaId: string,
): Promise<Resultado> {
  const entregador = await dadosDoEntregador(courierId);

  const { count } = await prisma.errand.updateMany({
    where: { id: corridaId, status: 'OPEN', courierId: null, ...recorteDoEntregador(entregador) },
    data: { courierId, status: 'ACCEPTED', acceptedAt: new Date() },
  });

  if (count === 0) return falha('Essa corrida já foi aceita por outro entregador.', 'CONFLITO');

  return { ok: true, message: 'Corrida aceita. Vá até a loja buscar.' };
}

export async function avancarCorridaAvulsaDoEntregador(
  courierId: string,
  { corridaId, status }: { corridaId: string; status: 'PICKED_UP' | 'DELIVERED' },
): Promise<Resultado> {
  const de = status === 'PICKED_UP' ? 'ACCEPTED' : 'PICKED_UP';

  // Só o dono da corrida, e só na ordem: aceita → retirada → entregue.
  const { count } = await prisma.errand.updateMany({
    where: { id: corridaId, courierId, status: de },
    data: {
      status,
      ...(status === 'PICKED_UP' ? { pickedUpAt: new Date() } : { deliveredAt: new Date() }),
    },
  });

  if (count === 0) return falha('Esta corrida não está mais com você.', 'CONFLITO');

  if (status === 'DELIVERED') await apagarPosicaoSemCorrida(courierId);

  return {
    ok: true,
    message: status === 'PICKED_UP' ? 'Boa entrega!' : 'Corrida concluída. Valeu!',
  };
}

const chaveDasRecusas = (courierId: string) => `entregador:recusas:${courierId}`;

/** A fila é aberta: recusar só tira da frente de quem recusou, por um tempo. */
async function esconderDaFila(courierId: string, corrida: string): Promise<void> {
  const chave = chaveDasRecusas(courierId);
  await getRedis().multi().sadd(chave, corrida).expire(chave, RECUSA_SEGUNDOS).exec();
}

/** Corridas que este entregador recusou há pouco (`pedido:<id>`, `avulsa:<id>`). */
export async function corridasRecusadas(courierId: string): Promise<string[]> {
  return getRedis().smembers(chaveDasRecusas(courierId));
}

/**
 * Recusa uma corrida.
 *
 * Na fila, some só para quem recusou e segue aberta aos demais. Já aceita e
 * ainda não retirada, volta para a fila: depois de retirada, o pedido está na
 * mão dele e desistir vira conversa com a loja.
 */
export async function recusarCorrida(
  courierId: string,
  dados: { id: string; tipo: TipoDeCorrida; motivo?: string | null },
): Promise<Resultado> {
  const entregador = await dadosDoEntregador(courierId);

  if (dados.tipo === 'avulsa') {
    const { count } = await prisma.errand.updateMany({
      where: { id: dados.id, courierId, status: 'ACCEPTED' },
      data: { courierId: null, status: 'OPEN', acceptedAt: null },
    });
    if (count > 0) return { ok: true, message: 'Corrida devolvida para a fila.' };

    const aberta = await prisma.errand.findFirst({
      where: {
        id: dados.id,
        status: 'OPEN',
        courierId: null,
        ...recorteDoEntregador(entregador),
      },
      select: { id: true },
    });
    if (!aberta) return falha('Corrida não encontrada.', 'NAO_ENCONTRADO');

    await esconderDaFila(courierId, `avulsa:${aberta.id}`);
    return { ok: true, message: 'Corrida recusada.' };
  }

  const { count } = await prisma.delivery.updateMany({
    where: { id: dados.id, courierId, status: { in: ['ASSIGNED', 'ACCEPTED'] } },
    data: {
      courierId: null,
      status: 'PENDING',
      assignedAt: null,
      acceptedAt: null,
      refuseReason: dados.motivo ?? null,
    },
  });

  if (count > 0) {
    await apagarPosicaoSemCorrida(courierId);

    const entrega = await prisma.delivery.findUniqueOrThrow({
      where: { id: dados.id },
      select: { orderId: true, order: { select: { storeId: true } } },
    });
    await publishRealtimeMany(
      [REALTIME_CHANNELS.store(entrega.order.storeId), REALTIME_CHANNELS.order(entrega.orderId)],
      REALTIME_EVENTS.deliveryStatusChanged,
      { deliveryId: dados.id, orderId: entrega.orderId, status: 'PENDING' },
    );
    return { ok: true, message: 'Corrida devolvida para a fila.' };
  }

  const naFila = await prisma.delivery.findFirst({
    where: {
      id: dados.id,
      status: 'PENDING',
      courierId: null,
      order: recorteDoEntregador(entregador),
    },
    select: { id: true },
  });
  if (!naFila) return falha('Corrida não encontrada.', 'NAO_ENCONTRADO');

  await esconderDaFila(courierId, `pedido:${naFila.id}`);
  return { ok: true, message: 'Corrida recusada.' };
}

const SELECT_DA_AVULSA = {
  id: true,
  status: true,
  customerName: true,
  customerPhone: true,
  street: true,
  number: true,
  neighborhood: true,
  referencePoint: true,
  notes: true,
  feeCents: true,
  collectCents: true,
  store: {
    select: {
      name: true,
      phone: true,
      whatsapp: true,
      street: true,
      number: true,
      neighborhood: true,
    },
  },
} as const;

/**
 * Tudo o que o painel do entregador mostra: a fila aberta é o modelo da frota da
 * plataforma, e o entregador de uma loja só vê as corridas daquela loja.
 * `ocultas` são as recusadas, no formato de `corridasRecusadas`.
 */
export async function carregarPainelDoEntregador(courierId: string, ocultas: string[] = []) {
  const entregador = await prisma.courier.findUniqueOrThrow({
    where: { id: courierId },
    select: {
      id: true,
      cityId: true,
      storeId: true,
      isOnline: true,
      deliveryCount: true,
      ratingAverage: true,
      vehicleType: true,
      user: { select: { name: true } },
    },
  });

  // Dia de Brasília: o servidor roda em UTC, e às 21h o "hoje" virava amanhã.
  const comeco = inicioDoDia();
  const recorte = recorteDoEntregador(entregador);

  const idsOcultos = (prefixo: string) =>
    ocultas.filter((id) => id.startsWith(prefixo)).map((id) => id.slice(prefixo.length));

  const [disponiveis, minhas, ganhos, avulsasAbertas, avulsasMinhas, ganhosAvulsos] =
    await Promise.all([
      prisma.delivery.findMany({
        where: {
          status: 'PENDING',
          courierId: null,
          id: { notIn: idsOcultos('pedido:') },
          order: { ...recorte, status: { in: ['READY', 'PREPARING'] } },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: {
          id: true,
          earningCents: true,
          distanceMeters: true,
          order: {
            select: {
              number: true,
              totalCents: true,
              addressSnapshot: true,
              store: { select: { name: true, street: true, number: true, neighborhood: true } },
            },
          },
        },
      }),
      prisma.delivery.findMany({
        where: { courierId, status: { in: [...CORRIDA_ATIVA] } },
        orderBy: { acceptedAt: 'asc' },
        select: {
          id: true,
          status: true,
          earningCents: true,
          order: {
            select: {
              number: true,
              customerName: true,
              customerPhone: true,
              totalCents: true,
              addressSnapshot: true,
              ageConfirmedAt: true,
              prescriptionImageId: true,
              payment: { select: { method: true, status: true, changeForCents: true } },
              store: {
                select: { name: true, phone: true, street: true, number: true, neighborhood: true },
              },
            },
          },
        },
      }),
      prisma.delivery.aggregate({
        where: { courierId, status: 'DELIVERED', deliveredAt: { gte: comeco } },
        _sum: { earningCents: true },
        _count: true,
      }),
      prisma.errand.findMany({
        where: {
          status: 'OPEN',
          courierId: null,
          id: { notIn: idsOcultos('avulsa:') },
          ...recorte,
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        select: SELECT_DA_AVULSA,
      }),
      prisma.errand.findMany({
        where: { courierId, status: { in: [...CORRIDA_ATIVA] } },
        orderBy: { acceptedAt: 'asc' },
        select: SELECT_DA_AVULSA,
      }),
      prisma.errand.aggregate({
        where: { courierId, status: 'DELIVERED', deliveredAt: { gte: comeco } },
        _sum: { feeCents: true },
        _count: true,
      }),
    ]);

  return {
    entregador,
    // O total do dia soma as entregas do app e as corridas avulsas: para quem
    // vive de entrega, o número de cima precisa ser o dia inteiro.
    ganhosDeHoje: {
      centavos: (ganhos._sum.earningCents ?? 0) + (ganhosAvulsos._sum.feeCents ?? 0),
      entregas: ganhos._count + ganhosAvulsos._count,
    },
    ganhosAvulsos: {
      centavos: ganhosAvulsos._sum.feeCents ?? 0,
      corridas: ganhosAvulsos._count,
    },
    disponiveis,
    minhas,
    avulsasAbertas,
    avulsasMinhas,
  };
}

/** Rótulo guardado em `CourierDocument.label`, que é texto livre no banco. */
const TIPOS_DE_DOCUMENTO = ['CNH', 'CRLV', 'OUTRO'] as const;
export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number];

export async function listarDocumentosDoEntregador(courierId: string) {
  return prisma.courier.findUniqueOrThrow({
    where: { id: courierId },
    select: {
      status: true,
      vehicleType: true,
      vehiclePlate: true,
      documents: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          label: true,
          isApproved: true,
          rejectReason: true,
          createdAt: true,
        },
      },
    },
  });
}

/**
 * CNH e dados do veículo, enviados por quem ainda espera aprovação ou por quem
 * precisa renovar. A foto volta a ficar pendente de conferência da plataforma.
 */
export async function enviarDocumentoDoEntregador(
  entregador: { courierId: string; userId: string },
  dados: {
    tipo?: TipoDeDocumento;
    imagemId?: string;
    veiculo?: 'MOTORCYCLE' | 'BICYCLE' | 'CAR' | 'ON_FOOT';
    placa?: string | null;
  },
): Promise<Resultado> {
  if (dados.imagemId && !dados.tipo) {
    return falha('Informe qual documento está enviando.', 'DADOS_INVALIDOS');
  }

  if (dados.imagemId && dados.tipo) {
    // Só o arquivo que esta pessoa enviou: outro id abriria, pelo painel de
    // conferência, a imagem privada de terceiro.
    const arquivo = await prisma.mediaAsset.findFirst({
      where: {
        id: dados.imagemId,
        context: 'COURIER_DOCUMENT',
        uploadedById: entregador.userId,
      },
      select: { id: true },
    });
    if (!arquivo) return falha('Envie a imagem do documento de novo.', 'NAO_ENCONTRADO');

    await prisma.$transaction([
      prisma.courierDocument.deleteMany({
        where: { courierId: entregador.courierId, label: dados.tipo },
      }),
      prisma.courierDocument.create({
        data: { courierId: entregador.courierId, label: dados.tipo, fileId: arquivo.id },
      }),
    ]);
  }

  if (dados.veiculo !== undefined || dados.placa !== undefined) {
    await prisma.courier.update({
      where: { id: entregador.courierId },
      data: {
        vehicleType: dados.veiculo,
        // `undefined` mantém a placa; vazio apaga (bicicleta e a pé não têm).
        vehiclePlate: dados.placa === undefined ? undefined : dados.placa || null,
      },
    });
  }

  return { ok: true, message: 'Recebemos seus dados. Vamos conferir e avisamos por aqui.' };
}
