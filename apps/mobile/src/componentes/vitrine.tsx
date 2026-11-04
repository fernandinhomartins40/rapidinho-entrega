import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronRight, Star } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FlatList, Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import type {
  BannerDaVitrine,
  CategoriaDaVitrine,
  LojaDaVitrine,
  ProdutoDaVitrine,
  SecaoDaVitrine,
} from '@contrato';
import { chamar } from '@/api/cliente';
import { chaveDaCategoria } from '@/tema/categorias';
import { icone3dDaCategoria, type Icone3d } from '@/tema/icones';
import { cores, coresDaCategoria, degradeDoSol, elevacao, espaco, raio } from '@/tema/tokens';
import { dinheiro, Foto, Selo, T, Toque } from './base';

const INTERVALO_DO_CARROSSEL_MS = 5000;
const ENTREGADOR = require('@/assets/marca/entregador.png');

type BannerVisivel = { item: BannerDaVitrine; index?: number | null };

function abrirBanner(banner: BannerDaVitrine, cidade: string) {
  if (banner.lojaSlug) {
    router.push({ pathname: '/loja/[cidade]/[loja]', params: { cidade, loja: banner.lojaSlug } });
  } else if (banner.linkUrl) {
    void Linking.openURL(banner.linkUrl);
  }
}

/** Chamado da marca: ocupa o carrossel quando não há campanha no ar. */
function BannerDaMarca({ altura, nomeDaCidade }: { altura: number; nomeDaCidade: string }) {
  return (
    <LinearGradient
      colors={degradeDoSol}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[estilos.banner, estilos.bannerDaMarca, { height: altura }]}
    >
      <View style={estilos.bannerDaMarcaTexto}>
        <T v="titulo1" cor={cores.noite} style={estilos.inclinado}>
          Entrega rápida e segura
        </T>
        <T v="corpoForte" cor={cores.noite} style={estilos.inclinado}>
          {`em ${nomeDaCidade}!`}
        </T>
      </View>
      <Image source={ENTREGADOR} style={estilos.entregador} contentFit="contain" />
    </LinearGradient>
  );
}

/**
 * Vitrine de campanhas: o espaço que o lojista negocia. Sem campanha ativa, um
 * chamado de marca ocupa o lugar, para a home nunca abrir com um buraco.
 */
export function CarrosselDeCampanhas({
  banners,
  cidade,
  nomeDaCidade,
}: {
  banners: BannerDaVitrine[];
  cidade: string;
  nomeDaCidade: string;
}) {
  const { width } = useWindowDimensions();
  const largura = width - espaco.l * 2;
  const altura = Math.round(largura * 0.42);
  const lista = useRef<FlatList<BannerDaVitrine>>(null);
  const [atual, setAtual] = useState(0);
  const vistos = useRef(new Set<string>());

  const contarImpressao = useMutation({
    mutationFn: (id: string) => chamar(`banners/${id}/impressao`, { metodo: 'POST' }),
  });
  const contarClique = useMutation({
    mutationFn: (id: string) => chamar(`banners/${id}/clique`, { metodo: 'POST' }),
  });

  const aoMudar = useRef(({ viewableItems }: { viewableItems: BannerVisivel[] }) => {
    const item = viewableItems[0];
    if (!item) return;
    setAtual(item.index ?? 0);
    // Uma impressão por banner a cada abertura, para o lojista receber número honesto.
    if (!vistos.current.has(item.item.id)) {
      vistos.current.add(item.item.id);
      contarImpressao.mutate(item.item.id);
    }
  }).current;

  useEffect(() => {
    if (banners.length < 2) return;
    const relogio = setInterval(() => {
      setAtual((indice) => {
        const proximo = (indice + 1) % banners.length;
        lista.current?.scrollToIndex({ index: proximo, animated: true });
        return proximo;
      });
    }, INTERVALO_DO_CARROSSEL_MS);
    return () => clearInterval(relogio);
  }, [banners.length]);

  if (banners.length === 0) {
    return (
      <View style={{ paddingHorizontal: espaco.l }}>
        <BannerDaMarca altura={altura} nomeDaCidade={nomeDaCidade} />
      </View>
    );
  }

  return (
    <View>
      <FlatList
        ref={lista}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(banner) => banner.id}
        onViewableItemsChanged={aoMudar}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: espaco.l }}>
            <Toque
              accessibilityLabel={item.titulo}
              encolhe={0.985}
              onPress={() => {
                contarClique.mutate(item.id);
                abrirBanner(item, cidade);
              }}
              style={[estilos.banner, { height: altura }]}
            >
              <Foto url={item.imagemUrl} categoria="outros" estilo={StyleSheet.absoluteFill} />
              {item.cupom ? (
                <View style={estilos.cupom}>
                  <Selo texto={`CUPOM ${item.cupom}`} cor={cores.noite} fundo={cores.amarelo} />
                </View>
              ) : null}
            </Toque>
          </View>
        )}
      />
      {banners.length > 1 ? (
        <View style={estilos.pontos}>
          {banners.map((banner, indice) => (
            <View key={banner.id} style={[estilos.ponto, indice === atual && estilos.pontoAtivo]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Atalhos por categoria: ícone colorido num círculo claro, nome embaixo. */
export function FaixaDeCategorias({
  categorias,
  cidade,
}: {
  categorias: CategoriaDaVitrine[];
  cidade: string;
}) {
  return (
    <FlatList
      data={categorias}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(categoria) => categoria.slug}
      contentContainerStyle={estilos.faixa}
      renderItem={({ item }) => {
        const chave = chaveDaCategoria(item.slug, item.segmento);
        const tom = coresDaCategoria[chave];
        return (
          <Toque
            accessibilityLabel={item.nome}
            onPress={() =>
              router.push({
                pathname: '/categoria/[cidade]/[categoria]',
                params: { cidade, categoria: item.slug },
              })
            }
            style={estilos.categoria}
          >
            <View style={[estilos.categoriaIcone, { backgroundColor: tom.fundo }]}>
              <Image
                source={icone3dDaCategoria(item.slug, chave)}
                style={estilos.categoriaImagem}
                contentFit="contain"
              />
            </View>
            <T v="legenda" numberOfLines={1} style={estilos.centro}>
              {item.nome}
            </T>
          </Toque>
        );
      }}
    />
  );
}

/** Bloco da home: título, uma frase e "ver tudo", com o conteúdo embaixo. */
export function Secao({
  titulo,
  subtitulo,
  verTudo,
  fundo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  verTudo?: () => void;
  /** Cartão cinza em volta, como as vitrines de produto. */
  fundo?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[estilos.secao, fundo && estilos.secaoComFundo]}>
      <View style={[estilos.secaoTopo, !fundo && { paddingHorizontal: espaco.l }]}>
        <View style={estilos.flex}>
          <T v="titulo2">{titulo}</T>
          {subtitulo ? (
            <T v="legenda" cor={cores.textoMedio}>
              {subtitulo}
            </T>
          ) : null}
        </View>
        {verTudo ? (
          <Toque
            accessibilityLabel={`Ver tudo: ${titulo}`}
            onPress={verTudo}
            style={estilos.verTudo}
          >
            <T v="corpoForte" cor={cores.marca}>
              ver tudo
            </T>
            <ChevronRight size={18} color={cores.marca} />
          </Toque>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Atalho em cartão branco: "Pedir por lista" e afins. */
export function CartaoDeAtalho({
  Icone,
  titulo,
  texto,
  aoTocar,
}: {
  Icone: Icone3d;
  titulo: string;
  texto: string;
  aoTocar: () => void;
}) {
  return (
    <Toque
      accessibilityLabel={titulo}
      encolhe={0.985}
      onPress={aoTocar}
      style={[estilos.atalho, elevacao.baixa]}
    >
      <Image source={Icone} style={estilos.atalhoIcone} contentFit="contain" />
      <View style={estilos.flex}>
        <T v="titulo3">{titulo}</T>
        <T v="legenda" cor={cores.textoMedio}>
          {texto}
        </T>
      </View>
      <ChevronRight size={22} color={cores.marca} />
    </Toque>
  );
}

/** Produto na vitrine: foto grande, preço em destaque, nome e loja. */
export function CartaoDeProduto({
  produto,
  cidade,
}: {
  produto: ProdutoDaVitrine;
  cidade: string;
}) {
  const chave = chaveDaCategoria(produto.categoriaSlug, produto.segmento);
  return (
    <Toque
      accessibilityLabel={`${produto.nome}, ${dinheiro(produto.precoCents)}`}
      onPress={() =>
        router.push({ pathname: '/produto/[cidade]/[id]', params: { cidade, id: produto.id } })
      }
      style={estilos.produto}
    >
      <Foto
        url={produto.imagemUrl}
        categoria={chave}
        reserva={icone3dDaCategoria(produto.categoriaSlug, chave)}
        estilo={estilos.produtoFoto}
      />
      <T v="titulo3" cor={cores.sucesso} style={estilos.produtoPreco}>
        {dinheiro(produto.precoCents)}
      </T>
      {produto.precoDeCents && produto.precoDeCents > produto.precoCents ? (
        <View style={estilos.linha}>
          <Selo
            texto={`-${dinheiro(produto.precoDeCents - produto.precoCents)}`}
            cor={cores.textoNaCor}
            fundo={cores.sucesso}
          />
          <T v="legenda" cor={cores.textoMedio} style={estilos.riscado}>
            {dinheiro(produto.precoDeCents)}
          </T>
        </View>
      ) : null}
      <T v="corpo" numberOfLines={2}>
        {produto.nome}
      </T>
      <T v="legenda" cor={cores.textoMedio} numberOfLines={1}>
        {produto.lojaNome}
      </T>
    </Toque>
  );
}

/** Loja em destaque: só a logo e o nome, em cartão branco. */
export function LogoDeLoja({ loja, cidade }: { loja: LojaDaVitrine; cidade: string }) {
  const chave = chaveDaCategoria(loja.categoriaSlug, loja.segmento);
  return (
    <Toque
      accessibilityLabel={loja.nome}
      onPress={() =>
        router.push({ pathname: '/loja/[cidade]/[loja]', params: { cidade, loja: loja.slug } })
      }
      style={[estilos.logoCartao, !loja.aberta && estilos.lojaFechada]}
    >
      <Foto
        url={loja.logoUrl ?? loja.capaUrl}
        categoria={chave}
        reserva={icone3dDaCategoria(loja.categoriaSlug, chave)}
        estilo={estilos.logoFoto}
      />
      <T v="legenda" numberOfLines={2} style={estilos.centro}>
        {loja.nome}
      </T>
    </Toque>
  );
}

/** Um banner tocável numa proporção fixa: faixa larga ou cartão em pé. */
function BannerTocavel({
  banner,
  cidade,
  largura,
  altura,
}: {
  banner: BannerDaVitrine;
  cidade: string;
  largura: number | `${number}%`;
  altura: number;
}) {
  const contarClique = useMutation({
    mutationFn: (id: string) => chamar(`banners/${id}/clique`, { metodo: 'POST' }),
  });
  return (
    <Toque
      accessibilityLabel={banner.titulo}
      encolhe={0.985}
      onPress={() => {
        contarClique.mutate(banner.id);
        abrirBanner(banner, cidade);
      }}
      style={[estilos.banner, { width: largura, height: altura }]}
    >
      <Foto url={banner.imagemUrl} categoria="outros" estilo={StyleSheet.absoluteFill} />
    </Toque>
  );
}

function abrirVerTudo(destino: NonNullable<SecaoDaVitrine['verTudo']>, cidade: string) {
  if (destino.lojaSlug) {
    router.push({ pathname: '/loja/[cidade]/[loja]', params: { cidade, loja: destino.lojaSlug } });
  } else if (destino.categoriaSlug) {
    router.push({
      pathname: '/categoria/[cidade]/[categoria]',
      params: { cidade, categoria: destino.categoriaSlug },
    });
  } else if (destino.linkUrl) {
    void Linking.openURL(destino.linkUrl);
  }
}

/**
 * Seção de campanha montada no painel. Tipo que esta versão não conhece não
 * aparece: o painel pode ganhar formato novo sem quebrar o app instalado.
 */
export function SecaoDeCampanha({ secao, cidade }: { secao: SecaoDaVitrine; cidade: string }) {
  const { width } = useWindowDimensions();
  const destino = secao.verTudo;
  const verTudo =
    destino && (destino.lojaSlug || destino.categoriaSlug || destino.linkUrl)
      ? () => abrirVerTudo(destino, cidade)
      : undefined;

  // Dentro do cartão cinza: margem da tela e o respiro interno.
  const larguraNoCartao = width - espaco.l * 4;

  switch (secao.tipo) {
    case 'PRODUTOS':
      if (secao.produtos.length === 0) return null;
      return (
        <Secao
          titulo={secao.titulo}
          subtitulo={secao.subtitulo ?? undefined}
          verTudo={verTudo}
          fundo
        >
          {secao.banner ? (
            <BannerTocavel
              banner={secao.banner}
              cidade={cidade}
              largura="100%"
              altura={Math.round(larguraNoCartao / 3)}
            />
          ) : null}
          <FlatList
            data={secao.produtos}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(produto) => produto.id}
            contentContainerStyle={{ gap: espaco.m }}
            renderItem={({ item }) => <CartaoDeProduto produto={item} cidade={cidade} />}
          />
        </Secao>
      );
    case 'COLECOES':
      if (secao.banners.length === 0) return null;
      return (
        <Secao titulo={secao.titulo} subtitulo={secao.subtitulo ?? undefined} verTudo={verTudo}>
          <FlatList
            data={secao.banners}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(banner) => banner.id}
            contentContainerStyle={estilos.faixa}
            renderItem={({ item }) => (
              <BannerTocavel banner={item} cidade={cidade} largura={150} altura={200} />
            )}
          />
        </Secao>
      );
    case 'FAIXA':
      if (!secao.banner) return null;
      return (
        <View style={{ paddingHorizontal: espaco.l }}>
          <BannerTocavel
            banner={secao.banner}
            cidade={cidade}
            largura="100%"
            altura={Math.round((width - espaco.l * 2) / 3)}
          />
        </View>
      );
    case 'LOJAS':
      if (secao.lojas.length === 0) return null;
      return (
        <Secao titulo={secao.titulo} subtitulo={secao.subtitulo ?? undefined} verTudo={verTudo}>
          <FlatList
            data={secao.lojas}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(loja) => loja.id}
            contentContainerStyle={estilos.faixa}
            renderItem={({ item }) => <LogoDeLoja loja={item} cidade={cidade} />}
          />
        </Secao>
      );
    default:
      return null;
  }
}

/** `agrupada`: linha dentro de uma lista com divisórias; sem ela, cartão solto. */
export function CartaoDeLoja({
  loja,
  cidade,
  agrupada,
}: {
  loja: LojaDaVitrine;
  cidade: string;
  agrupada?: boolean;
}) {
  const chave = chaveDaCategoria(loja.categoriaSlug, loja.segmento);

  return (
    <Toque
      accessibilityLabel={`${loja.nome}, ${loja.aberta ? 'aberta' : 'fechada'}`}
      encolhe={0.985}
      onPress={() =>
        router.push({ pathname: '/loja/[cidade]/[loja]', params: { cidade, loja: loja.slug } })
      }
      style={[
        estilos.loja,
        !agrupada && [estilos.lojaSolta, elevacao.baixa],
        !loja.aberta && estilos.lojaFechada,
      ]}
    >
      <Foto
        url={loja.logoUrl ?? loja.capaUrl}
        categoria={chave}
        reserva={icone3dDaCategoria(loja.categoriaSlug, chave)}
        estilo={estilos.lojaFoto}
      />
      <View style={estilos.lojaDados}>
        <T v="corpoForte" numberOfLines={1}>
          {loja.nome}
        </T>
        <View style={estilos.linha}>
          <Star size={14} color={cores.amarelo} fill={cores.amarelo} />
          <T v="legenda" cor={cores.aviso}>
            {loja.avaliacoes ? loja.nota.toFixed(1) : 'Nova'}
          </T>
          <T v="legenda" cor={cores.textoMedio} numberOfLines={1} style={estilos.flex}>
            {` · ${loja.categoria} · ${loja.tempoMin}-${loja.tempoMax} min`}
          </T>
        </View>
        {loja.aberta ? (
          <T v="legenda" cor={loja.taxaGratis ? cores.sucesso : cores.textoMedio}>
            {loja.taxaGratis ? 'Entrega grátis' : `Entrega ${dinheiro(loja.taxaCents)}`}
          </T>
        ) : (
          <T v="legenda" cor={cores.perigo} numberOfLines={1}>
            {loja.rotuloHorario}
          </T>
        )}
      </View>
      {loja.patrocinada ? (
        <T v="mini" cor={cores.textoFraco} style={estilos.patrocinada}>
          Patrocinado
        </T>
      ) : null}
    </Toque>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  centro: { textAlign: 'center' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inclinado: { transform: [{ rotate: '-4deg' }] },
  banner: { borderRadius: raio.folha, overflow: 'hidden', backgroundColor: cores.superficieAlta },
  bannerDaMarca: { flexDirection: 'row', alignItems: 'center' },
  bannerDaMarcaTexto: { flex: 1, paddingLeft: espaco.l, gap: espaco.xs },
  entregador: { width: '52%', height: '112%' },
  cupom: { position: 'absolute', left: espaco.m, bottom: espaco.m },
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: espaco.m },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.linha },
  pontoAtivo: { width: 18, backgroundColor: cores.marca },
  faixa: { paddingHorizontal: espaco.l, gap: espaco.s },
  categoria: { width: 76, alignItems: 'center', gap: espaco.s },
  categoriaImagem: { width: 50, height: 50 },
  categoriaIcone: {
    width: 64,
    height: 64,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secao: { gap: espaco.m },
  secaoComFundo: {
    marginHorizontal: espaco.l,
    padding: espaco.l,
    borderRadius: raio.folha,
    backgroundColor: cores.superficie,
  },
  secaoTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.m },
  verTudo: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  atalho: {
    marginHorizontal: espaco.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.l,
    borderRadius: raio.folha,
    backgroundColor: cores.superficie,
  },
  atalhoIcone: {
    width: 52,
    height: 52,
    borderRadius: raio.grande,
    backgroundColor: cores.marcaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  produto: { width: 148, gap: 2 },
  produtoFoto: { width: 148, height: 148, borderRadius: raio.grande },
  produtoPreco: { marginTop: espaco.s },
  riscado: { textDecorationLine: 'line-through' },
  logoCartao: {
    width: 108,
    padding: espaco.s,
    gap: espaco.s,
    alignItems: 'center',
    borderRadius: raio.grande,
    backgroundColor: cores.superficie,
  },
  logoFoto: { width: 88, height: 88, borderRadius: raio.grande },
  loja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingVertical: espaco.m,
    paddingHorizontal: espaco.l,
    backgroundColor: cores.superficie,
  },
  lojaSolta: { marginHorizontal: espaco.l, borderRadius: raio.folha },
  lojaFechada: { opacity: 0.6 },
  lojaFoto: {
    width: 60,
    height: 60,
    borderRadius: raio.grande,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  lojaDados: { flex: 1, gap: 2 },
  patrocinada: { position: 'absolute', top: espaco.s, right: espaco.l },
});
