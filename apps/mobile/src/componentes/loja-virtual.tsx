import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ProdutoDoCardapio } from '@contrato';
import { type Icone3d } from '@/tema/icones';
import { cores, elevacao, espaco, raio, type ChaveDaCategoria } from '@/tema/tokens';
import { dinheiro, Foto, Selo, T, Toque } from './base';

/** Banner da página da loja: a promoção do lojista ou as ofertas que ela já tem. */
export interface BannerDaLoja {
  id: string;
  titulo: string;
  subtitulo: string | null;
  imagemUrl: string | null;
  aoTocar: () => void;
}

/** O próximo banner aparece pela metade, para mostrar que há mais para ver. */
export function BannersDaLoja({ banners }: { banners: BannerDaLoja[] }) {
  const { width } = useWindowDimensions();
  const largura = banners.length > 1 ? width - espaco.l * 2 - espaco.xl : width - espaco.l * 2;
  const altura = Math.round(largura * 0.46);

  return (
    <FlatList
      data={banners}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(banner) => banner.id}
      snapToInterval={largura + espaco.m}
      decelerationRate="fast"
      contentContainerStyle={estilos.faixaDeBanners}
      renderItem={({ item }) => (
        <Toque
          accessibilityLabel={item.titulo}
          encolhe={0.985}
          onPress={item.aoTocar}
          style={[estilos.banner, { width: largura, height: altura }]}
        >
          {item.imagemUrl ? (
            <>
              <Foto url={item.imagemUrl} estilo={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.72)']}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <LinearGradient
              colors={['#FF7A1A', '#E6192B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View style={estilos.bannerTexto}>
            <T v="titulo2" cor={cores.textoNaCor} numberOfLines={2}>
              {item.titulo}
            </T>
            {item.subtitulo ? (
              <T v="legenda" cor={cores.textoNaCor} numberOfLines={2}>
                {item.subtitulo}
              </T>
            ) : null}
          </View>
        </Toque>
      )}
    />
  );
}

/** Produto como numa loja online: foto grande, desconto, preço e o "+" para levar. */
export function CartaoDoProduto({
  produto,
  cidade,
  categoria,
  reserva,
  largura,
  naSacola,
  podeAdicionar,
  aoAdicionar,
}: {
  produto: ProdutoDoCardapio;
  cidade: string;
  categoria: ChaveDaCategoria;
  reserva: Icone3d;
  largura: number;
  naSacola: number;
  /** Loja aberta. Produto com escolhas ou por peso sempre abre a própria página. */
  podeAdicionar: boolean;
  aoAdicionar: () => void;
}) {
  const desconto = produto.precoDeCents
    ? Math.round((1 - produto.precoCents / produto.precoDeCents) * 100)
    : 0;
  const direto =
    podeAdicionar && produto.disponivel && !produto.porPeso && produto.temOpcoes === false;

  return (
    <Toque
      encolhe={0.98}
      disabled={!produto.disponivel}
      accessibilityLabel={`${produto.nome}, ${dinheiro(produto.precoCents)}`}
      onPress={() =>
        router.push({ pathname: '/produto/[cidade]/[id]', params: { cidade, id: produto.id } })
      }
      style={[estilos.cartao, { width: largura }, !produto.disponivel && estilos.esgotado]}
    >
      <View>
        <Foto
          url={produto.imagemUrl}
          categoria={categoria}
          reserva={reserva}
          estilo={[estilos.foto, { height: largura }]}
        />
        {desconto > 0 ? (
          <View style={estilos.desconto}>
            <Selo texto={`-${desconto}%`} cor={cores.textoNaCor} fundo={cores.perigo} />
          </View>
        ) : null}
        {direto ? (
          <Toque
            accessibilityLabel={`Colocar ${produto.nome} na sacola`}
            onPress={aoAdicionar}
            style={[estilos.mais, elevacao.baixa, naSacola > 0 && estilos.maisComItens]}
          >
            {naSacola > 0 ? (
              <T v="corpoForte" cor={cores.textoNaCor}>
                {naSacola}
              </T>
            ) : (
              <Plus size={22} color={cores.textoNaCor} strokeWidth={3} />
            )}
          </Toque>
        ) : null}
      </View>
      <View style={estilos.cartaoTexto}>
        <T v="titulo3" cor={cores.marcaEscura}>
          {dinheiro(produto.precoCents)}
          {produto.porPeso ? '/kg' : ''}
        </T>
        {produto.precoDeCents ? (
          <T v="legenda" cor={cores.textoFraco} style={estilos.riscado}>
            {dinheiro(produto.precoDeCents)}
          </T>
        ) : null}
        <T v="legenda" numberOfLines={2}>
          {produto.nome}
        </T>
        {!produto.disponivel ? (
          <Selo texto="Esgotado" cor={cores.textoMedio} fundo={cores.superficieAlta} />
        ) : null}
      </View>
    </Toque>
  );
}

const TAMANHO_DO_MAIS = 44;

const estilos = StyleSheet.create({
  faixaDeBanners: { paddingHorizontal: espaco.l, gap: espaco.m },
  banner: { borderRadius: raio.grande, overflow: 'hidden', justifyContent: 'flex-end' },
  bannerTexto: { padding: espaco.l, gap: 2 },
  cartao: {
    borderRadius: raio.grande,
    backgroundColor: cores.superficie,
    overflow: 'hidden',
  },
  esgotado: { opacity: 0.5 },
  foto: { width: '100%', borderRadius: 0 },
  desconto: { position: 'absolute', top: espaco.s, left: espaco.s },
  mais: {
    position: 'absolute',
    right: espaco.s,
    bottom: espaco.s,
    width: TAMANHO_DO_MAIS,
    height: TAMANHO_DO_MAIS,
    borderRadius: TAMANHO_DO_MAIS / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.marca,
  },
  maisComItens: { backgroundColor: cores.sucesso },
  cartaoTexto: { padding: espaco.m, gap: 2 },
  riscado: { textDecorationLine: 'line-through' },
});
