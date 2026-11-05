import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Coffee,
  Flame,
  Pill,
  Store,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type {
  EntradaListaNoCarrinho,
  LojaSugerida,
  PedidoMontado,
  ProdutoSugerido,
  RespostaListaNoCarrinho,
} from '@contrato';
import { avisarErro, useExigirLogin } from '@/api/carrinho';
import { useCidade } from '@/api/cidade';
import { chamar } from '@/api/cliente';
import { Botao, dinheiro, Selo, T, Toque } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { Cartao } from '@/componentes/formulario';
import { TopoDaTela } from '@/componentes/topo';
import { cores, elevacao, espaco, fontes, raio } from '@/tema/tokens';

const ENTREGADOR = require('@/assets/marca/entregador.png');

const IDEIAS: { rotulo: string; Icone: LucideIcon; texto: string }[] = [
  {
    rotulo: 'Café da manhã',
    Icone: Coffee,
    texto: '1 pão francês 10 unidades\n1 leite 1 litro\n1 café 500g\n1 manteiga',
  },
  {
    rotulo: 'Churrasco',
    Icone: Flame,
    texto: '2 kg de picanha\n1 kg de linguiça\n1 carvão\n1 refrigerante 2 litros',
  },
  { rotulo: 'Farmácia', Icone: Pill, texto: '1 escova de dente\n1 creme dental\n1 protetor solar' },
  { rotulo: 'Jantar', Icone: UtensilsCrossed, texto: '1 pizza grande\n1 refrigerante 2 litros' },
];

type Escolha = { lojaId: string; produtoId: string };
type Opcao = { loja: LojaSugerida; produto: ProdutoSugerido };
type Linha = { item: PedidoMontado['itens'][number]; opcao: Opcao; marcado: boolean };

/** Quantas opções a comparação mostra, já da mais barata para a mais cara. */
const OPCOES_NA_COMPARACAO = 10;

/** Por peso, o preço é do quilo: vale o que vai na balança. */
function totalDaLinha({ item, opcao }: Pick<Linha, 'item' | 'opcao'>): number {
  const { precoCents, porPeso, gramas } = opcao.produto;
  const unidade = porPeso && gramas ? Math.round((precoCents * gramas) / 1000) : precoCents;
  return unidade * item.quantidade;
}

/** Todas as marcas de cada item, em todas as lojas abertas, da mais barata à mais cara. */
function opcoesPorItem(pedido: PedidoMontado): Map<number, Opcao[]> {
  const mapa = new Map<number, Opcao[]>();
  for (const item of pedido.itens) {
    const lista = pedido.lojas
      .flatMap((loja) =>
        (loja.produtos[item.indice] ?? [])
          .filter((produto) => !produto.precisaEscolher)
          .map((produto) => ({ loja, produto })),
      )
      .sort((a, b) => a.produto.precoCents - b.produto.precoCents);
    if (lista.length) mapa.set(item.indice, lista);
  }
  return mapa;
}

/** O plano diz de qual loja sai cada item; o primeiro candidato é o mais provável. */
function escolhasDoPlano(pedido: PedidoMontado): Record<number, Escolha> {
  const escolhas: Record<number, Escolha> = {};
  for (const item of pedido.itens) {
    const loja = pedido.lojas.find((l) => l.id === pedido.plano[item.indice]);
    const produto = loja?.produtos[item.indice]?.find((p) => !p.precisaEscolher);
    if (loja && produto) escolhas[item.indice] = { lojaId: loja.id, produtoId: produto.id };
  }
  return escolhas;
}

export default function PedidoPorLista() {
  const folga = useFolgaInferior(espaco.xxl);
  const { cidade } = useCidade();
  const consultas = useQueryClient();
  const exigirLogin = useExigirLogin();
  const [texto, setTexto] = useState('');

  const montar = useMutation({
    mutationFn: () =>
      chamar<PedidoMontado>(`cidades/${cidade}/pedir`, { metodo: 'POST', corpo: { texto } }),
    onError: avisarErro,
  });

  const levar = useMutation({
    mutationFn: (entrada: EntradaListaNoCarrinho) =>
      chamar<RespostaListaNoCarrinho>(`cidades/${cidade}/pedir/carrinho`, {
        metodo: 'POST',
        corpo: entrada,
      }),
    onSuccess: () => {
      void consultas.invalidateQueries({ queryKey: ['carrinho'] });
      router.replace('/sacola');
    },
    onError: avisarErro,
  });

  const pedido = montar.data;
  const [escolhas, setEscolhas] = useState<Record<number, Escolha>>({});
  const [fora, setFora] = useState<Set<number>>(new Set());
  const [comparando, setComparando] = useState<number | null>(null);

  // Cada pedido novo começa pelo plano do servidor (menos lojas), tudo marcado.
  const [pedidoVisto, setPedidoVisto] = useState<PedidoMontado | undefined>();
  if (pedido !== pedidoVisto) {
    setPedidoVisto(pedido);
    setEscolhas(pedido ? escolhasDoPlano(pedido) : {});
    setFora(new Set());
    setComparando(null);
  }

  const opcoes = useMemo(
    () => (pedido ? opcoesPorItem(pedido) : new Map<number, Opcao[]>()),
    [pedido],
  );

  const grupos = useMemo(() => {
    if (!pedido) return [];
    const porLoja = new Map<string, { loja: LojaSugerida; linhas: Linha[] }>();
    for (const item of pedido.itens) {
      const escolha = escolhas[item.indice];
      const opcao = opcoes
        .get(item.indice)
        ?.find((o) => o.loja.id === escolha?.lojaId && o.produto.id === escolha?.produtoId);
      if (!opcao) continue;
      const grupo = porLoja.get(opcao.loja.id) ?? { loja: opcao.loja, linhas: [] };
      grupo.linhas.push({ item, opcao, marcado: !fora.has(item.indice) });
      porLoja.set(opcao.loja.id, grupo);
    }
    return [...porLoja.values()].sort((a, b) => b.linhas.length - a.linhas.length);
  }, [pedido, escolhas, opcoes, fora]);

  const marcados = grupos.flatMap((grupo) => grupo.linhas.filter((linha) => linha.marcado));
  const totalCents = marcados.reduce((soma, linha) => soma + totalDaLinha(linha), 0);

  const alternar = (indice: number) =>
    setFora((atual) => {
      const novo = new Set(atual);
      if (novo.has(indice)) novo.delete(indice);
      else novo.add(indice);
      return novo;
    });

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: folga }}
      >
        <TopoDaTela voltar titulo="Pedido por lista" Icone={ClipboardList}>
          <View style={estilos.chamada}>
            <View style={{ flex: 1, gap: espaco.xs }}>
              <T v="titulo2">Diga o que você precisa.</T>
              <T v="titulo3" cor={cores.marca}>
                A gente acha e monta.
              </T>
              <T v="legenda" cor={cores.textoMedio}>
                Escreva sua lista, um item por linha. Procuramos nas lojas abertas e montamos o
                pedido no menor número de lojas.
              </T>
            </View>
            <Image source={ENTREGADOR} style={estilos.entregador} contentFit="contain" />
          </View>
        </TopoDaTela>

        <View style={estilos.corpo}>
          <View style={[estilos.caixa, elevacao.alta]}>
            <TextInput
              multiline
              accessibilityLabel="Sua lista de compras"
              placeholder={'2 arroz 5kg\n1 dipirona\nmeio quilo de carne moída\n1 coca 2 litros'}
              placeholderTextColor={cores.textoFraco}
              value={texto}
              onChangeText={setTexto}
              style={estilos.entrada}
              textAlignVertical="top"
            />
            <Botao
              titulo="Montar pedido"
              desativado={texto.trim().length < 3}
              carregando={montar.isPending}
              aoTocar={() => montar.mutate()}
            />
          </View>

          {!pedido ? (
            <>
              <T v="titulo3">Sem ideia? Comece por um destes</T>
              <View style={estilos.ideias}>
                {IDEIAS.map(({ rotulo, Icone, texto: exemplo }) => (
                  <Toque
                    key={rotulo}
                    accessibilityLabel={rotulo}
                    onPress={() => setTexto(exemplo)}
                    style={[estilos.ideia, elevacao.baixa]}
                  >
                    <Icone size={26} color={cores.marca} />
                    <T v="legenda" style={{ textAlign: 'center' }}>
                      {rotulo}
                    </T>
                  </Toque>
                ))}
              </View>
            </>
          ) : (
            <>
              {grupos.length ? (
                <T v="legenda" cor={cores.textoMedio}>
                  Desmarque o que não quiser. Toque em “comparar marcas” para ver as opções do mais
                  barato ao mais caro.
                </T>
              ) : null}
              {grupos.map(({ loja, linhas }) => {
                const subtotal = linhas
                  .filter((linha) => linha.marcado)
                  .reduce((soma, linha) => soma + totalDaLinha(linha), 0);
                const faltaParaMinimo = subtotal > 0 ? loja.minimoCents - subtotal : 0;
                return (
                  <Cartao key={loja.id}>
                    <View style={estilos.lojaTopo}>
                      <Store size={20} color={cores.marca} />
                      <View style={{ flex: 1 }}>
                        <T v="titulo3" numberOfLines={1}>
                          {loja.nome}
                        </T>
                        <T v="legenda" cor={cores.textoMedio}>
                          {`${loja.tempoMin} min · `}
                          {loja.taxaGratis
                            ? 'entrega grátis'
                            : `entrega ${dinheiro(loja.taxaCents)}`}
                        </T>
                      </View>
                      <T v="corpoForte">{dinheiro(subtotal)}</T>
                    </View>

                    {linhas.map((linha) => {
                      const { item, opcao, marcado } = linha;
                      const doItem: Opcao[] = opcoes.get(item.indice) ?? [];
                      const aberto = comparando === item.indice;
                      return (
                        <View key={item.indice} style={estilos.linhaDoItem}>
                          <View style={estilos.achado}>
                            <Toque
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: marcado }}
                              accessibilityLabel={`${opcao.produto.nome}: ${marcado ? 'na sacola' : 'fora da sacola'}`}
                              onPress={() => alternar(item.indice)}
                              style={[estilos.marca, marcado && estilos.marcaLigada]}
                            >
                              {marcado ? <Check size={18} color={cores.textoNaCor} /> : null}
                            </Toque>
                            <View style={{ flex: 1, opacity: marcado ? 1 : 0.5 }}>
                              <T v="corpoForte">
                                {item.quantidade}x {opcao.produto.nome}
                              </T>
                              <T v="legenda" cor={cores.textoMedio}>
                                você pediu “{item.original}”
                              </T>
                            </View>
                            <T v="corpoForte" style={{ opacity: marcado ? 1 : 0.5 }}>
                              {dinheiro(totalDaLinha(linha))}
                            </T>
                          </View>

                          {doItem.length > 1 ? (
                            <Toque
                              accessibilityLabel={`Comparar marcas de ${item.original}`}
                              onPress={() => setComparando(aberto ? null : item.indice)}
                              style={estilos.comparar}
                            >
                              <T v="legenda" cor={cores.marca}>
                                {aberto
                                  ? 'fechar comparação'
                                  : `comparar ${doItem.length} marcas · a partir de ${dinheiro(doItem[0]!.produto.precoCents)}`}
                              </T>
                              {aberto ? (
                                <ChevronUp size={16} color={cores.marca} />
                              ) : (
                                <ChevronDown size={16} color={cores.marca} />
                              )}
                            </Toque>
                          ) : null}

                          {aberto
                            ? doItem.slice(0, OPCOES_NA_COMPARACAO).map((outra, posicao) => {
                                const escolhida =
                                  outra.loja.id === opcao.loja.id &&
                                  outra.produto.id === opcao.produto.id;
                                return (
                                  <Toque
                                    key={`${outra.loja.id}:${outra.produto.id}`}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: escolhida }}
                                    accessibilityLabel={`${outra.produto.nome}, ${outra.loja.nome}, ${dinheiro(outra.produto.precoCents)}`}
                                    onPress={() => {
                                      setEscolhas((atual) => ({
                                        ...atual,
                                        [item.indice]: {
                                          lojaId: outra.loja.id,
                                          produtoId: outra.produto.id,
                                        },
                                      }));
                                      setFora((atual) => {
                                        const novo = new Set(atual);
                                        novo.delete(item.indice);
                                        return novo;
                                      });
                                    }}
                                    style={[estilos.opcao, escolhida && estilos.opcaoEscolhida]}
                                  >
                                    <View
                                      style={[estilos.radio, escolhida && estilos.radioLigado]}
                                    />
                                    <View style={{ flex: 1 }}>
                                      <T v="corpo" numberOfLines={2}>
                                        {outra.produto.nome}
                                      </T>
                                      <T v="legenda" cor={cores.textoMedio} numberOfLines={1}>
                                        {outra.loja.nome}
                                      </T>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                      <T v="corpoForte">
                                        {dinheiro(outra.produto.precoCents)}
                                        {outra.produto.porPeso ? '/kg' : ''}
                                      </T>
                                      {posicao === 0 ? (
                                        <Selo
                                          texto="mais barato"
                                          cor={cores.sucesso}
                                          fundo={cores.sucessoClaro}
                                        />
                                      ) : null}
                                    </View>
                                  </Toque>
                                );
                              })
                            : null}
                        </View>
                      );
                    })}

                    {faltaParaMinimo > 0 ? (
                      <T v="legenda" cor={cores.aviso}>
                        Pedido mínimo da loja: {dinheiro(loja.minimoCents)}. Faltam{' '}
                        {dinheiro(faltaParaMinimo)}.
                      </T>
                    ) : null}
                  </Cartao>
                );
              })}
              {pedido.naoEncontrados.length || pedido.soEmFechadas.length ? (
                <Cartao estilo={{ backgroundColor: cores.avisoClaro }}>
                  {pedido.naoEncontrados.length ? (
                    <T v="legenda" cor={cores.aviso}>
                      Não achamos:{' '}
                      {pedido.naoEncontrados
                        .map((i) => pedido.itens.find((x) => x.indice === i)?.original)
                        .join(', ')}
                    </T>
                  ) : null}
                  {pedido.soEmFechadas.length ? (
                    <T v="legenda" cor={cores.aviso}>
                      Só em lojas fechadas agora:{' '}
                      {pedido.soEmFechadas
                        .map((i) => pedido.itens.find((x) => x.indice === i)?.original)
                        .join(', ')}
                    </T>
                  ) : null}
                </Cartao>
              ) : null}
              {grupos.length ? (
                <Botao
                  titulo={
                    marcados.length
                      ? `Colocar ${marcados.length} ${marcados.length === 1 ? 'item' : 'itens'} na sacola · ${dinheiro(totalCents)}`
                      : 'Marque ao menos um item'
                  }
                  desativado={marcados.length === 0}
                  carregando={levar.isPending}
                  aoTocar={() =>
                    exigirLogin(() =>
                      levar.mutate({
                        itens: marcados.map(({ item, opcao }) => ({
                          lojaId: opcao.loja.id,
                          produtoId: opcao.produto.id,
                          quantidade: item.quantidade,
                          gramas: opcao.produto.gramas,
                        })),
                      }),
                    )
                  }
                />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  chamada: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  entregador: { width: 120, height: 110 },
  // A caixa encostava no texto do topo; agora tem o respiro normal da tela.
  corpo: { padding: espaco.l, paddingTop: espaco.xl, gap: espaco.l },
  caixa: {
    backgroundColor: cores.superficie,
    borderRadius: raio.folha,
    padding: espaco.l,
    gap: espaco.m,
  },
  entrada: {
    minHeight: 140,
    fontFamily: fontes.corpo,
    fontSize: 17,
    lineHeight: 24,
    color: cores.texto,
  },
  ideias: { flexDirection: 'row', gap: espaco.s },
  ideia: {
    flex: 1,
    alignItems: 'center',
    gap: espaco.xs,
    paddingVertical: espaco.m,
    borderRadius: raio.grande,
    backgroundColor: cores.superficie,
  },
  achado: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  lojaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.s,
    paddingBottom: espaco.s,
    borderBottomWidth: 1,
    borderBottomColor: cores.linha,
  },
  linhaDoItem: { gap: espaco.s },
  marca: {
    width: 28,
    height: 28,
    borderRadius: raio.pequeno,
    borderWidth: 2,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaLigada: { backgroundColor: cores.marca, borderColor: cores.marca },
  comparar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 28 + espaco.m,
    minHeight: 32,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    marginLeft: 28 + espaco.m,
    padding: espaco.m,
    borderRadius: raio.grande,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  opcaoEscolhida: { borderColor: cores.marca, backgroundColor: cores.marcaClara },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: cores.linha },
  radioLigado: { borderColor: cores.marca, borderWidth: 6 },
});
