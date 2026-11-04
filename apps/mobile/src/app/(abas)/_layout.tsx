import { router, Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { House, ReceiptText, Search, ShoppingCart, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCarrinho } from '@/api/carrinho';
import { T, Toque } from '@/componentes/base';
import { ALTURA_DA_BARRA } from '@/componentes/folga';
import { cores, elevacao, fontes, raio } from '@/tema/tokens';

/** O botão do meio não é aba: abre a sacola por cima de onde a pessoa está. */
function BotaoPedir() {
  const carrinho = useCarrinho();
  const itens = carrinho.data?.quantidadeDeItens ?? 0;

  return (
    <View style={estilos.lugar}>
      <Toque
        accessibilityLabel={itens ? `Sacola: ${itens} itens` : 'Abrir a sacola'}
        onPress={() => router.push('/sacola')}
        style={[estilos.circulo, elevacao.alta]}
      >
        <ShoppingCart size={26} color={cores.textoNaCor} strokeWidth={2.4} />
        {itens ? (
          <View style={estilos.contagem}>
            <T v="mini" cor={cores.textoNaCor}>
              {itens > 9 ? '9+' : itens}
            </T>
          </View>
        ) : null}
      </Toque>
    </View>
  );
}

/** Ícone da aba; a escolhida ganha uma pílula laranja-clara atrás. */
function icone(Icone: LucideIcon) {
  return function IconeDaAba({ focused }: { focused: boolean }) {
    return (
      <View style={[estilos.pilula, focused && estilos.pilulaLigada]}>
        <Icone
          color={focused ? cores.marca : cores.textoMedio}
          size={24}
          strokeWidth={focused ? 2.4 : 2}
        />
      </View>
    );
  };
}

export default function Abas() {
  // Os botões do Android desenham por cima do app; a barra cresce para baixo deles.
  const baixo = useSafeAreaInsets().bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.marca,
        tabBarInactiveTintColor: cores.textoMedio,
        tabBarLabelStyle: { fontFamily: fontes.corpoForte, fontSize: 12 },
        tabBarStyle: [estilos.barra, { height: ALTURA_DA_BARRA + baixo, paddingBottom: baixo + 6 }],
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'início', tabBarIcon: icone(House) }} />
      <Tabs.Screen
        name="buscar"
        options={{ title: 'busca', tabBarIcon: icone(Search) }}
        listeners={{
          tabPress: (evento) => {
            evento.preventDefault();
            router.push('/busca');
          },
        }}
      />
      <Tabs.Screen name="pedir" options={{ title: 'sacola', tabBarButton: () => <BotaoPedir /> }} />
      <Tabs.Screen name="pedidos" options={{ title: 'pedidos', tabBarIcon: icone(ReceiptText) }} />
      <Tabs.Screen name="conta" options={{ title: 'conta', tabBarIcon: icone(UserRound) }} />
      {/* Favoritos saiu da barra e fica no menu da conta. */}
      <Tabs.Screen name="favoritos" options={{ href: null }} />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  barra: {
    backgroundColor: cores.superficie,
    borderTopWidth: 0,
    paddingTop: 8,
    borderTopLeftRadius: raio.folha,
    borderTopRightRadius: raio.folha,
    position: 'absolute',
    ...elevacao.alta,
  },
  pilula: {
    width: 56,
    height: 32,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilulaLigada: { backgroundColor: cores.marcaClara },
  lugar: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circulo: {
    width: 58,
    height: 58,
    borderRadius: raio.total,
    backgroundColor: cores.marca,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contagem: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: raio.total,
    borderWidth: 2,
    borderColor: cores.superficie,
    backgroundColor: cores.noite,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
