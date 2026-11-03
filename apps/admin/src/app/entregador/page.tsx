import { redirect } from 'next/navigation';
import { AuthorizationError, requireCourier } from '@rapidinho/auth';
import { carregarPainelDoEntregador, corridasRecusadas } from '@rapidinho/services/regras';
import { getPublicEnv, parseServerEnv, REALTIME_CHANNELS } from '@rapidinho/shared';
import { createChannelToken } from '@rapidinho/shared/realtime/token';
import { PainelDoEntregador } from './painel';
import { CorridasAvulsas, type CorridaAvulsa } from './corridas-avulsas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entregas' };

/**
 * Painel do entregador.
 *
 * Mostra as corridas disponíveis na cidade dele e as que já são suas. A fila
 * aberta é o modelo da frota da plataforma; o entregador de uma loja só vê as
 * corridas daquela loja.
 */
export default async function EntregadorPage() {
  let contexto;

  try {
    contexto = await requireCourier();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      redirect(error.status === 401 ? '/entrar?destino=/entregador' : '/');
    }
    throw error;
  }

  const {
    entregador,
    ganhosDeHoje,
    ganhosAvulsos,
    disponiveis,
    minhas,
    avulsasAbertas,
    avulsasMinhas,
  } = await carregarPainelDoEntregador(
    contexto.courierId,
    await corridasRecusadas(contexto.courierId),
  );

  const channel = REALTIME_CHANNELS.courier(entregador.id);

  const paraTela = (corrida: (typeof avulsasAbertas)[number]): CorridaAvulsa => ({
    id: corrida.id,
    status: corrida.status as CorridaAvulsa['status'],
    loja: {
      nome: corrida.store.name,
      endereco: `${corrida.store.street}${corrida.store.number ? `, ${corrida.store.number}` : ''} — ${corrida.store.neighborhood}`,
      telefone: corrida.store.whatsapp ?? corrida.store.phone,
    },
    cliente: corrida.customerName,
    telefoneDoCliente: corrida.customerPhone,
    endereco: `${corrida.street}${corrida.number ? `, ${corrida.number}` : ''} — ${corrida.neighborhood}`,
    referencia: corrida.referencePoint,
    recado: corrida.notes,
    feeCents: corrida.feeCents,
    collectCents: corrida.collectCents,
  });

  return (
    <PainelDoEntregador
      entregador={{
        nome: entregador.user.name,
        online: entregador.isOnline,
        entregasTotais: entregador.deliveryCount,
        nota: Number(entregador.ratingAverage),
        daLoja: entregador.storeId != null,
      }}
      ganhosDeHoje={ganhosDeHoje}
      disponiveis={disponiveis}
      minhas={minhas}
      realtime={{
        channel,
        token: createChannelToken(
          { channel, userId: contexto.user.id },
          parseServerEnv().AUTH_SECRET,
        ),
        url: getPublicEnv().NEXT_PUBLIC_SOCKET_URL,
      }}
    >
      <CorridasAvulsas
        abertas={avulsasAbertas.map(paraTela)}
        minhas={avulsasMinhas.map(paraTela)}
        ganhosDeHoje={ganhosAvulsos}
      />
    </PainelDoEntregador>
  );
}
