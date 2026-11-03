import { router, Stack } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { useCidade } from '@/api/cidade';
import { EstadoDaTela, Esqueleto, T } from '@/componentes/base';
import { Opcao } from '@/componentes/formulario';
import { cores, espaco } from '@/tema/tokens';

export default function Cidades() {
  const { cidade, cidades, escolher } = useCidade();

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.corpo}>
      <Stack.Screen options={{ title: 'Onde você está?', presentation: 'modal' }} />
      <T cor={cores.textoMedio}>O Rapidinho mostra só as lojas que entregam na sua cidade.</T>
      {cidades.length === 0 && !cidade ? (
        [0, 1].map((i) => <Esqueleto key={i} estilo={{ height: 56 }} />)
      ) : cidades.length === 0 ? (
        <EstadoDaTela Icone={MapPin} titulo="Ainda não chegamos na sua cidade" />
      ) : (
        cidades.map((c) => (
          <Opcao
            key={c.id}
            titulo={`${c.nome}/${c.uf}`}
            marcada={c.slug === cidade}
            aoTocar={() => {
              escolher(c.slug);
              router.back();
            }}
          />
        ))
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.m },
});
