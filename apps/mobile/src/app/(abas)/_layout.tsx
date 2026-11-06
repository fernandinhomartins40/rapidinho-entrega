import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { House, ReceiptText, Search, ShoppingCart, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConfiguracaoDoApp } from '@contrato';
import { useCarrinho } from '@/api/carrinho';
import { chamar } from '@/api/cliente';
import { T, Toque } from '@/componentes/base';
import { ALTURA_DA_BARRA } from '@/componentes/folga';
import { icones3d } from '@/tema/icones';
import { cores, elevacao, fontes, raio } from '@/tema/tokens';

/**
 * O botão do meio não é aba: abre o pedido por lista, a porta de entrada que
 * diferencia o app. Com o recurso desligado no painel, cai para a sacola.
 */
function BotaoDoMeio() {
  const configuracao = useQuery({
    queryKey: ['configuracao'],
    queryFn: () => chamar<ConfiguracaoDoApp>('configuracao'),
    staleTime: 10 * 60_000,
  });
  const carrinho = useCarrinho();
  const itens = carrinho.data?.quantidadeDeItens ?? 0;
  const porLista = configuracao.data?.recursos.pedidoPorLista !== false;

  return (
    <View style={estilos.lugar}>
      <Toque
        accessibilityLabel={porLista ? 'Pedir por lista' : 'Abrir a sacola'}
        onPress={() => router.push(porLista ? '/lista' : '/sacola')}
        style={[estilos.circulo, porLista && estilos.circuloDaLista, elevacao.alta]}
      >
        {porLista ? (
          <Image source={icones3d.pedirPorLista} style={estilos.lista} contentFit="contain" />
        ) : (
          <ShoppingCart size={26} color={cores.textoNaCor} strokeWidth={2.4} />
        )}
        {!porLista && itens ? (
          <View style={estilos.contagem}>
            <T v="mini" cor={cores.textoNaCor}>
              {itens > 9 ? '9+' : itens}
            </T>
          </View>
        ) : null}
      </Toque>
      <T v="mini" cor={cores.marca} style={estilos.rotulo}>
        {porLista ? 'lista' : 'sacola'}
      </T>
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
      <Tabs.Screen name="pedir" options={{ title: 'lista', tabBarButton: () => <BotaoDoMeio /> }} />
      <Tabs.Screen name="pedidos" options={{ title: 'pedidos', tabBarIcon: icone(ReceiptText) }} />
      <Tabs.Screen name="conta" options={{ title: 'conta', tabBarIcon: icone(UserRound) }} />
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
  lugar: { flex: 1, alignItems: 'center' },
  rotulo: { marginTop: 2, fontSize: 12 },
  circuloDaLista: { backgroundColor: cores.superficie, borderColor: cores.marca, borderWidth: 3 },
  lista: { width: 40, height: 40 },
  circulo: {
    marginTop: -22,
    width: 58,
    height: 58,
    borderWidth: 4,
    borderColor: cores.superficie,
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
