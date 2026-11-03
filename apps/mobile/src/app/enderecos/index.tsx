import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { MapPin, MapPinPlus, Trash2 } from 'lucide-react-native';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import type { RespostaEnderecos } from '@contrato';
import { avisarErro } from '@/api/carrinho';
import { chamar } from '@/api/cliente';
import { Botao, EstadoDaTela, Esqueleto, Selo, T, Toque } from '@/componentes/base';
import { Cartao } from '@/componentes/formulario';
import { cores, espaco, toqueMinimo } from '@/tema/tokens';

export default function Enderecos() {
  const consultas = useQueryClient();
  const enderecos = useQuery({
    queryKey: ['enderecos'],
    queryFn: () => chamar<RespostaEnderecos>('enderecos'),
  });

  const apagar = useMutation({
    mutationFn: (id: string) => chamar(`enderecos/${id}`, { metodo: 'DELETE' }),
    onSuccess: () => void consultas.invalidateQueries({ queryKey: ['enderecos'] }),
    onError: avisarErro,
  });

  const padrao = useMutation({
    mutationFn: (id: string) => chamar(`enderecos/${id}/padrao`, { metodo: 'POST' }),
    onSuccess: () => void consultas.invalidateQueries({ queryKey: ['enderecos'] }),
    onError: avisarErro,
  });

  const lista = enderecos.data?.enderecos ?? [];

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.corpo}>
      <Stack.Screen options={{ title: 'Meus endereços' }} />
      {!enderecos.data ? (
        <Esqueleto estilo={{ height: 96 }} />
      ) : lista.length === 0 ? (
        <EstadoDaTela
          Icone={MapPin}
          titulo="Nenhum endereço salvo"
          descricao="Cadastre onde você quer receber os pedidos."
        />
      ) : (
        lista.map((e) => (
          <Cartao key={e.id}>
            <View style={estilos.linha}>
              <View style={{ flex: 1, gap: 2 }}>
                {e.rotulo ? (
                  <T v="mini" cor={cores.marcaEscura}>
                    {e.rotulo.toUpperCase()}
                  </T>
                ) : null}
                <T v="corpoForte">
                  {e.rua}
                  {e.numero ? `, ${e.numero}` : ''}
                </T>
                <T v="legenda" cor={cores.textoMedio}>
                  {[e.bairro, e.complemento, e.referencia].filter(Boolean).join(' · ')}
                </T>
                {e.padrao ? (
                  <Selo texto="Principal" cor={cores.sucesso} fundo={cores.sucessoClaro} />
                ) : null}
              </View>
              <Toque
                accessibilityLabel="Apagar endereço"
                onPress={() =>
                  Alert.alert('Apagar este endereço?', undefined, [
                    { text: 'Voltar', style: 'cancel' },
                    { text: 'Apagar', style: 'destructive', onPress: () => apagar.mutate(e.id) },
                  ])
                }
                style={estilos.apagar}
              >
                <Trash2 size={20} color={cores.perigo} />
              </Toque>
            </View>
            {!e.padrao ? (
              <Botao
                titulo="Usar como principal"
                variante="discreto"
                aoTocar={() => padrao.mutate(e.id)}
              />
            ) : null}
          </Cartao>
        ))
      )}
      <Botao
        titulo="Novo endereço"
        Icone={MapPinPlus}
        aoTocar={() => router.push('/enderecos/novo')}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.l },
  linha: { flexDirection: 'row', gap: espaco.m },
  apagar: {
    width: toqueMinimo,
    height: toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
