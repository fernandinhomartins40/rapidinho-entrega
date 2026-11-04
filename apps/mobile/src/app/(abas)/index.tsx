import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  MapPin,
  Pill,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConfiguracaoDoApp, Segmento, Vitrine } from '@contrato';
import { useCidade } from '@/api/cidade';
import { chamar, ErroDaApi } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Esqueleto, ErroDaTela, T, Toque } from '@/componentes/base';
import { ALTURA_DA_BARRA, useFolgaInferior } from '@/componentes/folga';
import { Pilulas } from '@/componentes/topo';
import {
  CarrosselDeCampanhas,
  CartaoDeAtalho,
  CartaoDeLoja,
  CartaoDeProduto,
  FaixaDeCategorias,
  LogoDeLoja,
  Secao,
  SecaoDeCampanha,
} from '@/componentes/vitrine';
import { cores, coresDaCategoria, elevacao, espaco, raio, toqueMinimo } from '@/tema/tokens';

type Aba = 'TUDO' | Segmento;

const ABAS: { chave: Aba; rotulo: string; Icone: LucideIcon; cor: string }[] = [
  { chave: 'TUDO', rotulo: 'tudo', Icone: LayoutGrid, cor: cores.marca },
  {
    chave: 'RESTAURANT',
    rotulo: 'restaurantes',
    Icone: UtensilsCrossed,
    cor: coresDaCategoria.comida.cor,
  },
  { chave: 'MARKET', rotulo: 'mercados', Icone: ShoppingBasket, cor: coresDaCategoria.mercado.cor },
  { chave: 'PHARMACY', rotulo: 'farmácias', Icone: Pill, cor: coresDaCategoria.farmacia.cor },
  { chave: 'OTHER', rotulo: 'outros', Icone: Store, cor: coresDaCategoria.pet.cor },
];

/** Quantas lojas entram na faixa de logos do alto. */
const LOJAS_EM_ALTA = 10;

export default function Inicio() {
  const { cidade } = useCidade();
  const { usuario } = useSessao();
  const baixo = useSafeAreaInsets().bottom;
  const topo = useSafeAreaInsets().top;
  // Sem login, o chamado "entre ou cadastre-se" flutua acima da barra.
  const folga = useFolgaInferior(usuario ? 110 : 180);
  const primeiroNome = usuario?.nome?.trim().split(' ')[0];
  const [aba, setAba] = useState<Aba>('TUDO');

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

  // A aba só aparece se a cidade tem loja daquele tipo.
  const abas = useMemo(() => {
    if (!dados) return ABAS.slice(0, 1);
    const presentes = new Set(dados.lojas.map((loja) => loja.segmento));
    const lista = ABAS.filter((a) => a.chave === 'TUDO' || presentes.has(a.chave as Segmento));
    return lista.length > 2 ? lista : ABAS.slice(0, 1);
  }, [dados]);

  const filtrado = useMemo(() => {
    if (!dados) return null;
    const naAba = <T extends { segmento: Segmento | null }>(itens: T[]) =>
      aba === 'TUDO' ? itens : itens.filter((i) => i.segmento === aba || i.segmento === null);
    const lojas = naAba(dados.lojas);
    const emAlta = [...lojas]
      .filter((loja) => loja.aberta)
      .sort((a, b) => Number(b.patrocinada) - Number(a.patrocinada) || b.avaliacoes - a.avaliacoes)
      .slice(0, LOJAS_EM_ALTA);
    return {
      categorias: naAba(dados.categorias),
      saindoAgora: naAba(dados.saindoAgora),
      secoes: naAba(dados.secoes ?? []),
      lojas,
      emAlta,
    };
  }, [dados, aba]);

  const cabecalho = (
    <View style={[estilos.topo, elevacao.baixa, { paddingTop: topo + espaco.s }]}>
      <Toque
        accessibilityLabel="Trocar cidade"
        onPress={() => router.push('/cidades')}
        style={estilos.cidade}
      >
        <MapPin size={26} color={cores.marca} />
        <View style={{ flex: 1 }}>
          <View style={estilos.cidadeNome}>
            <T v="titulo3" cor={cores.marca} numberOfLines={1}>
              {dados ? `${dados.cidade.nome} - ${dados.cidade.uf}` : 'Escolha a cidade'}
            </T>
            <ChevronRight size={20} color={cores.marca} />
          </View>
          <T v="legenda" cor={cores.textoMedio}>
            {primeiroNome ? `Olá, ${primeiroNome}! O que vai ser hoje?` : 'entre ou cadastre-se'}
          </T>
        </View>
      </Toque>
      {abas.length > 1 ? <Pilulas<Aba> opcoes={abas} valor={aba} aoMudar={setAba} /> : null}
    </View>
  );

  return (
    <View style={estilos.tela}>
      <ScrollView
        style={estilos.tela}
        contentContainerStyle={[estilos.conteudo, { paddingBottom: folga }]}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={vitrine.isRefetching}
            onRefresh={() => void vitrine.refetch()}
            colors={[cores.marca]}
            progressViewOffset={topo + 100}
          />
        }
      >
        {cabecalho}

        {vitrine.isError ? (
          <ErroDaTela
            mensagem={
              vitrine.error instanceof ErroDaApi
                ? vitrine.error.message
                : 'Tente de novo em instantes.'
            }
            aoTentar={() => void vitrine.refetch()}
          />
        ) : !dados || !filtrado ? (
          <EsqueletoDaHome />
        ) : (
          <View style={estilos.corpo}>
            <CarrosselDeCampanhas
              banners={dados.banners}
              cidade={dados.cidade.slug}
              nomeDaCidade={dados.cidade.nome}
            />

            {filtrado.categorias.length > 0 ? (
              <FaixaDeCategorias categorias={filtrado.categorias} cidade={dados.cidade.slug} />
            ) : null}

            {filtrado.emAlta.length >= 3 ? (
              <Secao titulo="lojas em alta por aqui" subtitulo="as mais pedidas da cidade">
                <FlatList
                  data={filtrado.emAlta}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(loja) => loja.id}
                  contentContainerStyle={estilos.listaHorizontal}
                  renderItem={({ item }) => <LogoDeLoja loja={item} cidade={dados.cidade.slug} />}
                />
              </Secao>
            ) : null}

            {filtrado.secoes.map((secao) => (
              <SecaoDeCampanha key={secao.id} secao={secao} cidade={dados.cidade.slug} />
            ))}

            {filtrado.saindoAgora.length > 0 ? (
              <Secao titulo="saindo agora" subtitulo="o que a cidade está pedindo nesta hora" fundo>
                <FlatList
                  data={filtrado.saindoAgora}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(produto) => produto.id}
                  contentContainerStyle={{ gap: espaco.m }}
                  renderItem={({ item }) => (
                    <CartaoDeProduto produto={item} cidade={dados.cidade.slug} />
                  )}
                />
              </Secao>
            ) : null}

            {configuracao.data?.recursos.pedidoPorLista !== false ? (
              <CartaoDeAtalho
                Icone={ClipboardList}
                titulo="Pedir por lista"
                texto="Mande a lista. A gente monta o pedido nas lojas abertas."
                aoTocar={() => router.push('/lista')}
              />
            ) : null}

            <Secao titulo="todas as lojas" subtitulo={`${filtrado.lojas.length} na cidade`}>
              <View style={estilos.listaDeLojas}>
                {filtrado.lojas.map((loja, indice) => (
                  <View key={loja.id}>
                    {indice > 0 ? <View style={estilos.divisoria} /> : null}
                    <CartaoDeLoja loja={loja} cidade={dados.cidade.slug} agrupada />
                  </View>
                ))}
              </View>
            </Secao>
          </View>
        )}
      </ScrollView>

      {!usuario ? (
        <Toque
          accessibilityLabel="Entre ou cadastre-se"
          onPress={() => router.push('/entrar')}
          style={[estilos.chamado, elevacao.alta, { bottom: ALTURA_DA_BARRA + baixo + espaco.m }]}
        >
          <T v="titulo3" cor={cores.textoNaCor}>
            entre ou cadastre-se
          </T>
          <ChevronRight size={22} color={cores.textoNaCor} />
        </Toque>
      ) : null}
    </View>
  );
}

function EsqueletoDaHome() {
  return (
    <View style={estilos.esqueleto}>
      <Esqueleto estilo={{ height: 150, borderRadius: raio.folha }} />
      <View style={estilos.esqueletoLinha}>
        {[0, 1, 2, 3].map((item) => (
          <Esqueleto key={item} estilo={{ width: 64, height: 64, borderRadius: raio.total }} />
        ))}
      </View>
      <Esqueleto estilo={{ height: 200, borderRadius: raio.folha }} />
      <Esqueleto estilo={{ height: 120, borderRadius: raio.folha }} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1 },
  topo: {
    backgroundColor: cores.superficie,
    paddingHorizontal: espaco.l,
    paddingBottom: espaco.m,
    gap: espaco.m,
    borderBottomLeftRadius: raio.folha,
    borderBottomRightRadius: raio.folha,
  },
  cidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    minHeight: toqueMinimo + 8,
  },
  cidadeNome: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  corpo: { gap: espaco.xl, paddingTop: espaco.l },
  listaHorizontal: { paddingHorizontal: espaco.l, gap: espaco.m },
  listaDeLojas: {
    marginHorizontal: espaco.l,
    borderRadius: raio.folha,
    overflow: 'hidden',
    backgroundColor: cores.superficie,
  },
  divisoria: { height: 1, marginLeft: 92, backgroundColor: cores.linha },
  chamado: {
    position: 'absolute',
    left: espaco.l,
    right: espaco.l,
    minHeight: toqueMinimo + 8,
    borderRadius: raio.total,
    backgroundColor: cores.marca,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.s,
  },
  esqueleto: { padding: espaco.l, gap: espaco.l },
  esqueletoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
});
