import { LinearGradient } from 'expo-linear-gradient';
import { router, Tabs } from 'expo-router';
import { Heart, House, ReceiptText, ShoppingCart, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCarrinho } from '@/api/carrinho';
import { T, Toque } from '@/componentes/base';
import { ALTURA_DA_BARRA } from '@/componentes/folga';
import { cores, degradeDaMarca, elevacao, fontes, raio } from '@/tema/tokens';

/** O botão do meio não é aba: abre a sacola por cima de onde a pessoa está. */
function BotaoPedir() {
  const carrinho = useCarrinho();
  const itens = carrinho.data?.quantidadeDeItens ?? 0;

  return (
    <View style={estilos.lugar}>
      <Toque
        accessibilityLabel={itens ? `Pedir: ${itens} itens na sacola` : 'Pedir: abrir a sacola'}
        onPress={() => router.push('/sacola')}
        style={estilos.botao}
      >
        <LinearGradient
          colors={degradeDaMarca}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.circulo}
        >
          <ShoppingCart size={28} color={cores.textoNaCor} strokeWidth={2.4} />
        </LinearGradient>
        {itens ? (
          <View style={estilos.contagem}>
            <T v="mini" cor={cores.textoNaCor}>
              {itens > 9 ? '9+' : itens}
            </T>
          </View>
        ) : null}
      </Toque>
      <T v="mini" cor={cores.texto} style={estilos.rotulo}>
        Pedir
      </T>
    </View>
  );
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
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: ({ color }) => <House color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color }) => <ReceiptText color={color} size={24} />,
        }}
      />
      <Tabs.Screen name="pedir" options={{ title: 'Pedir', tabBarButton: () => <BotaoPedir /> }} />
      <Tabs.Screen
        name="favoritos"
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ color }) => <Heart color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="conta"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <UserRound color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  barra: {
    backgroundColor: cores.superficie,
    borderTopWidth: 0,
    paddingTop: 6,
    borderTopLeftRadius: raio.folha,
    borderTopRightRadius: raio.folha,
    position: 'absolute',
    ...elevacao.alta,
  },
  lugar: { flex: 1, alignItems: 'center' },
  botao: { marginTop: -30 },
  circulo: {
    width: 66,
    height: 66,
    borderRadius: raio.total,
    borderWidth: 5,
    borderColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevacao.alta,
  },
  contagem: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 22,
    height: 22,
    borderRadius: raio.total,
    backgroundColor: cores.noite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotulo: { marginTop: 2, fontSize: 12 },
});
