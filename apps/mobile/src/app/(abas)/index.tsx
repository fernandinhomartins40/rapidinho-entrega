import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronDown, ClipboardList, MapPin, Search } from 'lucide-react-native';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { ConfiguracaoDoApp, Vitrine } from '@contrato';
import { useCidade } from '@/api/cidade';
import { chamar, ErroDaApi } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Esqueleto, ErroDaTela, T, Toque } from '@/componentes/base';
import { TopoEscuro } from '@/componentes/topo';
import {
  CarrosselDeCampanhas,
  CartaoDeAtalho,
  CartaoDeLoja,
  CartaoDeProduto,
  FaixaDeCategorias,
} from '@/componentes/vitrine';
import { cores, elevacao, espaco, raio, toqueMinimo } from '@/tema/tokens';

export default function Inicio() {
  const { cidade } = useCidade();
  const { usuario } = useSessao();
  const primeiroNome = usuario?.nome?.trim().split(' ')[0];

  const vitrine = useQuery({
    queryKey: ['vitrine', cidade],
    queryFn: () => chamar<Vitrine>(`cidades/${cidade}/vitrine`),
    enabled: !!cidade,
  });
  const configuracao = useQuery({
    queryKey: ['configuracao'],
    queryFn: () => chamar<ConfiguracaoDoApp>('configuracao'),
    staleTime: 10 * 60_000,
  });

  const dados = vitrine.data;

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={vitrine.isRefetching}
          onRefresh={() => void vitrine.refetch()}
          colors={[cores.marca]}
        />
      }
    >
      <TopoEscuro letreiro>
        <View style={estilos.linhaDoTopo}>
          <Toque
            accessibilityLabel="Trocar cidade"
            onPress={() => router.push('/cidades')}
            style={estilos.cidade}
          >
            <MapPin size={22} color={cores.amarelo} fill={cores.amarelo} />
            <View>
              <T v="mini" cor={cores.textoNaNoiteFraco}>
                Entregar em
              </T>
              <View style={estilos.cidadeNome}>
                <T v="corpoForte" cor={cores.textoNaNoite} numberOfLines={1}>
                  {dados ? `${dados.cidade.nome}/${dados.cidade.uf}` : 'Escolha'}
                </T>
                <ChevronDown size={16} color={cores.amarelo} />
              </View>
            </View>
          </Toque>
          <View style={{ flex: 1 }}>
            <T v="titulo2" cor={cores.textoNaNoite} numberOfLines={1}>
              {primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!'}
            </T>
            <T v="legenda" cor={cores.textoNaNoiteFraco}>
              O que você precisa hoje?
            </T>
          </View>
        </View>

        <Toque
          accessibilityRole="search"
          accessibilityLabel="Buscar restaurantes, lojas e produtos"
          encolhe={0.99}
          onPress={() => router.push('/busca')}
          style={[estilos.busca, elevacao.alta]}
        >
          <Search size={22} color={cores.texto} />
          <T cor={cores.textoMedio}>Busque restaurantes, lojas, produtos...</T>
        </Toque>
      </TopoEscuro>

      {vitrine.isError ? (
        <ErroDaTela
          mensagem={
            vitrine.error instanceof ErroDaApi
              ? vitrine.error.message
              : 'Tente de novo em instantes.'
          }
          aoTentar={() => void vitrine.refetch()}
        />
      ) : !dados ? (
        <EsqueletoDaHome />
      ) : (
        <>
          <FaixaDeCategorias categorias={dados.categorias} cidade={dados.cidade.slug} />

          <CarrosselDeCampanhas
            banners={dados.banners}
            cidade={dados.cidade.slug}
            nomeDaCidade={dados.cidade.nome}
          />

          {configuracao.data?.recursos.pedidoPorLista !== false ? (
            <CartaoDeAtalho
              escuro
              Icone={ClipboardList}
              titulo="Pedir por lista"
              texto="Mande a lista. A gente monta o pedido nas lojas abertas."
              acao="Escrever a lista"
              aoTocar={() => router.push('/lista')}
            />
          ) : null}

          {dados.saindoAgora.length > 0 ? (
            <View style={estilos.secao}>
              <T v="titulo2" style={estilos.tituloDaSecao}>
                Saindo agora
              </T>
              <FlatList
                data={dados.saindoAgora}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(produto) => produto.id}
                contentContainerStyle={estilos.listaHorizontal}
                renderItem={({ item }) => (
                  <CartaoDeProduto produto={item} cidade={dados.cidade.slug} />
                )}
              />
            </View>
          ) : null}

          <View style={estilos.secao}>
            <T v="titulo2" style={estilos.tituloDaSecao}>
              Lojas da sua cidade
            </T>
            {dados.lojas.map((loja) => (
              <CartaoDeLoja key={loja.id} loja={loja} cidade={dados.cidade.slug} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function EsqueletoDaHome() {
  return (
    <View style={estilos.esqueleto}>
      <View style={estilos.esqueletoLinha}>
        {[0, 1, 2, 3].map((item) => (
          <Esqueleto key={item} estilo={{ width: 72, height: 72, borderRadius: raio.folha }} />
        ))}
      </View>
      <Esqueleto estilo={{ height: 160, borderRadius: raio.folha }} />
      <Esqueleto estilo={{ height: 120, borderRadius: raio.folha }} />
      <Esqueleto estilo={{ height: 120, borderRadius: raio.folha }} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  // A barra de baixo flutua: o fim da lista não pode ficar escondido atrás dela.
  conteudo: { gap: espaco.xl, paddingBottom: 110 },
  linhaDoTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  cidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    minHeight: toqueMinimo + 8,
    paddingHorizontal: espaco.m,
    borderRadius: raio.grande,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    maxWidth: '52%',
  },
  cidadeNome: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  busca: {
    minHeight: toqueMinimo + 8,
    borderRadius: raio.total,
    backgroundColor: cores.superficie,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.l,
  },
  secao: { gap: espaco.m },
  tituloDaSecao: { paddingHorizontal: espaco.l },
  listaHorizontal: { paddingHorizontal: espaco.l, gap: espaco.m, paddingVertical: espaco.xs },
  esqueleto: { paddingHorizontal: espaco.l, gap: espaco.l },
  esqueletoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
});
