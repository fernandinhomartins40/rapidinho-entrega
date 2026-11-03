import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Toque } from '@/componentes/base';
import { cores, degradeDaMarca, degradeDaNoite, espaco, raio, toqueMinimo } from '@/tema/tokens';

const LETREIRO = require('@/assets/marca/letreiro.png');

/** Faixas de luz laranja no canto: o brilho que acompanha a marca no topo. */
function Brilho() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['rgba(255,138,31,0)', 'rgba(255,110,31,0.85)', 'rgba(255,168,40,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[estilos.faixa, { top: -40, right: -90, width: 260, height: 70 }]}
      />
      <LinearGradient
        colors={['rgba(255,138,31,0)', 'rgba(255,90,31,0.55)', 'rgba(255,168,40,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[estilos.faixa, { top: 30, right: -120, width: 300, height: 34 }]}
      />
    </View>
  );
}

/**
 * Topo azul-noite com brilho laranja, usado em toda tela principal. Leva o
 * letreiro quando é tela de entrada; título e ícone nas demais.
 */
export function TopoEscuro({
  titulo,
  subtitulo,
  Icone,
  voltar,
  letreiro,
  direita,
  children,
  estilo,
}: {
  titulo?: string;
  subtitulo?: string;
  Icone?: LucideIcon;
  voltar?: boolean;
  letreiro?: boolean;
  direita?: ReactNode;
  children?: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  const topo = useSafeAreaInsets().top;

  return (
    <LinearGradient
      colors={degradeDaNoite}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[estilos.topo, { paddingTop: topo + espaco.s }, estilo]}
    >
      <Brilho />
      {letreiro || voltar || direita ? (
        <View style={estilos.barra}>
          {voltar ? (
            <Toque
              accessibilityLabel="Voltar"
              onPress={() => router.back()}
              style={estilos.botaoRedondo}
            >
              <ArrowLeft size={22} color={cores.textoNaNoite} />
            </Toque>
          ) : (
            <View style={estilos.vazio} />
          )}
          {letreiro ? (
            <Image
              source={LETREIRO}
              style={estilos.letreiro}
              contentFit="contain"
              accessibilityLabel="Rapidinho Entrega"
            />
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={estilos.direita}>{direita}</View>
        </View>
      ) : null}
      {titulo ? (
        <View style={estilos.titulo}>
          {Icone ? (
            <LinearGradient colors={degradeDaMarca} style={estilos.icone}>
              <Icone size={26} color={cores.textoNaCor} strokeWidth={2.2} />
            </LinearGradient>
          ) : null}
          <View style={{ flex: 1 }}>
            <T v="titulo1" cor={cores.textoNaNoite} numberOfLines={2}>
              {titulo}
            </T>
            {subtitulo ? (
              <T v="legenda" cor={cores.textoNaNoiteFraco}>
                {subtitulo}
              </T>
            ) : null}
          </View>
        </View>
      ) : null}
      {children}
    </LinearGradient>
  );
}

export function BotaoNoTopo({
  Icone,
  rotulo,
  aoTocar,
  aviso,
}: {
  Icone: LucideIcon;
  rotulo: string;
  aoTocar: () => void;
  aviso?: number;
}) {
  return (
    <Toque accessibilityLabel={rotulo} onPress={aoTocar} style={estilos.botaoRedondo}>
      <Icone size={22} color={cores.textoNaNoite} />
      {aviso ? (
        <View style={estilos.aviso}>
          <T v="mini" cor={cores.textoNaCor}>
            {aviso > 9 ? '9+' : aviso}
          </T>
        </View>
      ) : null}
    </Toque>
  );
}

/** Filtros em pílula: o escolhido fica laranja, os outros brancos. */
export function Pilulas<C extends string>({
  opcoes,
  valor,
  aoMudar,
}: {
  opcoes: { chave: C; rotulo: string }[];
  valor: C;
  aoMudar: (c: C) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.pilulas}
    >
      {opcoes.map((o) => {
        const ligada = o.chave === valor;
        return (
          <Toque
            key={o.chave}
            accessibilityRole="tab"
            accessibilityState={{ selected: ligada }}
            accessibilityLabel={o.rotulo}
            onPress={() => aoMudar(o.chave)}
          >
            {ligada ? (
              <LinearGradient
                colors={degradeDaMarca}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={estilos.pilula}
              >
                <T v="corpoForte" cor={cores.textoNaCor}>
                  {o.rotulo}
                </T>
              </LinearGradient>
            ) : (
              <View style={[estilos.pilula, estilos.pilulaApagada]}>
                <T v="corpoForte" cor={cores.texto}>
                  {o.rotulo}
                </T>
              </View>
            )}
          </Toque>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  topo: {
    paddingHorizontal: espaco.l,
    paddingBottom: espaco.xl,
    gap: espaco.m,
    borderBottomLeftRadius: raio.folha + 8,
    borderBottomRightRadius: raio.folha + 8,
    overflow: 'hidden',
  },
  faixa: { position: 'absolute', borderRadius: raio.total, transform: [{ rotate: '-28deg' }] },
  barra: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  vazio: { width: toqueMinimo },
  direita: { minWidth: toqueMinimo, alignItems: 'flex-end' },
  letreiro: { flex: 1, height: 52 },
  botaoRedondo: {
    width: toqueMinimo,
    height: toqueMinimo,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  aviso: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: raio.total,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  icone: {
    width: 52,
    height: 52,
    borderRadius: raio.grande,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilulas: { gap: espaco.s, paddingRight: espaco.l },
  pilula: {
    minHeight: 40,
    paddingHorizontal: espaco.l,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilulaApagada: { backgroundColor: cores.superficie },
});
