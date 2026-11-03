import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import type { RespostaAceiteDeTermos } from '@contrato';
import { chamar, URL_DA_API } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { avisarErro } from '@/api/carrinho';
import { Botao, T } from '@/componentes/base';
import { cores, espaco, raio } from '@/tema/tokens';

/** Versão nova dos termos publicada no painel: pede a ciência antes de seguir. */
export function AvisoDeTermos() {
  const { usuario, atualizar } = useSessao();
  const [enviando, setEnviando] = useState(false);
  if (!usuario?.termosPendentes) return null;

  const aceitar = async () => {
    setEnviando(true);
    try {
      await chamar<RespostaAceiteDeTermos>('eu/aceite-de-termos', { metodo: 'POST' });
      atualizar({ ...usuario, termosPendentes: false });
    } catch (erro) {
      avisarErro(erro);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal transparent animationType="slide" statusBarTranslucent>
      <View style={estilos.fundo}>
        <View style={estilos.folha}>
          <T v="titulo2">Atualizamos os termos</T>
          <T cor={cores.textoMedio}>
            Para continuar usando o Rapidinho, leia e aceite a versão nova dos termos de uso e da
            política de privacidade.
          </T>
          <Botao
            titulo="Ler os termos"
            variante="secundario"
            aoTocar={() => void WebBrowser.openBrowserAsync(`${URL_DA_API}/termos`)}
          />
          <Botao titulo="Li e aceito" carregando={enviando} aoTocar={() => void aceitar()} />
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
});
