import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, Stack } from 'expo-router';
import { LocateFixed } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import type { Endereco, EntradaEndereco } from '@contrato';
import { avisarErro } from '@/api/carrinho';
import { useCidade } from '@/api/cidade';
import { chamar } from '@/api/cliente';
import { Botao, T } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { Campo } from '@/componentes/formulario';
import { cores, espaco } from '@/tema/tokens';

export default function NovoEndereco() {
  const folga = useFolgaInferior(espaco.xxl);
  const consultas = useQueryClient();
  const { cidade, cidades } = useCidade();
  const cidadeAtual = cidades.find((c) => c.slug === cidade);

  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [referencia, setReferencia] = useState('');
  const [rotulo, setRotulo] = useState('');
  const [posicao, setPosicao] = useState<{ latitude: number; longitude: number } | null>(null);
  const [localizando, setLocalizando] = useState(false);

  const salvar = useMutation({
    mutationFn: (entrada: EntradaEndereco) =>
      chamar<Endereco>('enderecos', { metodo: 'POST', corpo: entrada }),
    onSuccess: () => {
      void consultas.invalidateQueries({ queryKey: ['enderecos'] });
      void consultas.invalidateQueries({ queryKey: ['resumo'] });
      router.back();
    },
    onError: avisarErro,
  });

  // Preenche rua e bairro pelo GPS; a pessoa confere e completa.
  const usarLocalizacao = async () => {
    setLocalizando(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      const atual = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = atual.coords;
      setPosicao({ latitude, longitude });
      const [achado] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (achado) {
        if (achado.street) setRua(achado.street);
        if (achado.streetNumber) setNumero(achado.streetNumber);
        if (achado.district) setBairro(achado.district);
      }
    } catch {
      // Sem GPS a pessoa digita: não é erro que precise de aviso.
    } finally {
      setLocalizando(false);
    }
  };

  const completo = rua.trim() && bairro.trim() && referencia.trim() && cidadeAtual;

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Novo endereço' }} />
      <ScrollView
        contentContainerStyle={[estilos.corpo, { paddingBottom: folga }]}
        keyboardShouldPersistTaps="handled"
      >
        <Botao
          titulo="Usar minha localização"
          variante="secundario"
          Icone={LocateFixed}
          carregando={localizando}
          aoTocar={() => void usarLocalizacao()}
        />
        <Campo rotulo="Rua" value={rua} onChangeText={setRua} placeholder="Ex.: Rua das Flores" />
        <Campo
          rotulo="Número"
          value={numero}
          onChangeText={setNumero}
          placeholder="Sem número? Deixe em branco"
          keyboardType="numbers-and-punctuation"
        />
        <Campo rotulo="Bairro" value={bairro} onChangeText={setBairro} />
        <Campo
          rotulo="Complemento"
          value={complemento}
          onChangeText={setComplemento}
          placeholder="Apto, bloco, fundos"
        />
        <Campo
          rotulo="Ponto de referência"
          value={referencia}
          onChangeText={setReferencia}
          placeholder="Ex.: casa azul ao lado da padaria"
          dica="Ajuda o entregador a achar sua casa"
        />
        <Campo
          rotulo="Nome do endereço (opcional)"
          value={rotulo}
          onChangeText={setRotulo}
          placeholder="Casa, trabalho"
        />
        {cidadeAtual ? (
          <T v="legenda" cor={cores.textoMedio}>
            Cidade: {cidadeAtual.nome}/{cidadeAtual.uf}
          </T>
        ) : null}
        <Botao
          titulo="Salvar endereço"
          desativado={!completo}
          carregando={salvar.isPending}
          aoTocar={() =>
            salvar.mutate({
              rua: rua.trim(),
              numero: numero.trim() || undefined,
              complemento: complemento.trim() || undefined,
              bairro: bairro.trim(),
              referencia: referencia.trim(),
              rotulo: rotulo.trim() || undefined,
              cidadeId: cidadeAtual!.id,
              latitude: posicao?.latitude,
              longitude: posicao?.longitude,
            })
          }
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.l, paddingBottom: espaco.xxl },
});
