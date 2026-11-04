import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { LucideIcon } from 'lucide-react-native';
import { RefreshCw, ShoppingBag } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  cores,
  coresDaCategoria,
  degradeDaMarca,
  espaco,
  raio,
  texto,
  toqueMinimo,
  type ChaveDaCategoria,
} from '@/tema/tokens';
import { urlDaImagem } from '@/api/cliente';
import type { Icone3d } from '@/tema/icones';

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

type EstiloDeTexto = keyof typeof texto;

export function T({
  v = 'corpo',
  cor = cores.texto,
  style,
  ...resto
}: TextProps & { v?: EstiloDeTexto; cor?: string }) {
  return <Text maxFontSizeMultiplier={1.4} style={[texto[v], { color: cor }, style]} {...resto} />;
}

/** Toque com leve encolhida: a resposta física que faltava no WebView. */
export function Toque({
  children,
  style,
  encolhe = 0.97,
  ...resto
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; encolhe?: number }) {
  const escala = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <PressableAnimado
      accessibilityRole="button"
      onPressIn={() => {
        escala.value = withSpring(encolhe, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        escala.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      style={[animado, style]}
      {...resto}
    >
      {children}
    </PressableAnimado>
  );
}

type PropsDoBotao = {
  titulo: string;
  aoTocar: () => void;
  variante?: 'principal' | 'secundario' | 'perigo' | 'discreto';
  Icone?: LucideIcon;
  carregando?: boolean;
  desativado?: boolean;
  estilo?: StyleProp<ViewStyle>;
};

export function Botao({
  titulo,
  aoTocar,
  variante = 'principal',
  Icone,
  carregando,
  desativado,
  estilo,
}: PropsDoBotao) {
  const bloqueado = carregando || desativado;
  const corDoTexto =
    variante === 'principal'
      ? cores.textoNaCor
      : variante === 'perigo'
        ? cores.perigo
        : cores.marcaEscura;

  const conteudo = carregando ? (
    <ActivityIndicator color={corDoTexto} />
  ) : (
    <>
      {Icone ? <Icone size={20} color={corDoTexto} strokeWidth={2} /> : null}
      <T v="corpoForte" cor={corDoTexto}>
        {titulo}
      </T>
    </>
  );

  return (
    <Toque
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: !!bloqueado, busy: !!carregando }}
      disabled={bloqueado}
      onPress={() => {
        void Haptics.selectionAsync();
        aoTocar();
      }}
      style={[{ opacity: desativado ? 0.5 : 1 }, estilo]}
    >
      {variante === 'principal' ? (
        <LinearGradient
          colors={degradeDaMarca}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={estilos.botao}
        >
          {conteudo}
        </LinearGradient>
      ) : (
        <View
          style={[
            estilos.botao,
            variante === 'secundario' && estilos.botaoSecundario,
            variante === 'perigo' && estilos.botaoPerigo,
          ]}
        >
          {conteudo}
        </View>
      )}
    </Toque>
  );
}

/**
 * Foto ausente nunca vira quadrado cinza: vira a cor da categoria, com o
 * ícone 3D dela quando houver.
 */
export function Foto({
  url,
  categoria = 'outros',
  Icone = ShoppingBag,
  tamanhoDoIcone = 32,
  reserva,
  estilo,
}: {
  url?: string | null;
  categoria?: ChaveDaCategoria;
  Icone?: LucideIcon;
  tamanhoDoIcone?: number;
  reserva?: Icone3d;
  estilo?: StyleProp<ViewStyle>;
}) {
  const fonte = urlDaImagem(url);
  const tom = coresDaCategoria[categoria];

  return (
    <View style={[estilos.foto, { backgroundColor: tom.fundo }, estilo]}>
      {fonte ? (
        <Image
          source={fonte}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          recyclingKey={fonte}
        />
      ) : reserva ? (
        <Image source={reserva} style={estilos.reserva} contentFit="contain" />
      ) : (
        <Icone size={tamanhoDoIcone} color={tom.cor} strokeWidth={2} />
      )}
    </View>
  );
}

export function Selo({ texto: rotulo, cor, fundo }: { texto: string; cor: string; fundo: string }) {
  return (
    <View style={[estilos.selo, { backgroundColor: fundo }]}>
      <T v="mini" cor={cor}>
        {rotulo}
      </T>
    </View>
  );
}

export function Esqueleto({ estilo }: { estilo?: StyleProp<ViewStyle> }) {
  const reduzido = useReducedMotion();
  const opacidade = useSharedValue(0.55);

  useEffect(() => {
    if (!reduzido) opacidade.value = withRepeat(withTiming(1, { duration: 750 }), -1, true);
  }, [opacidade, reduzido]);

  const animado = useAnimatedStyle(() => ({ opacity: opacidade.value }));
  return <Animated.View style={[estilos.esqueleto, animado, estilo]} />;
}

export function EstadoDaTela({
  Icone,
  titulo,
  descricao,
  acao,
}: {
  Icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <View style={estilos.estado}>
      <View style={estilos.estadoIcone}>
        <Icone size={32} color={cores.marca} strokeWidth={2} />
      </View>
      <T v="titulo2" style={estilos.centro}>
        {titulo}
      </T>
      {descricao ? (
        <T cor={cores.textoMedio} style={estilos.centro}>
          {descricao}
        </T>
      ) : null}
      {acao}
    </View>
  );
}

export function ErroDaTela({ mensagem, aoTentar }: { mensagem: string; aoTentar: () => void }) {
  return (
    <EstadoDaTela
      Icone={RefreshCw}
      titulo="Não deu para carregar"
      descricao={mensagem}
      acao={
        <Botao titulo="Tentar de novo" variante="secundario" aoTocar={aoTentar} Icone={RefreshCw} />
      }
    />
  );
}

export function dinheiro(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const estilos = StyleSheet.create({
  botao: {
    minHeight: toqueMinimo + 4,
    borderRadius: raio.medio,
    paddingHorizontal: espaco.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.s,
  },
  botaoSecundario: { backgroundColor: cores.marcaClara },
  botaoPerigo: { backgroundColor: cores.perigoClaro },
  foto: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  reserva: { width: '70%', height: '70%' },
  selo: {
    alignSelf: 'flex-start',
    paddingHorizontal: espaco.s,
    paddingVertical: 3,
    borderRadius: raio.pequeno,
  },
  esqueleto: { backgroundColor: cores.superficieAlta, borderRadius: raio.grande },
  estado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaco.xl,
    gap: espaco.m,
  },
  estadoIcone: {
    width: 72,
    height: 72,
    borderRadius: raio.total,
    backgroundColor: cores.marcaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: { textAlign: 'center' },
});
