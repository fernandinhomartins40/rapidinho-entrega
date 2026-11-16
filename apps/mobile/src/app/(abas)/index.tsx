import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import type { LucideIcon } from 'lucide-react-native';
import {
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  ListChecks,
  MapPin,
  Pill,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  BannerDaVitrine,
  ConfiguracaoDoApp,
  LojaDaVitrine,
  Segmento,
  Vitrine,
} from '@contrato';
import { useCidade } from '@/api/cidade';
import { chamar, ErroDaApi } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Esqueleto, ErroDaTela, T, Toque } from '@/componentes/base';
import { ALTURA_DA_BARRA, useFolgaInferior } from '@/componentes/folga';
import { BotaoNoTopo, Pilulas } from '@/componentes/topo';
import { useCarrinho } from '@/api/carrinho';
import {
  CarrosselDeCampanhas,
  CartaoDeAtalho,
  CartaoDeLoja,
  CartaoDeLojaAberta,
  CartaoDeProduto,
  FaixaDeBanner,
  FaixaDeCategorias,
  Secao,
  SecaoDeCampanha,
} from '@/componentes/vitrine';
import { cores, elevacao, espaco, raio, toqueMinimo } from '@/tema/tokens';

const LETREIRO = require('@/assets/marca/letreiro.png');

type Aba = 'TUDO' | Segmento;

const ABAS: { chave: Aba; rotulo: string; Icone: LucideIcon }[] = [
  { chave: 'TUDO', rotulo: 'Tudo', Icone: LayoutGrid },
  { chave: 'RESTAURANT', rotulo: 'Restaurantes', Icone: UtensilsCrossed },
  { chave: 'MARKET', rotulo: 'Mercados', Icone: ShoppingBasket },
  { chave: 'PHARMACY', rotulo: 'Farmácias', Icone: Pill },
  { chave: 'OTHER', rotulo: 'Outros', Icone: Store },
];

/**
 * Banners da posição "Faixa no meio da home", entregues um a um na ordem em
 * que a tela os pede; o que sobrar sai junto antes de "todas as lojas".
 */
function distribuidorDeFaixas(faixas: BannerDaVitrine[], cidade: string) {
  let proxima = 0;
  const desenhar = (banner: BannerDaVitrine) => (
    <FaixaDeBanner key={banner.id} banner={banner} cidade={cidade} />
  );
  return {
    uma: () => {
      const banner = faixas[proxima];
      if (!banner) return null;
      proxima += 1;
      return desenhar(banner);
    },
    resto: () => faixas.slice(proxima).map(desenhar),
  };
}

export default function Inicio() {
  const { cidade } = useCidade();
  const { usuario } = useSessao();
  const baixo = useSafeAreaInsets().bottom;
  const topo = useSafeAreaInsets().top;
  // Sem login, o chamado "entre ou cadastre-se" flutua acima da barra.
  const folga = useFolgaInferior(usuario ? 110 : 180);
  const primeiroNome = usuario?.nome?.trim().split(' ')[0];
  const [aba, setAba] = useState<Aba>('TUDO');
  const itensNaSacola = useCarrinho().data?.quantidadeDeItens ?? 0;

  // Topo preto: hora e bateria em branco só enquanto a home está na frente.
  useFocusEffect(
    useCallback(() => {
      // Na abertura, o <StatusBar style="dark"> da raiz aplica depois deste
      // efeito (setImmediate); o timer roda depois dele e o branco prevalece.
      const timer = setTimeout(() => setStatusBarStyle('light'), 50);
      return () => {
        clearTimeout(timer);
        setStatusBarStyle('dark');
      };
    }, []),
  );

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
    const abertas = lojas
      .filter((loja) => loja.aberta)
      .sort((a, b) => Number(b.patrocinada) - Number(a.patrocinada) || b.avaliacoes - a.avaliacoes);
    return {
      categorias: naAba(dados.categorias),
      saindoAgora: naAba(dados.saindoAgora),
      secoes: naAba(dados.secoes ?? []),
      abertas,
      fechadas: lojas.filter((loja) => !loja.aberta),
    };
  }, [dados, aba]);

  // Topo preto da marca, como na tela do app mostrada na landing.
  const cabecalho = (
    <View style={[estilos.topo, { paddingTop: topo + espaco.s }]}>
      <View style={estilos.linhaDoTopo}>
        <Image
          source={LETREIRO}
          style={estilos.letreiro}
          contentFit="contain"
          accessibilityLabel="Rapidinho Entrega"
        />
        <View style={{ flex: 1 }} />
        <BotaoNoTopo
          Icone={ShoppingBag}
          rotulo={itensNaSacola ? `Sacola: ${itensNaSacola} itens` : 'Sacola'}
          aoTocar={() => router.push('/sacola')}
          aviso={itensNaSacola}
        />
      </View>
      <Toque
        accessibilityLabel="Trocar cidade"
        onPress={() => router.push('/cidades')}
        style={estilos.cidade}
      >
        <MapPin size={22} color={cores.marcaViva} />
        <View style={{ flex: 1 }}>
          <T v="legenda" cor={cores.textoNaNoiteFraco}>
            {primeiroNome ? `Olá, ${primeiroNome}! Entregar em` : 'Entregar em'}
          </T>
          <View style={estilos.cidadeNome}>
            <T v="titulo3" cor={cores.textoNaNoite} numberOfLines={1}>
              {dados ? `${dados.cidade.nome} - ${dados.cidade.uf}` : 'Escolha a cidade'}
            </T>
            <ChevronDown size={18} color={cores.marcaViva} />
          </View>
        </View>
      </Toque>
      <Toque
        accessibilityLabel="Buscar lojas e produtos"
        onPress={() => router.push('/busca')}
        style={estilos.busca}
      >
        <Search size={20} color={cores.textoMedio} />
        <T cor={cores.textoMedio}>O que você precisa hoje?</T>
      </Toque>
      {abas.length > 1 ? <Pilulas<Aba> opcoes={abas} valor={aba} aoMudar={setAba} escuro /> : null}
    </View>
  );

  const faixas = dados
    ? distribuidorDeFaixas(
        dados.banners.filter((banner) => banner.posicao === 'HOME_STRIP'),
        dados.cidade.slug,
      )
    : null;

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
              // Banner sem posição (API antiga) conta como topo.
              banners={dados.banners.filter((banner) => (banner.posicao ?? 'TOP') === 'TOP')}
              cidade={dados.cidade.slug}
              nomeDaCidade={dados.cidade.nome}
            />

            {filtrado.categorias.length > 0 ? (
              <FaixaDeCategorias categorias={filtrado.categorias} cidade={dados.cidade.slug} />
            ) : null}

            {faixas?.uma()}

            {/* Logo no alto: quem abre o app à noite precisa ver de cara onde
                ainda dá para pedir, antes de escolher uma loja fechada. */}
            {filtrado.abertas.length > 0 ? (
              <Secao
                titulo="Abertas agora"
                subtitulo={
                  filtrado.abertas.length === 1
                    ? '1 loja recebendo pedidos'
                    : `${filtrado.abertas.length} lojas recebendo pedidos`
                }
              >
                <FlatList
                  data={filtrado.abertas}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(loja) => loja.id}
                  contentContainerStyle={estilos.listaAberta}
                  renderItem={({ item }) => (
                    <CartaoDeLojaAberta loja={item} cidade={dados.cidade.slug} />
                  )}
                />
              </Secao>
            ) : filtrado.fechadas.length > 0 ? (
              <View style={estilos.tudoFechado}>
                <T v="titulo3" cor={cores.perigo}>
                  Nenhuma loja aberta agora
                </T>
                <T v="legenda" cor={cores.textoMedio}>
                  Veja abaixo quando cada uma abre.
                </T>
              </View>
            ) : null}

            {faixas?.uma()}

            {filtrado.secoes.map((secao) => (
              <View key={secao.id} style={estilos.corpo}>
                <SecaoDeCampanha secao={secao} cidade={dados.cidade.slug} />
                {faixas?.uma()}
              </View>
            ))}

            {filtrado.saindoAgora.length > 0 ? (
              <Secao titulo="Saindo agora" subtitulo="O que a cidade está pedindo nesta hora" fundo>
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
                Icone={ListChecks}
                titulo="Pedir por lista"
                texto="Mande a lista. A gente monta o pedido nas lojas abertas."
                aoTocar={() => router.push('/lista')}
              />
            ) : null}

            {faixas?.resto()}

            <Secao
              titulo="Todas as lojas"
              subtitulo={`${filtrado.abertas.length} abertas de ${
                filtrado.abertas.length + filtrado.fechadas.length
              } na cidade`}
            >
              {filtrado.abertas.length > 0 ? (
                <ListaDeLojas lojas={filtrado.abertas} cidade={dados.cidade.slug} />
              ) : null}
              {filtrado.fechadas.length > 0 ? (
                <>
                  <T v="corpoForte" cor={cores.textoMedio} style={estilos.rotuloFechadas}>
                    Fechadas agora
                  </T>
                  <ListaDeLojas lojas={filtrado.fechadas} cidade={dados.cidade.slug} />
                </>
              ) : null}
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
            Entre ou cadastre-se
          </T>
          <ChevronRight size={22} color={cores.textoNaCor} />
        </Toque>
      ) : null}
    </View>
  );
}

function ListaDeLojas({ lojas, cidade }: { lojas: LojaDaVitrine[]; cidade: string }) {
  return (
    <View style={estilos.listaDeLojas}>
      {lojas.map((loja, indice) => (
        <View key={loja.id}>
          {indice > 0 ? <View style={estilos.divisoria} /> : null}
          <CartaoDeLoja loja={loja} cidade={cidade} agrupada />
        </View>
      ))}
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
    backgroundColor: cores.noite,
    paddingHorizontal: espaco.l,
    paddingBottom: espaco.l,
    gap: espaco.m,
    borderBottomLeftRadius: raio.folha,
    borderBottomRightRadius: raio.folha,
  },
  linhaDoTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  letreiro: { width: 150, height: 32 },
  cidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    minHeight: toqueMinimo,
  },
  busca: {
    minHeight: toqueMinimo + 4,
    borderRadius: raio.medio,
    backgroundColor: cores.superficie,
    paddingHorizontal: espaco.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
  },
  cidadeNome: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  corpo: { gap: espaco.xl, paddingTop: espaco.l },
  // Respiro embaixo para a sombra do cartão não ser cortada.
  listaAberta: { paddingHorizontal: espaco.l, paddingBottom: espaco.s, gap: espaco.m },
  tudoFechado: {
    marginHorizontal: espaco.l,
    padding: espaco.l,
    gap: 2,
    borderRadius: raio.folha,
    backgroundColor: cores.perigoClaro,
  },
  rotuloFechadas: { paddingHorizontal: espaco.l, marginTop: espaco.s },
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
