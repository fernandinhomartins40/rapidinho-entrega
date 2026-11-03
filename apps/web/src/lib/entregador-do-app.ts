import { type carregarPainelDoEntregador, enderecoDoSnapshot } from '@rapidinho/services/regras';
import type {
  CorridaAvulsa,
  PainelDoEntregador,
  StatusDoPagamento,
  Veiculo,
} from '@rapidinho/shared/app-api';

type Painel = Awaited<ReturnType<typeof carregarPainelDoEntregador>>;

function enderecoDaLoja(loja: { street: string; number: string | null; neighborhood: string }) {
  return `${loja.street}${loja.number ? `, ${loja.number}` : ''} — ${loja.neighborhood}`;
}

function paraAvulsa(corrida: Painel['avulsasAbertas'][number]): CorridaAvulsa {
  return {
    id: corrida.id,
    status: corrida.status as CorridaAvulsa['status'],
    ganhoCents: corrida.feeCents,
    cobrarCents: corrida.collectCents,
    loja: {
      nome: corrida.store.name,
      telefone: corrida.store.whatsapp ?? corrida.store.phone,
      endereco: enderecoDaLoja(corrida.store),
    },
    cliente: corrida.customerName,
    telefoneDoCliente: corrida.customerPhone,
    endereco: enderecoDaLoja(corrida),
    referencia: corrida.referencePoint,
    recado: corrida.notes,
  };
}

export function paraPainelDoApp(painel: Painel): PainelDoEntregador {
  const { entregador } = painel;

  return {
    entregador: {
      nome: entregador.user.name,
      online: entregador.isOnline,
      entregasTotais: entregador.deliveryCount,
      nota: Number(entregador.ratingAverage),
      daLoja: entregador.storeId != null,
      veiculo: entregador.vehicleType as Veiculo,
    },
    ganhosDeHoje: {
      ganhoCents: painel.ganhosDeHoje.centavos,
      entregas: painel.ganhosDeHoje.entregas,
    },
    disponiveis: painel.disponiveis.map((corrida) => ({
      id: corrida.id,
      ganhoCents: corrida.earningCents,
      distanciaMetros: corrida.distanceMeters,
      numero: corrida.order.number,
      totalCents: corrida.order.totalCents,
      loja: {
        nome: corrida.order.store.name,
        telefone: null,
        endereco: enderecoDaLoja(corrida.order.store),
      },
      destino: enderecoDoSnapshot(corrida.order.addressSnapshot),
    })),
    minhas: painel.minhas.map((corrida) => ({
      id: corrida.id,
      status: corrida.status as 'ACCEPTED' | 'PICKED_UP',
      ganhoCents: corrida.earningCents,
      numero: corrida.order.number,
      cliente: corrida.order.customerName,
      telefoneDoCliente: corrida.order.customerPhone,
      totalCents: corrida.order.totalCents,
      destino: enderecoDoSnapshot(corrida.order.addressSnapshot),
      loja: {
        nome: corrida.order.store.name,
        telefone: corrida.order.store.phone,
        endereco: enderecoDaLoja(corrida.order.store),
      },
      conferirDocumento: corrida.order.ageConfirmedAt != null,
      conferirReceita: corrida.order.prescriptionImageId != null,
      pagamento: corrida.order.payment
        ? {
            forma: corrida.order.payment.method,
            status: corrida.order.payment.status as StatusDoPagamento,
            trocoParaCents: corrida.order.payment.changeForCents,
          }
        : null,
    })),
    avulsasDisponiveis: painel.avulsasAbertas.map(paraAvulsa),
    avulsasMinhas: painel.avulsasMinhas.map(paraAvulsa),
  };
}
