import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bike, Clock, Pizza, ShoppingBag, Star } from 'lucide-react-native';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LojaDetalhada, ProdutoDoCardapio } from '@contrato';
import { useCarrinho } from '@/api/carrinho';
import { chamar, ErroDaApi } from '@/api/cliente';
import { dinheiro, ErroDaTela, Esqueleto, Foto, Selo, T, Toque } from '@/componentes/base';
import { chaveDaCategoria, iconeDaCategoria } from '@/tema/categorias';
import { icone3dDaCategoria } from '@/tema/icones';
import { cores, coresDaCategoria, elevacao, espaco, raio, toqueMinimo } from '@/tema/tokens';

export default function Loja() {
  const { cidade, loja: slug } = useLocalSearchParams<{ cidade: string; loja: string }>();
  const { top: topo, bottom: baixo } = useSafeAreaInsets();
  const carrinho = useCarrinho();

  const loja = useQuery({
    queryKey: ['loja', cidade, slug],
    queryFn: () => chamar<LojaDetalhada>(`cidades/${cidade}/lojas/${slug}`),
  });

  const dados = loja.data;
  const chave = chaveDaCategoria(dados?.categoriaSlug, dados?.segmento);
  const tom = coresDaCategoria[chave];
  const noCarrinho = carrinho.data?.carrinhos.find((c) => c.lojaId === dados?.id);
  const itensNoCarrinho = noCarrinho?.itens.reduce((soma, i) => soma + i.quantidade, 0) ?? 0;

  const secoes = (dados?.secoes ?? [])
    .filter((s) => s.produtos.length > 0)
    .map((s) => ({ titulo: s.nome, data: s.produtos }));

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      {loja.isError ? (
        <View style={[estilos.tela, { paddingTop: topo }]}>
          <ErroDaTela
            mensagem={loja.error instanceof ErroDaApi ? loja.error.message : 'Tente de novo.'}
            aoTentar={() => void loja.refetch()}
          />
        </View>
      ) : !dados ? (
        <View style={{ gap: espaco.l }}>
          <Esqueleto estilo={{ height: 220, borderRadius: 0 }} />
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} estilo={{ height: 96, marginHorizontal: espaco.l }} />
          ))}
        </View>
      ) : (
        <SectionList
          sections={secoes}
          keyExtractor={(p) => p.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: baixo + (itensNoCarrinho ? 120 : espaco.xxl) }}
          ListHeaderComponent={
            <View>
              <View style={estilos.capa}>
                <Foto
                  url={dados.capaUrl}
                  categoria={chave}
                  Icone={iconeDaCategoria(chave)}
                  tamanhoDoIcone={64}
                  estilo={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(0,0,0,0.45)', 'transparent']}
                  style={[StyleSheet.absoluteFill, { height: 120 }]}
                />
                <Toque
                  accessibilityLabel="Voltar"
                  onPress={() => router.back()}
                  style={[estilos.voltar, { top: topo + espaco.s }]}
                >
                  <ArrowLeft size={22} color={cores.texto} />
                </Toque>
              </View>
              <View style={estilos.cabecalho}>
                <View style={estilos.linha}>
                  <Foto
                    url={dados.logoUrl}
                    categoria={chave}
                    Icone={iconeDaCategoria(chave)}
                    estilo={estilos.logo}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="titulo1" numberOfLines={2}>
                      {dados.nome}
                    </T>
                    <T v="legenda" cor={tom.cor}>
                      {dados.categoria}
                    </T>
                  </View>
                </View>
                <View style={estilos.fatos}>
                  <Fato Icone={Star} texto={dados.avaliacoes ? dados.nota.toFixed(1) : 'Nova'} />
                  <Fato Icone={Clock} texto={`${dados.tempoMin}-${dados.tempoMax} min`} />
                  <Fato
                    Icone={Bike}
                    texto={dados.taxaGratis ? 'Entrega grátis' : dinheiro(dados.taxaCents)}
                  />
                </View>
                {!dados.aberta ? (
                  <Selo texto={dados.rotuloHorario} cor={cores.aviso} fundo={cores.avisoClaro} />
                ) : null}
                {dados.pedidoMinimoCents > 0 ? (
                  <T v="legenda" cor={cores.textoMedio}>
                    Pedido mínimo {dinheiro(dados.pedidoMinimoCents)}
                    {dados.entregaGratisAcimaCents
                      ? ` · Entrega grátis acima de ${dinheiro(dados.entregaGratisAcimaCents)}`
                      : ''}
                  </T>
                ) : null}
                {dados.pizza ? (
                  <Toque
                    accessibilityLabel="Montar pizza"
                    onPress={() =>
                      router.push({
                        pathname: '/pizza/[cidade]/[loja]',
                        params: { cidade, loja: slug },
                      })
                    }
                    style={estilos.pizza}
                  >
                    <Pizza size={28} color={coresDaCategoria.comida.cor} />
                    <View style={{ flex: 1 }}>
                      <T v="titulo3">Monte sua pizza</T>
                      <T v="legenda" cor={cores.textoMedio}>
                        Escolha o tamanho, até{' '}
                        {Math.max(...dados.pizza.tamanhos.map((t) => t.maxSabores))} sabores e a
                        borda
                      </T>
                    </View>
                  </Toque>
                ) : null}
                {dados.marmita ? (
                  <Toque
                    accessibilityLabel="Montar marmita"
                    onPress={() =>
                      router.push({
                        pathname: '/marmita/[cidade]/[loja]',
                        params: { cidade, loja: slug },
                      })
                    }
                    style={estilos.pizza}
                  >
                    <Image
                      source={icone3dDaCategoria('marmitas', 'comida')}
                      style={estilos.iconeDaMarmita}
                      contentFit="contain"
                    />
                    <View style={{ flex: 1 }}>
                      <T v="titulo3">Monte sua marmita</T>
                      <T v="legenda" cor={cores.textoMedio}>
                        Cardápio de hoje a partir de{' '}
                        {dinheiro(Math.min(...dados.marmita.tamanhos.map((t) => t.precoCents)))}.
                        Tire o que não gosta.
                      </T>
                    </View>
                  </Toque>
                ) : null}
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <T v="titulo2" style={estilos.tituloDaSecao}>
              {section.titulo}
            </T>
          )}
          renderItem={({ item }) => <ItemDoCardapio produto={item} cidade={cidade} chave={chave} />}
        />
      )}

      {itensNoCarrinho > 0 ? (
        <View style={[estilos.rodape, { paddingBottom: baixo + espaco.l }]}>
          <Toque
            accessibilityLabel="Ver sacola"
            onPress={() => router.push('/sacola')}
            style={estilos.barraDaSacola}
          >
            <LinearGradient
              colors={['#FF7A1A', '#E6192B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={estilos.barraDentro}
            >
              <View style={estilos.contagem}>
                <T v="corpoForte" cor={cores.marcaEscura}>
                  {itensNoCarrinho}
                </T>
              </View>
              <T v="corpoForte" cor={cores.textoNaCor} style={{ flex: 1 }}>
                Ver sacola
              </T>
              <T v="corpoForte" cor={cores.textoNaCor}>
                {dinheiro(noCarrinho?.subtotalCents ?? 0)}
              </T>
            </LinearGradient>
          </Toque>
        </View>
      ) : null}
    </View>
  );
}

function Fato({ Icone, texto }: { Icone: typeof Star; texto: string }) {
  return (
    <View style={estilos.fato}>
      <Icone size={16} color={cores.marcaEscura} />
      <T v="legenda">{texto}</T>
    </View>
  );
}

function ItemDoCardapio({
  produto,
  cidade,
  chave,
}: {
  produto: ProdutoDoCardapio;
  cidade: string;
  chave: ReturnType<typeof chaveDaCategoria>;
}) {
  return (
    <Toque
      encolhe={0.99}
      disabled={!produto.disponivel}
      accessibilityLabel={`${produto.nome}, ${dinheiro(produto.precoCents)}`}
      onPress={() =>
        router.push({ pathname: '/produto/[cidade]/[id]', params: { cidade, id: produto.id } })
      }
      style={[estilos.produto, !produto.disponivel && { opacity: 0.5 }]}
    >
      <View style={{ flex: 1, gap: espaco.xs }}>
        <T v="corpoForte" numberOfLines={2}>
          {produto.nome}
        </T>
        {produto.descricao ? (
          <T v="legenda" cor={cores.textoMedio} numberOfLines={2}>
            {produto.descricao}
          </T>
        ) : null}
        <View style={estilos.linhaDoPreco}>
          <T v="corpoForte" cor={cores.marcaEscura}>
            {dinheiro(produto.precoCents)}
            {produto.porPeso ? '/kg' : ''}
          </T>
          {produto.precoDeCents ? (
            <T v="legenda" cor={cores.textoFraco} style={{ textDecorationLine: 'line-through' }}>
              {dinheiro(produto.precoDeCents)}
            </T>
          ) : null}
          {!produto.disponivel ? (
            <Selo texto="Esgotado" cor={cores.textoMedio} fundo={cores.superficieAlta} />
          ) : null}
        </View>
      </View>
      <Foto
        url={produto.imagemUrl}
        categoria={chave}
        Icone={ShoppingBag}
        tamanhoDoIcone={24}
        estilo={estilos.fotoDoProduto}
      />
    </Toque>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  capa: { height: 200 },
  voltar: {
    position: 'absolute',
    left: espaco.l,
    width: toqueMinimo,
    height: toqueMinimo,
    borderRadius: raio.total,
    backgroundColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevacao.baixa,
  },
  cabecalho: {
    marginTop: -espaco.xl,
    marginHorizontal: espaco.l,
    padding: espaco.l,
    gap: espaco.m,
    borderRadius: raio.folha,
    backgroundColor: cores.superficie,
    ...elevacao.alta,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  logo: { width: 64, height: 64, borderRadius: raio.grande },
  fatos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s },
  fato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    paddingHorizontal: espaco.m,
    paddingVertical: espaco.xs + 2,
    borderRadius: raio.total,
    backgroundColor: cores.superficieAlta,
  },
  iconeDaMarmita: { width: 44, height: 44 },
  pizza: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.m,
    borderRadius: raio.medio,
    backgroundColor: coresDaCategoria.comida.fundo,
  },
  tituloDaSecao: { paddingHorizontal: espaco.l, paddingTop: espaco.xl, paddingBottom: espaco.s },
  produto: {
    flexDirection: 'row',
    gap: espaco.m,
    marginHorizontal: espaco.l,
    marginBottom: espaco.s,
    padding: espaco.m,
    borderRadius: raio.grande,
    backgroundColor: cores.superficie,
  },
  linhaDoPreco: { flexDirection: 'row', alignItems: 'center', gap: espaco.s, flexWrap: 'wrap' },
  fotoDoProduto: { width: 96, height: 96, borderRadius: raio.medio },
  rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: espaco.l },
  barraDaSacola: { borderRadius: raio.grande, overflow: 'hidden', ...elevacao.alta },
  barraDentro: {
    minHeight: toqueMinimo + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.l,
  },
  contagem: {
    minWidth: 28,
    height: 28,
    borderRadius: raio.total,
    backgroundColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
