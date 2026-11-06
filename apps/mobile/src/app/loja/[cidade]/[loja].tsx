import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Bike,
  Clock,
  Heart,
  MapPin,
  Pizza,
  Search,
  Star,
  Wallet,
  X,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  ComentarioDaLoja,
  LojaDetalhada,
  ProdutoDoCardapio,
  RespostaAlternarFavorito,
} from '@contrato';
import { avisarErro, useAdicionarAoCarrinho, useCarrinho, useExigirLogin } from '@/api/carrinho';
import { chamar, ErroDaApi } from '@/api/cliente';
import { dinheiro, ErroDaTela, Esqueleto, Foto, Selo, T, Toque } from '@/componentes/base';
import { BannersDaLoja, CartaoDoProduto, type BannerDaLoja } from '@/componentes/loja-virtual';
import { Secao, SeloDeHorario } from '@/componentes/vitrine';
import { chaveDaCategoria, iconeDaCategoria } from '@/tema/categorias';
import { icone3dDaCategoria } from '@/tema/icones';
import { cores, coresDaCategoria, elevacao, espaco, raio, toqueMinimo } from '@/tema/tokens';

const NA_PRATELEIRA = 10;
const LARGURA_NA_PRATELEIRA = 156;

type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'ofertas' }
  | { tipo: 'secao'; id: string }
  | { tipo: 'promocao'; id: string };

type Linha =
  | { tipo: 'barra'; chave: string }
  | { tipo: 'banners'; chave: string; banners: BannerDaLoja[] }
  | {
      tipo: 'prateleira';
      chave: string;
      titulo: string;
      subtitulo?: string;
      produtos: ProdutoDoCardapio[];
      verTudo?: () => void;
    }
  | { tipo: 'titulo'; chave: string; titulo: string; subtitulo: string }
  | { tipo: 'par'; chave: string; produtos: ProdutoDoCardapio[] }
  | { tipo: 'vazio'; chave: string; texto: string }
  | { tipo: 'sobre'; chave: string };

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Esgotado vai para o fim: a prateleira mostra primeiro o que dá para levar. */
function disponiveisPrimeiro(produtos: ProdutoDoCardapio[]) {
  return [...produtos].sort((a, b) => Number(b.disponivel) - Number(a.disponivel));
}

function emPares(produtos: ProdutoDoCardapio[], prefixo: string): Linha[] {
  const linhas: Linha[] = [];
  for (let i = 0; i < produtos.length; i += 2) {
    linhas.push({ tipo: 'par', chave: `${prefixo}-${i}`, produtos: produtos.slice(i, i + 2) });
  }
  return linhas;
}

function contagem(total: number) {
  return total === 1 ? '1 produto' : `${total} produtos`;
}

export default function Loja() {
  const { cidade, loja: slug } = useLocalSearchParams<{ cidade: string; loja: string }>();
  const { top: topo, bottom: baixo } = useSafeAreaInsets();
  const carrinho = useCarrinho();

  const loja = useQuery({
    queryKey: ['loja', cidade, slug],
    queryFn: () => chamar<LojaDetalhada>(`cidades/${cidade}/lojas/${slug}`),
  });

  const dados = loja.data;
  const consultas = useQueryClient();
  const exigirLogin = useExigirLogin();
  const favoritar = useMutation({
    mutationFn: (lojaId: string) =>
      chamar<RespostaAlternarFavorito>('favoritos/alternar', { metodo: 'POST', corpo: { lojaId } }),
    onSuccess: (resposta) => {
      consultas.setQueryData<LojaDetalhada>(['loja', cidade, slug], (atual) =>
        atual ? { ...atual, favorita: resposta.favorita } : atual,
      );
      void consultas.invalidateQueries({ queryKey: ['favoritos'] });
    },
    onError: avisarErro,
  });
  // Muda na hora; se o servidor recusar, volta ao que era.
  const favorita = favoritar.isPending ? !dados?.favorita : !!dados?.favorita;
  const chave = chaveDaCategoria(dados?.categoriaSlug, dados?.segmento);
  const tom = coresDaCategoria[chave];
  const noCarrinho = carrinho.data?.carrinhos.find((c) => c.lojaId === dados?.id);
  const itensNoCarrinho = noCarrinho?.itens.reduce((soma, i) => soma + i.quantidade, 0) ?? 0;

  const lista = useRef<FlatList<Linha>>(null);
  const { width } = useWindowDimensions();
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' });
  const [busca, setBusca] = useState('');
  const adicionar = useAdicionarAoCarrinho();
  const larguraNaGrade = (width - espaco.l * 2 - espaco.m) / 2;

  // A página troca de "vitrine" para "grade" sem sair da tela; a barra sobe para o topo.
  const irPara = (destino: Vista) => {
    setBusca('');
    setVista(destino);
    lista.current?.scrollToIndex({ index: 0, animated: false });
  };

  const secoes = (dados?.secoes ?? []).filter((s) => s.produtos.length > 0);
  const todos = secoes.flatMap((s) => s.produtos);
  const porId = new Map(todos.map((p) => [p.id, p]));
  const ofertas = disponiveisPrimeiro(todos.filter((p) => p.precoDeCents)).sort(
    (a, b) =>
      Number(b.disponivel) - Number(a.disponivel) ||
      1 - b.precoCents / b.precoDeCents! - (1 - a.precoCents / a.precoDeCents!),
  );
  const maisPedidos = (dados?.maisPedidosIds ?? []).flatMap((id) => {
    const produto = porId.get(id);
    return produto?.disponivel ? [produto] : [];
  });
  const escolhidos = todos.filter((p) => p.destaque && p.disponivel);
  const promocoes = (dados?.promocoes ?? [])
    .map((promocao) => ({
      ...promocao,
      produtos: disponiveisPrimeiro(
        promocao.produtoIds.flatMap((id) => {
          const produto = porId.get(id);
          return produto ? [produto] : [];
        }),
      ),
    }))
    .filter((promocao) => promocao.produtos.length > 0);

  const banners: BannerDaLoja[] = promocoes.map((promocao) => ({
    id: promocao.id,
    titulo: promocao.titulo,
    subtitulo: promocao.subtitulo ?? contagem(promocao.produtos.length),
    imagemUrl: promocao.imagemUrl,
    aoTocar: () => irPara({ tipo: 'promocao', id: promocao.id }),
  }));
  // Loja que ainda não criou promoção, mas tem preço riscado, também abre com banner.
  if (banners.length === 0 && ofertas.length > 0) {
    const maior = Math.max(
      ...ofertas.map((p) => Math.round((1 - p.precoCents / p.precoDeCents!) * 100)),
    );
    banners.push({
      id: 'ofertas',
      titulo: `Ofertas com até ${maior}% de desconto`,
      subtitulo: `${contagem(ofertas.length)} com preço baixo agora`,
      imagemUrl: null,
      aoTocar: () => irPara({ tipo: 'ofertas' }),
    });
  }

  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  const linhas: Linha[] = [{ tipo: 'barra', chave: 'barra' }];
  const grade = (chave: string, titulo: string, produtos: ProdutoDoCardapio[], vazio: string) => {
    linhas.push({
      tipo: 'titulo',
      chave: `titulo-${chave}`,
      titulo,
      subtitulo: contagem(produtos.length),
    });
    if (produtos.length === 0)
      linhas.push({ tipo: 'vazio', chave: `vazio-${chave}`, texto: vazio });
    linhas.push(...emPares(produtos, chave));
  };
  const secaoAberta = vista.tipo === 'secao' ? secoes.find((s) => s.id === vista.id) : undefined;
  const promocaoAberta =
    vista.tipo === 'promocao' ? promocoes.find((p) => p.id === vista.id) : undefined;

  if (termos.length > 0) {
    const achados = todos.filter((p) => {
      const nome = normalizar(p.nome);
      return termos.every((termo) => nome.includes(termo));
    });
    grade(
      'busca',
      `Resultado para "${busca.trim()}"`,
      disponiveisPrimeiro(achados),
      'Esta loja não tem esse produto.',
    );
  } else if (vista.tipo === 'ofertas') {
    grade('ofertas', 'Ofertas', ofertas, 'Nenhuma oferta agora.');
  } else if (secaoAberta) {
    grade(
      secaoAberta.id,
      secaoAberta.nome,
      disponiveisPrimeiro(secaoAberta.produtos),
      'Nada aqui agora.',
    );
  } else if (promocaoAberta) {
    grade(promocaoAberta.id, promocaoAberta.titulo, promocaoAberta.produtos, 'Nada aqui agora.');
  } else {
    if (banners.length > 0) linhas.push({ tipo: 'banners', chave: 'banners', banners });
    if (ofertas.length > 0) {
      linhas.push({
        tipo: 'prateleira',
        chave: 'ofertas',
        titulo: 'Ofertas',
        subtitulo: 'Preço baixo agora',
        produtos: ofertas.slice(0, NA_PRATELEIRA),
        verTudo: ofertas.length > NA_PRATELEIRA ? () => irPara({ tipo: 'ofertas' }) : undefined,
      });
    }
    if (maisPedidos.length > 0) {
      linhas.push({
        tipo: 'prateleira',
        chave: 'mais-pedidos',
        titulo: 'Mais pedidos',
        produtos: maisPedidos,
      });
    }
    if (escolhidos.length > 0) {
      linhas.push({
        tipo: 'prateleira',
        chave: 'escolhidos',
        titulo: 'Escolhidos pela loja',
        produtos: escolhidos.slice(0, NA_PRATELEIRA),
      });
    }
    for (const secao of secoes) {
      linhas.push({
        tipo: 'prateleira',
        chave: secao.id,
        titulo: secao.nome,
        subtitulo: contagem(secao.produtos.length),
        produtos: disponiveisPrimeiro(secao.produtos).slice(0, NA_PRATELEIRA),
        verTudo:
          secao.produtos.length > NA_PRATELEIRA
            ? () => irPara({ tipo: 'secao', id: secao.id })
            : undefined,
      });
    }
    linhas.push({ tipo: 'sobre', chave: 'sobre' });
  }

  const cartao = (produto: ProdutoDoCardapio, largura: number) => (
    <CartaoDoProduto
      produto={produto}
      cidade={cidade}
      categoria={chave}
      reserva={icone3dDaCategoria(dados?.categoriaSlug, chave)}
      largura={largura}
      naSacola={
        noCarrinho?.itens
          .filter((item) => item.produtoId === produto.id)
          .reduce((soma, item) => soma + item.quantidade, 0) ?? 0
      }
      podeAdicionar={!!dados?.aberta}
      aoAdicionar={() =>
        exigirLogin(() =>
          adicionar.mutate({
            lojaId: dados!.id,
            item: { produtoId: produto.id, quantidade: 1 },
          }),
        )
      }
    />
  );

  return (
    <View style={[estilos.tela, { paddingTop: topo }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {loja.isError ? (
        <View style={estilos.tela}>
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
        <FlatList
          ref={lista}
          data={linhas}
          keyExtractor={(linha) => linha.chave}
          stickyHeaderIndices={[1]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={6}
          onScrollToIndexFailed={() => undefined}
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
                  style={[estilos.voltar, { top: espaco.s }]}
                >
                  <ArrowLeft size={22} color={cores.texto} />
                </Toque>
                <Toque
                  accessibilityLabel={favorita ? 'Tirar dos favoritos' : 'Favoritar loja'}
                  accessibilityState={{ selected: favorita }}
                  disabled={favoritar.isPending}
                  onPress={() => exigirLogin(() => favoritar.mutate(dados.id))}
                  style={[estilos.voltar, estilos.favorito, { top: espaco.s }]}
                >
                  <Heart
                    size={22}
                    color={favorita ? cores.perigo : cores.texto}
                    fill={favorita ? cores.perigo : 'transparent'}
                  />
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
                  <SeloDeHorario aberta={dados.aberta} />
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
          renderItem={({ item: linha }) => {
            switch (linha.tipo) {
              case 'barra':
                return (
                  <View style={estilos.barra}>
                    <View style={estilos.busca}>
                      <Search size={20} color={cores.textoMedio} />
                      <TextInput
                        value={busca}
                        onChangeText={setBusca}
                        placeholder={`Buscar em ${dados.nome}`}
                        placeholderTextColor={cores.textoMedio}
                        returnKeyType="search"
                        style={estilos.buscaCampo}
                      />
                      {busca ? (
                        <Toque
                          accessibilityLabel="Limpar busca"
                          onPress={() => setBusca('')}
                          style={estilos.buscaLimpar}
                        >
                          <X size={20} color={cores.textoMedio} />
                        </Toque>
                      ) : null}
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={estilos.departamentos}
                    >
                      <Departamento
                        nome="Início"
                        ativo={vista.tipo === 'inicio' && !busca}
                        aoTocar={() => irPara({ tipo: 'inicio' })}
                      />
                      {ofertas.length > 0 ? (
                        <Departamento
                          nome="Ofertas"
                          ativo={vista.tipo === 'ofertas' && !busca}
                          aoTocar={() => irPara({ tipo: 'ofertas' })}
                        />
                      ) : null}
                      {secoes.map((secao) => (
                        <Departamento
                          key={secao.id}
                          nome={secao.nome}
                          ativo={secaoAberta?.id === secao.id && !busca}
                          aoTocar={() => irPara({ tipo: 'secao', id: secao.id })}
                        />
                      ))}
                    </ScrollView>
                  </View>
                );
              case 'banners':
                return (
                  <View style={{ paddingTop: espaco.m }}>
                    <BannersDaLoja banners={linha.banners} />
                  </View>
                );
              case 'prateleira':
                return (
                  <View style={{ paddingTop: espaco.xl }}>
                    <Secao
                      titulo={linha.titulo}
                      subtitulo={linha.subtitulo}
                      verTudo={linha.verTudo}
                    >
                      <FlatList
                        data={linha.produtos}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(p) => p.id}
                        initialNumToRender={3}
                        contentContainerStyle={estilos.prateleira}
                        renderItem={({ item }) => cartao(item, LARGURA_NA_PRATELEIRA)}
                      />
                    </Secao>
                  </View>
                );
              case 'titulo':
                return (
                  <View style={estilos.tituloDaGrade}>
                    <T v="titulo2">{linha.titulo}</T>
                    <T v="legenda" cor={cores.textoMedio}>
                      {linha.subtitulo}
                    </T>
                  </View>
                );
              case 'par':
                return (
                  <View style={estilos.par}>
                    {linha.produtos.map((produto) => (
                      <View key={produto.id}>{cartao(produto, larguraNaGrade)}</View>
                    ))}
                  </View>
                );
              case 'vazio':
                return (
                  <T v="corpo" cor={cores.textoMedio} style={{ padding: espaco.l }}>
                    {linha.texto}
                  </T>
                );
              case 'sobre':
                return <SobreALoja loja={dados} />;
            }
          }}
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

function Departamento({
  nome,
  ativo,
  aoTocar,
}: {
  nome: string;
  ativo: boolean;
  aoTocar: () => void;
}) {
  return (
    <Toque
      accessibilityLabel={nome}
      accessibilityState={{ selected: ativo }}
      onPress={aoTocar}
      style={[estilos.departamento, ativo && estilos.departamentoAtivo]}
    >
      <T v="corpoForte" cor={ativo ? cores.textoNaCor : cores.texto}>
        {nome}
      </T>
    </Toque>
  );
}

/** Fim da página, como o rodapé de um site: quem quer conhecer a loja desce até aqui. */
function SobreALoja({ loja }: { loja: LojaDetalhada }) {
  const pagamentos = [
    loja.aceitaPix && 'Pix',
    loja.aceitaDinheiro && 'dinheiro',
    loja.aceitaCartaoNaEntrega && 'cartão na entrega',
  ].filter(Boolean);

  return (
    <View style={estilos.sobre}>
      <View style={estilos.sobreBloco}>
        <T v="titulo2">Sobre a loja</T>
        {loja.descricao ? <T v="corpo">{loja.descricao}</T> : null}
        <View style={estilos.sobreLinha}>
          <MapPin size={18} color={cores.textoMedio} />
          <T v="legenda" cor={cores.textoMedio} style={{ flex: 1 }}>
            {loja.endereco}
          </T>
        </View>
        {pagamentos.length > 0 ? (
          <View style={estilos.sobreLinha}>
            <Wallet size={18} color={cores.textoMedio} />
            <T v="legenda" cor={cores.textoMedio} style={{ flex: 1 }}>
              {`Aceita ${pagamentos.join(', ')}`}
            </T>
          </View>
        ) : null}
      </View>
      {loja.comentarios.length ? (
        <View style={{ gap: espaco.s }}>
          <T v="titulo2" style={{ paddingHorizontal: espaco.l }}>
            {`Avaliações · ${loja.nota.toFixed(1)} (${loja.avaliacoes})`}
          </T>
          <FlatList
            data={loja.comentarios}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingHorizontal: espaco.l, gap: espaco.m }}
            renderItem={({ item }) => <CartaoDoComentario comentario={item} />}
          />
        </View>
      ) : null}
    </View>
  );
}

function CartaoDoComentario({ comentario }: { comentario: ComentarioDaLoja }) {
  return (
    <View style={estilos.comentario}>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={14}
            color={cores.amarelo}
            fill={n <= comentario.nota ? cores.amarelo : 'transparent'}
          />
        ))}
      </View>
      <T v="corpo" numberOfLines={4}>
        {comentario.comentario}
      </T>
      <T v="legenda" cor={cores.textoMedio}>
        {comentario.autor}
      </T>
      {comentario.resposta ? (
        <T v="legenda" cor={cores.textoMedio} numberOfLines={3} style={estilos.resposta}>
          {`Resposta da loja: ${comentario.resposta}`}
        </T>
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

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  capa: { height: 180 },
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
  favorito: { left: undefined, right: espaco.l },
  comentario: {
    width: 260,
    padding: espaco.m,
    gap: espaco.xs,
    borderRadius: raio.grande,
    backgroundColor: cores.superficie,
  },
  resposta: {
    marginTop: espaco.xs,
    paddingLeft: espaco.s,
    borderLeftWidth: 2,
    borderLeftColor: cores.linha,
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
  barra: {
    gap: espaco.s,
    paddingTop: espaco.m,
    paddingBottom: espaco.s,
    backgroundColor: cores.fundo,
  },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    minHeight: toqueMinimo,
    marginHorizontal: espaco.l,
    paddingLeft: espaco.m,
    borderRadius: raio.total,
    backgroundColor: cores.superficie,
  },
  buscaCampo: { flex: 1, minHeight: toqueMinimo, color: cores.texto },
  buscaLimpar: {
    width: toqueMinimo,
    height: toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  departamentos: { paddingHorizontal: espaco.l, gap: espaco.s },
  departamento: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: espaco.l,
    borderRadius: raio.total,
    backgroundColor: cores.superficie,
  },
  departamentoAtivo: { backgroundColor: cores.marca },
  prateleira: { paddingHorizontal: espaco.l, gap: espaco.m },
  tituloDaGrade: { paddingHorizontal: espaco.l, paddingTop: espaco.m, paddingBottom: espaco.m },
  par: {
    flexDirection: 'row',
    gap: espaco.m,
    paddingHorizontal: espaco.l,
    paddingBottom: espaco.m,
  },
  sobre: { gap: espaco.xl, paddingTop: espaco.xxl },
  sobreBloco: { gap: espaco.s, paddingHorizontal: espaco.l },
  sobreLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
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
