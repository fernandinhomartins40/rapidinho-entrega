import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { Bike, Check, ChefHat, PackageCheck, Receipt } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { StatusDoPedido, TipoDePedido } from '@contrato';
import { T } from '@/componentes/base';
import { cores, degradeDaMarca, raio } from '@/tema/tokens';

type Etapa = { status: StatusDoPedido[]; rotulo: string; Icone: LucideIcon };

const ETAPAS: Etapa[] = [
  { status: ['PENDING_PAYMENT', 'RECEIVED'], rotulo: 'Recebido', Icone: Receipt },
  { status: ['ACCEPTED', 'PREPARING'], rotulo: 'Preparando', Icone: ChefHat },
  { status: ['READY'], rotulo: 'Pronto', Icone: PackageCheck },
  { status: ['OUT_FOR_DELIVERY'], rotulo: 'A caminho', Icone: Bike },
  { status: ['DELIVERED'], rotulo: 'Entregue', Icone: Check },
];

export function etapasDoPedido(tipo: TipoDePedido) {
  return tipo === 'PICKUP' ? ETAPAS.filter((e) => e.rotulo !== 'A caminho') : ETAPAS;
}

/** Cor do selo pelo momento do pedido: laranja andando, verde entregue, cinza parado. */
export function tomDoStatus(status: StatusDoPedido) {
  if (status === 'DELIVERED') return { cor: cores.textoNaCor, fundo: cores.sucesso };
  if (status === 'CANCELLED' || status === 'REJECTED')
    return { cor: cores.textoNaCor, fundo: '#8E8AA0' };
  if (status === 'PENDING_PAYMENT') return { cor: cores.noite, fundo: cores.amarelo };
  return { cor: cores.textoNaCor, fundo: cores.marca };
}

export function SeloDoStatus({ status, rotulo }: { status: StatusDoPedido; rotulo: string }) {
  const tom = tomDoStatus(status);
  return (
    <View style={[estilos.selo, { backgroundColor: tom.fundo }]}>
      <T v="mini" cor={tom.cor} style={{ fontSize: 12 }}>
        {rotulo}
      </T>
    </View>
  );
}

/** Linha de etapas com ícones: o que já passou fica laranja, o atual em destaque. */
export function TrilhaDoPedido({
  status,
  tipo,
  claro,
}: {
  status: StatusDoPedido;
  tipo: TipoDePedido;
  claro?: boolean;
}) {
  const etapas = etapasDoPedido(tipo);
  const atual = Math.max(
    0,
    etapas.findIndex((e) => e.status.includes(status)),
  );
  const apagado = claro ? 'rgba(255,255,255,0.35)' : cores.linha;

  return (
    <View style={estilos.trilha} accessibilityLabel={`Etapa: ${etapas[atual]?.rotulo}`}>
      {etapas.map((e, i) => {
        const feita = i < atual;
        const agora = i === atual;
        const { Icone } = e;
        return (
          <View key={e.rotulo} style={estilos.passo}>
            {i > 0 ? (
              <View
                style={[estilos.traco, { backgroundColor: i <= atual ? cores.marca : apagado }]}
              />
            ) : null}
            {agora ? (
              <LinearGradient colors={degradeDaMarca} style={[estilos.bolaGrande]}>
                <Icone size={18} color={cores.textoNaCor} strokeWidth={2.4} />
              </LinearGradient>
            ) : (
              <View
                style={[
                  estilos.bola,
                  {
                    backgroundColor: feita
                      ? cores.marca
                      : claro
                        ? 'rgba(255,255,255,0.12)'
                        : cores.superficieAlta,
                  },
                ]}
              >
                <Icone
                  size={14}
                  color={
                    feita ? cores.textoNaCor : claro ? 'rgba(255,255,255,0.6)' : cores.textoFraco
                  }
                  strokeWidth={2.4}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  selo: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: raio.total,
  },
  trilha: { flexDirection: 'row', alignItems: 'center' },
  passo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  traco: { flex: 1, height: 4, borderRadius: 2, marginHorizontal: 4 },
  bola: {
    width: 30,
    height: 30,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bolaGrande: {
    width: 38,
    height: 38,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
