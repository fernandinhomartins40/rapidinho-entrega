import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import type { Segmento } from '@contrato';
import { useSessao } from '@/api/sessao';
import { cores, espaco, raio } from '@/tema/tokens';
import { Botao, T } from './base';
import { Opcao } from './formulario';

/** Mercado e farmácia vendem produto fechado: lá não há cebola para tirar. */
export function useItensParaPerguntar(segmento: Segmento | undefined): string[] {
  const { usuario } = useSessao();
  return segmento === 'RESTAURANT' ? (usuario?.itensQueOdeio ?? []) : [];
}

/** "Sem cebola, alho" vem primeiro: o limite de 200 letras não pode cortar o pedido. */
export function observacaoComRetirada(retirar: string[], observacao = ''): string | undefined {
  const sem = retirar.length ? `Sem ${retirar.join(', ').toLowerCase()}` : '';
  return [sem, observacao.trim()].filter(Boolean).join('. ').slice(0, 200) || undefined;
}

/** Quem marcou o que odeia responde antes de cada item entrar na sacola. */
export function usePerguntaDoQueOdeio(segmento: Segmento | undefined) {
  const itens = useItensParaPerguntar(segmento);
  const [seguir, setSeguir] = useState<((retirar: string[]) => void) | null>(null);

  return {
    perguntar: (acao: (retirar: string[]) => void) => {
      if (itens.length) setSeguir(() => acao);
      else acao([]);
    },
    pergunta: seguir ? (
      <Pergunta
        itens={itens}
        aoFechar={() => setSeguir(null)}
        aoResponder={(retirar) => {
          setSeguir(null);
          seguir(retirar);
        }}
      />
    ) : null,
  };
}

function Pergunta({
  itens,
  aoFechar,
  aoResponder,
}: {
  itens: string[];
  aoFechar: () => void;
  aoResponder: (retirar: string[]) => void;
}) {
  const [marcados, setMarcados] = useState(itens);

  return (
    <Modal transparent animationType="slide" statusBarTranslucent onRequestClose={aoFechar}>
      <View style={estilos.fundo}>
        <View style={estilos.folha}>
          <T v="titulo2">Tirar o que você odeia?</T>
          <T cor={cores.textoMedio}>Marque o que a loja deve tirar deste item.</T>
          <ScrollView style={estilos.lista} contentContainerStyle={estilos.listaConteudo}>
            {itens.map((item) => {
              const marcado = marcados.includes(item);
              return (
                <Opcao
                  key={item}
                  multipla
                  titulo={item}
                  marcada={marcado}
                  aoTocar={() =>
                    setMarcados((atuais) =>
                      marcado ? atuais.filter((x) => x !== item) : [...atuais, item],
                    )
                  }
                />
              );
            })}
          </ScrollView>
          <T v="legenda" cor={cores.textoMedio}>
            Vai como pedido para a loja. Se for alergia, fale também com ela.
          </T>
          <Botao
            titulo="Sim, tirar os marcados"
            desativado={marcados.length === 0}
            aoTocar={() => aoResponder(marcados)}
          />
          <Botao
            titulo="Não, pode deixar como está"
            variante="secundario"
            aoTocar={() => aoResponder([])}
          />
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,20,12,0.5)' },
  folha: {
    backgroundColor: cores.superficie,
    borderTopLeftRadius: raio.folha,
    borderTopRightRadius: raio.folha,
    padding: espaco.xl,
    gap: espaco.m,
  },
  lista: { maxHeight: 280 },
  listaConteudo: { gap: espaco.s },
});
