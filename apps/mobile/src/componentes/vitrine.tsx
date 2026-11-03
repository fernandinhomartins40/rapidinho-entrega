import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronRight, Star } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import type {
  BannerDaVitrine,
  CategoriaDaVitrine,
  LojaDaVitrine,
  ProdutoDaVitrine,
} from '@contrato';
import { chamar } from '@/api/cliente';
import { chaveDaCategoria, iconeDaCategoria } from '@/tema/categorias';
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
      style={[estilos.banner, estilos.bannerDaMarca, { height: altura }, elevacao.alta]}
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
  const altura = Math.round(largura * 0.46);
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
              style={[estilos.banner, { height: altura }, elevacao.alta]}
            >
              <Foto url={item.imagemUrl} categoria="outros" estilo={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['transparent', 'rgba(28,26,46,0.85)']}
                style={estilos.bannerTexto}
              >
                {item.cupom ? (
                  <Selo texto={`CUPOM ${item.cupom}`} cor={cores.noite} fundo={cores.amarelo} />
                ) : null}
                <T v="titulo2" cor={cores.textoNaCor} numberOfLines={2}>
                  {item.titulo}
                </T>
              </LinearGradient>
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

/** Blocos coloridos de atalho: cada segmento com sua cor, ícone branco no meio. */
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
        const Icone = iconeDaCategoria(chave);
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
            <LinearGradient
              colors={coresDaCategoria[chave].degrade}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[estilos.categoriaIcone, elevacao.baixa]}
            >
              <Icone size={34} color={cores.textoNaCor} strokeWidth={2.2} />
            </LinearGradient>
            <T v="legenda" numberOfLines={1} style={estilos.centro}>
              {item.nome}
            </T>
          </Toque>
        );
      }}
    />
  );
}

/** Atalho grande em cartão: "Não sabe o que pedir?", "Pedir por lista". */
export function CartaoDeAtalho({
  Icone,
  titulo,
  texto,
  aoTocar,
  escuro,
  acao,
}: {
  Icone: typeof Star;
  titulo: string;
  texto: string;
  aoTocar: () => void;
  escuro?: boolean;
  acao?: string;
}) {
  return (
    <Toque
      accessibilityLabel={titulo}
      encolhe={0.985}
      onPress={aoTocar}
      style={[estilos.atalho, escuro && estilos.atalhoEscuro, elevacao.baixa]}
    >
      <LinearGradient
        colors={escuro ? degradeDoSol : coresDaCategoria.comida.degrade}
        style={estilos.atalhoIcone}
      >
        <Icone size={28} color={escuro ? cores.noite : cores.textoNaCor} strokeWidth={2.2} />
      </LinearGradient>
      <View style={estilos.flex}>
        <T v="titulo3" cor={escuro ? cores.amarelo : cores.texto}>
          {titulo}
        </T>
        <T v="legenda" cor={escuro ? cores.textoNaNoite : cores.textoMedio}>
          {texto}
        </T>
        {acao ? (
          <LinearGradient
            colors={degradeDoSol}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={estilos.atalhoAcao}
          >
            <T v="corpoForte" cor={cores.noite}>
              {acao}
            </T>
            <ChevronRight size={18} color={cores.noite} />
          </LinearGradient>
        ) : null}
      </View>
      {acao ? null : (
        <ChevronRight size={22} color={escuro ? cores.textoNaNoite : cores.textoMedio} />
      )}
    </Toque>
  );
}

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
      style={[estilos.produto, elevacao.baixa]}
    >
      <Foto
        url={produto.imagemUrl}
        categoria={chave}
        Icone={iconeDaCategoria(chave)}
        estilo={estilos.produtoFoto}
      />
      <View style={estilos.produtoTexto}>
        <T v="corpoForte" numberOfLines={2}>
          {produto.nome}
        </T>
        <T v="legenda" cor={cores.textoMedio} numberOfLines={1}>
          {produto.lojaNome}
        </T>
        <T v="titulo3" cor={cores.marca}>
          {dinheiro(produto.precoCents)}
        </T>
      </View>
    </Toque>
  );
}

export function CartaoDeLoja({ loja, cidade }: { loja: LojaDaVitrine; cidade: string }) {
  const chave = chaveDaCategoria(loja.categoriaSlug, loja.segmento);
  const Icone = iconeDaCategoria(chave);

  return (
    <Toque
      accessibilityLabel={`${loja.nome}, ${loja.aberta ? 'aberta' : 'fechada'}`}
      encolhe={0.985}
      onPress={() =>
        router.push({ pathname: '/loja/[cidade]/[loja]', params: { cidade, loja: loja.slug } })
      }
      style={[estilos.loja, elevacao.baixa, !loja.aberta && estilos.lojaFechada]}
    >
      <Foto
        url={loja.capaUrl ?? loja.logoUrl}
        categoria={chave}
        Icone={Icone}
        tamanhoDoIcone={40}
        estilo={estilos.lojaFoto}
      />
      <View style={estilos.lojaDados}>
        <T v="titulo3" numberOfLines={1}>
          {loja.nome}
        </T>
        <View style={estilos.linha}>
          <Star size={15} color={cores.amarelo} fill={cores.amarelo} />
          <T v="corpoForte">{loja.avaliacoes ? loja.nota.toFixed(1) : 'Nova'}</T>
          {loja.avaliacoes ? (
            <T v="legenda" cor={cores.textoMedio}>
              ({loja.avaliacoes})
            </T>
          ) : null}
        </View>
        <T v="legenda" cor={cores.textoMedio} numberOfLines={1}>
          {`${loja.categoria} · ${loja.tempoMin}-${loja.tempoMax} min`}
        </T>
        <T v="legenda" cor={loja.taxaGratis ? cores.sucesso : cores.textoMedio}>
          {loja.taxaGratis ? 'Entrega grátis' : `Taxa ${dinheiro(loja.taxaCents)}`}
        </T>
        {loja.aberta ? (
          <Selo texto="Aberta agora" cor={cores.sucesso} fundo={cores.sucessoClaro} />
        ) : (
          <Selo texto={loja.rotuloHorario} cor={cores.perigo} fundo={cores.perigoClaro} />
        )}
      </View>
      {loja.patrocinada ? (
        <View style={estilos.patrocinada}>
          <T v="mini" cor={cores.textoMedio}>
            Patrocinado
          </T>
        </View>
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
  bannerTexto: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: espaco.l,
    paddingTop: espaco.xxl,
    gap: espaco.xs,
  },
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: espaco.m },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.linha },
  pontoAtivo: { width: 22, backgroundColor: cores.marca },
  faixa: { paddingHorizontal: espaco.l, gap: espaco.m, paddingVertical: espaco.xs },
  categoria: { width: 76, alignItems: 'center', gap: espaco.s },
  categoriaIcone: {
    width: 72,
    height: 72,
    borderRadius: raio.folha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalho: {
    marginHorizontal: espaco.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    padding: espaco.l,
    borderRadius: raio.folha,
    backgroundColor: cores.superficie,
  },
  atalhoEscuro: { backgroundColor: cores.noite },
  atalhoIcone: {
    width: 60,
    height: 60,
    borderRadius: raio.grande,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhoAcao: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    marginTop: espaco.s,
    paddingHorizontal: espaco.l,
    minHeight: 44,
    borderRadius: raio.total,
  },
  produto: {
    width: 168,
    borderRadius: raio.grande,
    backgroundColor: cores.superficie,
    overflow: 'hidden',
  },
  produtoFoto: { width: 168, height: 120 },
  produtoTexto: { padding: espaco.m, gap: 2 },
  loja: {
    marginHorizontal: espaco.l,
    flexDirection: 'row',
    gap: espaco.m,
    padding: espaco.m,
    borderRadius: raio.folha,
    backgroundColor: cores.superficie,
  },
  lojaFechada: { opacity: 0.7 },
  lojaFoto: { width: 112, height: 112, borderRadius: raio.grande },
  lojaDados: { flex: 1, gap: 3, justifyContent: 'center' },
  patrocinada: { position: 'absolute', top: espaco.s, right: espaco.m },
});
