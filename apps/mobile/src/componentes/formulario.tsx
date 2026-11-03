import * as Haptics from 'expo-haptics';
import { Check, Minus, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { T, Toque } from '@/componentes/base';
import { cores, elevacao, espaco, fontes, raio, toqueMinimo } from '@/tema/tokens';

/** Bloco branco com sombra leve: a unidade de toda tela de detalhe. */
export function Cartao({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return <View style={[estilos.cartao, estilo]}>{children}</View>;
}

export function Campo({
  rotulo,
  dica,
  erro,
  ...resto
}: TextInputProps & { rotulo: string; dica?: string; erro?: string | null }) {
  return (
    <View style={estilos.campo}>
      <T v="legenda" cor={cores.textoMedio}>
        {rotulo}
      </T>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.textoFraco}
        style={[estilos.entrada, erro ? estilos.entradaComErro : null]}
        {...resto}
      />
      {erro ? (
        <T v="legenda" cor={cores.perigo}>
          {erro}
        </T>
      ) : dica ? (
        <T v="legenda" cor={cores.textoFraco}>
          {dica}
        </T>
      ) : null}
    </View>
  );
}

/** Botões de menos e mais com o número no meio; zero some com o item. */
export function Contador({
  valor,
  aoMudar,
  minimo = 0,
  maximo = 99,
  rotulo = 'Quantidade',
}: {
  valor: number;
  aoMudar: (novo: number) => void;
  minimo?: number;
  maximo?: number;
  rotulo?: string;
}) {
  const mudar = (novo: number) => {
    if (novo < minimo || novo > maximo) return;
    void Haptics.selectionAsync();
    aoMudar(novo);
  };

  return (
    <View style={estilos.contador} accessibilityLabel={`${rotulo}: ${valor}`}>
      <Toque
        accessibilityLabel="Diminuir"
        disabled={valor <= minimo}
        onPress={() => mudar(valor - 1)}
        style={[estilos.botaoDoContador, valor <= minimo && estilos.apagado]}
      >
        <Minus size={18} color={cores.marcaEscura} />
      </Toque>
      <T v="corpoForte" style={estilos.numero}>
        {valor}
      </T>
      <Toque
        accessibilityLabel="Aumentar"
        disabled={valor >= maximo}
        onPress={() => mudar(valor + 1)}
        style={[estilos.botaoDoContador, valor >= maximo && estilos.apagado]}
      >
        <Plus size={18} color={cores.marcaEscura} />
      </Toque>
    </View>
  );
}

/** Linha de escolha: bolinha para opção única, quadrado para várias. */
export function Opcao({
  titulo,
  descricao,
  direita,
  marcada,
  multipla,
  desativada,
  aoTocar,
}: {
  titulo: string;
  descricao?: string | null;
  direita?: string;
  marcada: boolean;
  multipla?: boolean;
  desativada?: boolean;
  aoTocar: () => void;
}) {
  return (
    <Toque
      accessibilityRole={multipla ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: marcada, disabled: desativada }}
      accessibilityLabel={titulo}
      disabled={desativada}
      encolhe={0.99}
      onPress={() => {
        void Haptics.selectionAsync();
        aoTocar();
      }}
      style={[estilos.opcao, marcada && estilos.opcaoMarcada, desativada && estilos.apagado]}
    >
      <View
        style={[
          estilos.marcador,
          multipla ? estilos.quadrado : estilos.bolinha,
          marcada && estilos.marcadorLigado,
        ]}
      >
        {marcada ? <Check size={14} color={cores.textoNaCor} strokeWidth={3} /> : null}
      </View>
      <View style={estilos.opcaoTexto}>
        <T v="corpoForte">{titulo}</T>
        {descricao ? (
          <T v="legenda" cor={cores.textoMedio}>
            {descricao}
          </T>
        ) : null}
      </View>
      {direita ? (
        <T v="corpoForte" cor={cores.textoMedio}>
          {direita}
        </T>
      ) : null}
    </Toque>
  );
}

export function Linha({
  rotulo,
  valor,
  forte,
}: {
  rotulo: string;
  valor: string;
  forte?: boolean;
}) {
  return (
    <View style={estilos.linha}>
      <T v={forte ? 'titulo3' : 'corpo'} cor={forte ? cores.texto : cores.textoMedio}>
        {rotulo}
      </T>
      <T v={forte ? 'titulo3' : 'corpoForte'}>{valor}</T>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.grande,
    padding: espaco.l,
    gap: espaco.m,
    ...elevacao.baixa,
  },
  campo: { gap: espaco.xs },
  entrada: {
    minHeight: toqueMinimo + 4,
    borderRadius: raio.medio,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
    paddingHorizontal: espaco.l,
    fontFamily: fontes.corpo,
    fontSize: 16,
    color: cores.texto,
  },
  entradaComErro: { borderColor: cores.perigo },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.marcaClara,
    borderRadius: raio.total,
  },
  botaoDoContador: {
    width: toqueMinimo,
    height: toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: { minWidth: 28, textAlign: 'center' },
  apagado: { opacity: 0.4 },
  opcao: {
    minHeight: toqueMinimo + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.s,
    borderRadius: raio.medio,
    borderWidth: 1.5,
    borderColor: cores.linha,
    backgroundColor: cores.superficie,
  },
  opcaoMarcada: { borderColor: cores.marca, backgroundColor: cores.marcaClara },
  marcador: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: cores.textoFraco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bolinha: { borderRadius: raio.total },
  quadrado: { borderRadius: 6 },
  marcadorLigado: { backgroundColor: cores.marca, borderColor: cores.marca },
  opcaoTexto: { flex: 1, gap: 2 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
