import * as Haptics from 'expo-haptics';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { Mic, Square } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { cores, elevacao } from '@/tema/tokens';
import { Toque } from './base';

export const TAMANHO_DO_MICROFONE = 64;
const TAMANHO = TAMANHO_DO_MICROFONE;

/**
 * Ditado pelo reconhecedor do próprio Android: o texto aparece enquanto a
 * pessoa fala, sem áudio passar pelo nosso servidor.
 *
 * `aoFalar` recebe cada trecho fechado; o trecho em andamento vem em
 * `aoParcial`, para a tela mostrar ao vivo.
 */
export function BotaoDeFalar({
  aoFalar,
  aoParcial,
}: {
  aoFalar: (trecho: string) => void;
  aoParcial: (trecho: string) => void;
}) {
  const [ouvindo, setOuvindo] = useState(false);
  const reduzido = useReducedMotion();
  const pulso = useSharedValue(1);

  useEffect(() => {
    pulso.value =
      ouvindo && !reduzido ? withRepeat(withTiming(1.18, { duration: 700 }), -1, true) : 1;
  }, [ouvindo, reduzido, pulso]);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }));

  useSpeechRecognitionEvent('start', () => setOuvindo(true));
  useSpeechRecognitionEvent('end', () => {
    setOuvindo(false);
    aoParcial('');
  });
  useSpeechRecognitionEvent('result', (evento) => {
    const trecho = evento.results[0]?.transcript.trim() ?? '';
    if (evento.isFinal) {
      aoParcial('');
      if (trecho) aoFalar(trecho);
    } else {
      aoParcial(trecho);
    }
  });
  useSpeechRecognitionEvent('error', (evento) => {
    setOuvindo(false);
    aoParcial('');
    // Silêncio e cancelamento não são erro para quem tocou no botão.
    if (
      evento.error === 'no-speech' ||
      evento.error === 'aborted' ||
      evento.error === 'speech-timeout'
    ) {
      return;
    }
    Alert.alert('Não deu para ouvir', 'Tente de novo, falando perto do celular.');
  });

  async function alternar() {
    if (ouvindo) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      Alert.alert(
        'Ditado indisponível',
        'Este celular não tem o reconhecimento de voz do Google ativo. Escreva a lista pelo teclado.',
      );
      return;
    }
    const permissao = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert(
        'Microfone bloqueado',
        'Para falar sua lista, libere o microfone do Rapidinho nas configurações do celular.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir configurações', onPress: () => void Linking.openSettings() },
        ],
      );
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ExpoSpeechRecognitionModule.start({
      lang: 'pt-BR',
      interimResults: true,
      // Lista falada tem pausas entre os itens: sem isso, a primeira pausa encerrava.
      continuous: true,
      addsPunctuation: false,
    });
  }

  return (
    <View style={estilos.envolve}>
      {ouvindo ? <Animated.View style={[estilos.halo, animado]} /> : null}
      <Toque
        accessibilityLabel={ouvindo ? 'Parar de ouvir' : 'Falar a lista'}
        accessibilityState={{ selected: ouvindo }}
        onPress={() => void alternar()}
        style={[estilos.botao, elevacao.alta, ouvindo && estilos.botaoOuvindo]}
      >
        {ouvindo ? (
          <Square size={24} color={cores.textoNaCor} fill={cores.textoNaCor} />
        ) : (
          <Mic size={28} color={cores.textoNaCor} />
        )}
      </Toque>
    </View>
  );
}

const estilos = StyleSheet.create({
  envolve: { alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    top: 0,
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    backgroundColor: cores.perigoClaro,
  },
  botao: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.marca,
    borderWidth: 4,
    borderColor: cores.superficie,
  },
  botaoOuvindo: { backgroundColor: cores.perigo },
});
