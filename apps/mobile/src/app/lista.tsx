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
import { Botao, dinheiro, T, Toque } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { BotaoDeFalar, TAMANHO_DO_MICROFONE } from '@/componentes/ditado';
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

type Item = PedidoMontado['itens'][number];

/** Por peso, o preço é do quilo: vale o que vai na balança. */
function totalDoProduto(produto: ProdutoSugerido, item: Item): number {
  const { precoCents, porPeso, gramas } = produto;
  const unidade = porPeso && gramas ? Math.round((precoCents * gramas) / 1000) : precoCents;
  return unidade * item.quantidade;
}

/** Os produtos da própria loja para o item, sem os que exigem montar (pizza e afins). */
function produtosDaLoja(loja: LojaSugerida, item: Item): ProdutoSugerido[] {
  return (loja.produtos[item.indice] ?? []).filter((produto) => !produto.precisaEscolher);
}

/**
 * Cada loja aberta que tem algum item da lista, com o produto mais parecido
 * com o que a pessoa escreveu. Ordem só pelo preço total (itens e entrega):
 * nenhuma loja é favorecida, e a lista de uma loja nunca mostra produto de outra.
 */
function lojasDaLista(pedido: PedidoMontado) {
  return pedido.lojas
    .map((loja) => {
      const achados = pedido.itens.flatMap((item) => {
        const produto = produtosDaLoja(loja, item)[0];
        return produto ? [{ item, produto }] : [];
      });
      const itensCents = achados.reduce((soma, a) => soma + totalDoProduto(a.produto, a.item), 0);
      const totalCents = itensCents + (loja.taxaGratis ? 0 : loja.taxaCents);
      return { loja, achados, totalCents };
    })
    .filter((resumo) => resumo.achados.length > 0)
    .sort((a, b) => a.totalCents - b.totalCents);
}

export default function PedidoPorLista() {
  const folga = useFolgaInferior(espaco.xxl);
  const { cidade } = useCidade();
  const consultas = useQueryClient();
  const exigirLogin = useExigirLogin();
  const [texto, setTexto] = useState('');
  const [parcial, setParcial] = useState('');

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
  const lojas = useMemo(() => (pedido ? lojasDaLista(pedido) : []), [pedido]);

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
                Escreva ou fale sua lista. Mostramos cada loja aberta que tem seus itens, da mais
                barata para a mais cara.
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
            {parcial ? (
              <T v="legenda" cor={cores.marca} numberOfLines={2}>
                {`ouvindo: ${parcial}…`}
              </T>
            ) : null}
            {/* O microfone fica no meio, cortando a borda de cima do botão. */}
            <View style={estilos.microfone}>
              <BotaoDeFalar
                aoParcial={setParcial}
                aoFalar={(trecho) =>
                  setTexto((atual) =>
                    atual.trim()
                      ? `${atual.trimEnd()}
${trecho}`
                      : trecho,
                  )
                }
              />
            </View>
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
              {lojas.length ? (
                <T v="legenda" cor={cores.textoMedio}>
                  {lojas.length === 1
                    ? '1 loja aberta tem itens da sua lista.'
                    : `${lojas.length} lojas abertas têm itens da sua lista, da mais barata para a mais cara.`}{' '}
                  Escolha a loja e desmarque o que não quiser.
                </T>
              ) : null}
              {lojas.map((resumo) => (
                <CartaoDaLoja
                  key={resumo.loja.id}
                  loja={resumo.loja}
                  itens={pedido.itens}
                  carregando={levar.isPending}
                  aoLevar={(itens) => exigirLogin(() => levar.mutate({ itens }))}
                />
              ))}
              {pedido.naoEncontrados.length || pedido.soEmFechadas.length ? (
                <Cartao estilo={{ backgroundColor: cores.avisoClaro }}>
                  {pedido.naoEncontrados.length ? (
                    <T v="legenda" cor={cores.aviso}>
                      Nenhuma loja aberta tem:{' '}
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
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Uma loja e só os produtos dela. Cada item pode ser desmarcado ou trocado por
 * outra marca da mesma loja, da mais barata para a mais cara.
 */
function CartaoDaLoja({
  loja,
  itens,
  carregando,
  aoLevar,
}: {
  loja: LojaSugerida;
  itens: Item[];
  carregando: boolean;
  aoLevar: (itens: EntradaListaNoCarrinho['itens']) => void;
}) {
  const [escolhas, setEscolhas] = useState<Record<number, string>>({});
  const [fora, setFora] = useState<Set<number>>(new Set());
  const [trocando, setTrocando] = useState<number | null>(null);

  const linhas = itens.flatMap((item) => {
    const produtos = produtosDaLoja(loja, item);
    const produto = produtos.find((p) => p.id === escolhas[item.indice]) ?? produtos[0];
    return produto
      ? [
          {
            item,
            produto,
            marcado: !fora.has(item.indice),
            outras: [...produtos].sort((a, b) => a.precoCents - b.precoCents),
          },
        ]
      : [];
  });
  const faltam = itens.filter((item) => produtosDaLoja(loja, item).length === 0);
  const marcadas = linhas.filter((linha) => linha.marcado);
  const itensCents = marcadas.reduce((soma, l) => soma + totalDoProduto(l.produto, l.item), 0);
  const entregaCents = loja.taxaGratis ? 0 : loja.taxaCents;
  const faltaParaMinimo = itensCents > 0 ? loja.minimoCents - itensCents : 0;

  const alternar = (indice: number) =>
    setFora((atual) => {
      const novo = new Set(atual);
      if (novo.has(indice)) novo.delete(indice);
      else novo.add(indice);
      return novo;
    });

  return (
    <Cartao>
      <View style={estilos.lojaTopo}>
        <Store size={20} color={cores.marca} />
        <View style={{ flex: 1 }}>
          <T v="titulo3" numberOfLines={1}>
            {loja.nome}
          </T>
          <T v="legenda" cor={cores.textoMedio}>
            {`tem ${linhas.length} de ${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · ${loja.tempoMin} min · `}
            {loja.taxaGratis ? 'entrega grátis' : `entrega ${dinheiro(loja.taxaCents)}`}
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="titulo3">{dinheiro(itensCents + entregaCents)}</T>
          <T v="mini" cor={cores.textoMedio}>
            com entrega
          </T>
        </View>
      </View>

      {linhas.map(({ item, produto, marcado, outras }) => {
        const aberto = trocando === item.indice;
        return (
          <View key={item.indice} style={estilos.linhaDoItem}>
            <View style={estilos.achado}>
              <Toque
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcado }}
                accessibilityLabel={`${produto.nome}: ${marcado ? 'na sacola' : 'fora da sacola'}`}
                onPress={() => alternar(item.indice)}
                style={[estilos.marca, marcado && estilos.marcaLigada]}
              >
                {marcado ? <Check size={18} color={cores.textoNaCor} /> : null}
              </Toque>
              <View style={{ flex: 1, opacity: marcado ? 1 : 0.5 }}>
                <T v="corpoForte">
                  {item.quantidade}x {produto.nome}
                </T>
                <T v="legenda" cor={cores.textoMedio}>
                  você pediu “{item.original}”
                </T>
              </View>
              <T v="corpoForte" style={{ opacity: marcado ? 1 : 0.5 }}>
                {dinheiro(totalDoProduto(produto, item))}
              </T>
            </View>

            {outras.length > 1 ? (
              <Toque
                accessibilityLabel={`Outras marcas de ${item.original} nesta loja`}
                onPress={() => setTrocando(aberto ? null : item.indice)}
                style={estilos.comparar}
              >
                <T v="legenda" cor={cores.marca}>
                  {aberto ? 'fechar' : `trocar marca · ${outras.length} opções nesta loja`}
                </T>
                {aberto ? (
                  <ChevronUp size={16} color={cores.marca} />
                ) : (
                  <ChevronDown size={16} color={cores.marca} />
                )}
              </Toque>
            ) : null}

            {aberto
              ? outras.map((outra) => {
                  const escolhida = outra.id === produto.id;
                  return (
                    <Toque
                      key={outra.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: escolhida }}
                      accessibilityLabel={`${outra.nome}, ${dinheiro(outra.precoCents)}`}
                      onPress={() => {
                        setEscolhas((atual) => ({ ...atual, [item.indice]: outra.id }));
                        setFora((atual) => {
                          const novo = new Set(atual);
                          novo.delete(item.indice);
                          return novo;
                        });
                        setTrocando(null);
                      }}
                      style={[estilos.opcao, escolhida && estilos.opcaoEscolhida]}
                    >
                      <View style={[estilos.radio, escolhida && estilos.radioLigado]} />
                      <T v="corpo" numberOfLines={2} style={{ flex: 1 }}>
                        {outra.nome}
                      </T>
                      <T v="corpoForte">
                        {dinheiro(outra.precoCents)}
                        {outra.porPeso ? '/kg' : ''}
                      </T>
                    </Toque>
                  );
                })
              : null}
          </View>
        );
      })}

      {faltam.length ? (
        <T v="legenda" cor={cores.textoMedio}>
          Esta loja não tem: {faltam.map((item) => item.original).join(', ')}
        </T>
      ) : null}
      {faltaParaMinimo > 0 ? (
        <T v="legenda" cor={cores.aviso}>
          Pedido mínimo da loja: {dinheiro(loja.minimoCents)}. Faltam {dinheiro(faltaParaMinimo)}.
        </T>
      ) : null}

      <Botao
        titulo={
          marcadas.length
            ? `Colocar ${marcadas.length} ${marcadas.length === 1 ? 'item' : 'itens'} na sacola · ${dinheiro(itensCents)}`
            : 'Marque ao menos um item'
        }
        desativado={marcadas.length === 0}
        carregando={carregando}
        aoTocar={() =>
          aoLevar(
            marcadas.map(({ item, produto }) => ({
              lojaId: loja.id,
              produtoId: produto.id,
              quantidade: item.quantidade,
              gramas: produto.gramas,
            })),
          )
        }
      />
    </Cartao>
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
  microfone: {
    alignItems: 'center',
    zIndex: 1,
    marginBottom: -TAMANHO_DO_MICROFONE / 2 - espaco.m,
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
