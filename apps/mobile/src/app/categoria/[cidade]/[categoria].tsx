import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Search, Store } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import type { Vitrine } from '@contrato';
import { chamar, ErroDaApi } from '@/api/cliente';
import { Botao, EstadoDaTela, ErroDaTela, Esqueleto } from '@/componentes/base';
import { BotaoNoTopo, Pilulas, TopoEscuro } from '@/componentes/topo';
import { CartaoDeLoja } from '@/componentes/vitrine';
import { chaveDaCategoria, iconeDaCategoria } from '@/tema/categorias';
import { cores, espaco, raio } from '@/tema/tokens';

/**
 * A vitrine já traz todas as lojas da cidade: a categoria é um recorte dela, e
 * as outras categorias do mesmo segmento viram filtros no topo.
 */
export default function Categoria() {
  const { cidade, categoria } = useLocalSearchParams<{ cidade: string; categoria: string }>();
  const [filtro, setFiltro] = useState(categoria);

  const vitrine = useQuery({
    queryKey: ['vitrine', cidade],
    queryFn: () => chamar<Vitrine>(`cidades/${cidade}/vitrine`),
  });

  const info = vitrine.data?.categorias.find((c) => c.slug === categoria);
  const chave = chaveDaCategoria(categoria, info?.segmento);
  const irmas = (vitrine.data?.categorias ?? []).filter((c) => c.segmento === info?.segmento);
  const lojas = (vitrine.data?.lojas ?? [])
    .filter((l) =>
      filtro === '*' ? irmas.some((c) => c.slug === l.categoriaSlug) : l.categoriaSlug === filtro,
    )
    .sort((a, b) => Number(b.aberta) - Number(a.aberta));

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopoEscuro
        voltar
        titulo={info?.nome ?? 'Categoria'}
        subtitulo="Confira as lojas abertas e peça agora."
        Icone={iconeDaCategoria(chave)}
        direita={
          <BotaoNoTopo Icone={Search} rotulo="Buscar" aoTocar={() => router.push('/busca')} />
        }
      >
        {irmas.length > 1 ? (
          <Pilulas
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { chave: '*', rotulo: 'Todos' },
              ...irmas.map((c) => ({ chave: c.slug, rotulo: c.nome })),
            ]}
          />
        ) : null}
      </TopoEscuro>

      {vitrine.isError ? (
        <ErroDaTela
          mensagem={vitrine.error instanceof ErroDaApi ? vitrine.error.message : 'Tente de novo.'}
          aoTentar={() => void vitrine.refetch()}
        />
      ) : !vitrine.data ? (
        <View style={estilos.lista}>
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} estilo={{ height: 136, borderRadius: raio.folha }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={lojas}
          keyExtractor={(l) => l.id}
          contentContainerStyle={[estilos.lista, lojas.length === 0 && { flexGrow: 1 }]}
          ListEmptyComponent={
            <EstadoDaTela
              Icone={Store}
              titulo="Nenhuma loja aqui ainda"
              descricao="Novas lojas entram toda semana. Veja as outras categorias."
              acao={
                <Botao
                  titulo="Voltar ao início"
                  variante="secundario"
                  aoTocar={() => router.back()}
                />
              }
            />
          }
          renderItem={({ item }) => <CartaoDeLoja loja={item} cidade={cidade} />}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { paddingVertical: espaco.l, paddingBottom: espaco.xxl, gap: espaco.m },
});
