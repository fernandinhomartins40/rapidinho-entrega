import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, Toque } from '@/componentes/base';
import { cores, elevacao, espaco, raio, toqueMinimo } from '@/tema/tokens';

/**
 * Topo branco das telas, com cantos arredondados embaixo. A cor fica nos
 * detalhes (ícone, botões), para a tela respirar.
 */
export function TopoDaTela({
  titulo,
  subtitulo,
  Icone,
  voltar,
  direita,
  children,
  estilo,
}: {
  titulo?: string;
  subtitulo?: string;
  Icone?: LucideIcon;
  voltar?: boolean;
  direita?: ReactNode;
  children?: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  const topo = useSafeAreaInsets().top;

  return (
    <View style={[estilos.topo, elevacao.baixa, { paddingTop: topo + espaco.s }, estilo]}>
      {voltar || direita ? (
        <View style={estilos.barra}>
          {voltar ? (
            <Toque
              accessibilityLabel="Voltar"
              onPress={() => router.back()}
              style={estilos.botaoRedondo}
            >
              <ArrowLeft size={24} color={cores.marca} />
            </Toque>
          ) : (
            <View style={estilos.vazio} />
          )}
          <View style={{ flex: 1 }} />
          <View style={estilos.direita}>{direita}</View>
        </View>
      ) : null}
      {titulo ? (
        <View style={estilos.titulo}>
          {Icone ? (
            <View style={estilos.icone}>
              <Icone size={24} color={cores.marca} strokeWidth={2.2} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <T v="titulo1" numberOfLines={2}>
              {titulo}
            </T>
            {subtitulo ? (
              <T v="legenda" cor={cores.textoMedio}>
                {subtitulo}
              </T>
            ) : null}
          </View>
        </View>
      ) : null}
      {children}
    </View>
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
      <Icone size={24} color={cores.marca} />
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

/** Filtros em pílula: a escolhida ganha moldura e fundo laranja-claro. */
export function Pilulas<C extends string>({
  opcoes,
  valor,
  aoMudar,
}: {
  opcoes: { chave: C; rotulo: string; Icone?: LucideIcon; cor?: string }[];
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
            style={[estilos.pilula, ligada && estilos.pilulaLigada]}
          >
            {o.Icone ? <o.Icone size={20} color={o.cor ?? cores.marca} strokeWidth={2.2} /> : null}
            <T v="corpoForte" cor={ligada ? cores.marcaEscura : cores.texto}>
              {o.rotulo}
            </T>
          </Toque>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  topo: {
    backgroundColor: cores.superficie,
    paddingHorizontal: espaco.l,
    paddingBottom: espaco.l,
    gap: espaco.m,
    borderBottomLeftRadius: raio.folha,
    borderBottomRightRadius: raio.folha,
    zIndex: 1,
  },
  barra: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  vazio: { width: toqueMinimo },
  direita: { minWidth: toqueMinimo, alignItems: 'flex-end' },
  botaoRedondo: {
    width: toqueMinimo,
    height: toqueMinimo,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 48,
    height: 48,
    borderRadius: raio.grande,
    backgroundColor: cores.marcaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pilulas: { gap: espaco.s, paddingRight: espaco.l },
  pilula: {
    minHeight: 44,
    paddingHorizontal: espaco.l,
    borderRadius: raio.medio,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
  },
  pilulaLigada: { borderColor: cores.marca, backgroundColor: cores.marcaClara },
});
