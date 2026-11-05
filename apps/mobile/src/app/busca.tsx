import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Search, SearchX, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import type { ResultadoDaBusca } from '@contrato';
import { useCidade } from '@/api/cidade';
import { chamar, ErroDaApi } from '@/api/cliente';
import { dinheiro, EstadoDaTela, ErroDaTela, Esqueleto, Foto, T, Toque } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { TopoDaTela } from '@/componentes/topo';
import { CartaoDeLoja } from '@/componentes/vitrine';
import { cores, elevacao, espaco, fontes, raio, toqueMinimo } from '@/tema/tokens';

const COLUNA_GAP = espaco.m;

const SUGESTOES = ['Pizza', 'Hambúrguer', 'Açaí', 'Arroz', 'Fralda', 'Refrigerante'];

export default function Busca() {
  const folga = useFolgaInferior(espaco.xxl);
  const { cidade } = useCidade();
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');
  // Duas colunas de cartão com foto: produto se vende pela imagem.
  const largura = (useWindowDimensions().width - espaco.l * 2 - COLUNA_GAP) / 2;

  // Espera a pessoa parar de digitar: cada letra não vira uma busca.
  useEffect(() => {
    const espera = setTimeout(() => setTermo(texto.trim()), 350);
    return () => clearTimeout(espera);
  }, [texto]);

  const busca = useQuery({
    queryKey: ['busca', cidade, termo],
    queryFn: () =>
      chamar<ResultadoDaBusca>(`cidades/${cidade}/busca?q=${encodeURIComponent(termo)}`),
    enabled: !!cidade && termo.length >= 2,
  });

  const dados = busca.data;
  const vazio = dados && dados.lojas.length === 0 && dados.produtos.length === 0;

  return (
    <View style={estilos.tela}>
      <TopoDaTela voltar titulo="Buscar" Icone={Search}>
        <View style={[estilos.campo, elevacao.alta]}>
          <Search size={20} color={cores.marcaEscura} />
          <TextInput
            autoFocus
            value={texto}
            onChangeText={setTexto}
            placeholder="Loja, prato ou produto"
            placeholderTextColor={cores.textoFraco}
            returnKeyType="search"
            accessibilityLabel="Buscar loja, prato ou produto"
            style={estilos.entrada}
          />
          {texto ? (
            <Toque
              accessibilityLabel="Limpar busca"
              onPress={() => setTexto('')}
              style={estilos.limpar}
            >
              <X size={18} color={cores.textoMedio} />
            </Toque>
          ) : null}
        </View>
      </TopoDaTela>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[estilos.corpo, { paddingBottom: folga }]}
      >
        {termo.length < 2 ? (
          <View style={estilos.sugestoes}>
            <T v="titulo3">Mais buscados</T>
            <View style={estilos.chips}>
              {SUGESTOES.map((s) => (
                <Toque
                  key={s}
                  onPress={() => setTexto(s)}
                  style={estilos.chip}
                  accessibilityLabel={s}
                >
                  <T v="corpoForte" cor={cores.marcaEscura}>
                    {s}
                  </T>
                </Toque>
              ))}
            </View>
          </View>
        ) : busca.isError ? (
          <ErroDaTela
            mensagem={busca.error instanceof ErroDaApi ? busca.error.message : 'Tente de novo.'}
            aoTentar={() => void busca.refetch()}
          />
        ) : !dados ? (
          <View style={estilos.esqueleto}>
            {[0, 1, 2].map((i) => (
              <Esqueleto key={i} estilo={{ height: 88 }} />
            ))}
          </View>
        ) : vazio ? (
          <EstadoDaTela
            Icone={SearchX}
            titulo="Nada por aqui"
            descricao={`Não achamos "${termo}" nas lojas da sua cidade. Tente outra palavra.`}
          />
        ) : (
          <>
            {dados.produtos.length > 0 ? (
              <View style={estilos.secao}>
                <T v="titulo3" style={estilos.margem}>
                  Produtos
                </T>
                <View style={estilos.grade}>
                  {dados.produtos.map((p) => (
                    <Toque
                      key={p.id}
                      encolhe={0.98}
                      accessibilityLabel={`${p.nome}, ${dinheiro(p.precoCents)}, em ${p.lojaNome}`}
                      onPress={() =>
                        router.push({
                          pathname: '/produto/[cidade]/[id]',
                          params: { cidade: cidade!, id: p.id },
                        })
                      }
                      style={[estilos.produto, elevacao.baixa, { width: largura }]}
                    >
                      <Foto url={p.imagemUrl} estilo={{ width: largura, height: largura }} />
                      <View style={estilos.produtoDados}>
                        <T v="titulo3" cor={cores.sucesso}>
                          {dinheiro(p.precoCents)}
                          {p.porPeso ? '/kg' : ''}
                        </T>
                        <T v="corpo" numberOfLines={2}>
                          {p.nome}
                        </T>
                        <T v="legenda" cor={cores.textoMedio} numberOfLines={1}>
                          {p.lojaNome}
                        </T>
                      </View>
                    </Toque>
                  ))}
                </View>
              </View>
            ) : null}
            {dados.lojas.length > 0 ? (
              <View style={estilos.secao}>
                <T v="titulo3" style={estilos.margem}>
                  Lojas
                </T>
                {dados.lojas.map((loja) => (
                  <CartaoDeLoja key={loja.id} loja={loja} cidade={cidade!} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  campo: {
    minHeight: toqueMinimo + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    paddingLeft: espaco.l,
    borderRadius: raio.total,
    backgroundColor: cores.superficie,
  },
  entrada: { flex: 1, fontFamily: fontes.corpo, fontSize: 16, color: cores.texto },
  limpar: {
    width: toqueMinimo,
    height: toqueMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpo: { paddingTop: espaco.l, paddingBottom: espaco.xxl, gap: espaco.xl, flexGrow: 1 },
  sugestoes: { paddingHorizontal: espaco.l, gap: espaco.m },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.s },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: espaco.l,
    borderRadius: raio.total,
    backgroundColor: cores.marcaClara,
  },
  esqueleto: { paddingHorizontal: espaco.l, gap: espaco.m },
  secao: { gap: espaco.s },
  margem: { paddingHorizontal: espaco.l },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: COLUNA_GAP, paddingHorizontal: espaco.l },
  produto: { borderRadius: raio.grande, overflow: 'hidden', backgroundColor: cores.superficie },
  produtoDados: { padding: espaco.m, gap: 2 },
});
