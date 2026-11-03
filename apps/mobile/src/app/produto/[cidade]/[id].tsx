import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShieldAlert, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GrupoDeComplemento, ProdutoDetalhado } from '@contrato';
import { useAdicionarAoCarrinho, useExigirLogin } from '@/api/carrinho';
import { chamar, ErroDaApi } from '@/api/cliente';
import { Botao, dinheiro, ErroDaTela, Esqueleto, Foto, Selo, T, Toque } from '@/componentes/base';
import { Campo, Contador, Opcao } from '@/componentes/formulario';
import { cores, elevacao, espaco, raio, toqueMinimo } from '@/tema/tokens';

/** Opção escolhida → quantidade. */
type Escolhas = Record<string, Record<string, number>>;

export default function Produto() {
  const { cidade, id } = useLocalSearchParams<{ cidade: string; id: string }>();
  const topo = useSafeAreaInsets().top;
  const baixo = useSafeAreaInsets().bottom;

  const produto = useQuery({
    queryKey: ['produto', cidade, id],
    queryFn: () => chamar<ProdutoDetalhado>(`cidades/${cidade}/produtos/${id}`),
  });

  const [quantidade, setQuantidade] = useState(1);
  const [gramas, setGramas] = useState<number | null>(null);
  const [escolhas, setEscolhas] = useState<Escolhas>({});
  const [observacao, setObservacao] = useState('');
  const adicionar = useAdicionarAoCarrinho();
  const exigirLogin = useExigirLogin();

  const p = produto.data;

  if (produto.isError || !p) {
    return (
      <View style={[estilos.tela, { paddingTop: topo }]}>
        <Stack.Screen options={{ headerShown: false }} />
        {produto.isError ? (
          <ErroDaTela
            mensagem={produto.error instanceof ErroDaApi ? produto.error.message : 'Tente de novo.'}
            aoTentar={() => void produto.refetch()}
          />
        ) : (
          <View style={{ gap: espaco.l }}>
            <Esqueleto estilo={{ height: 280, borderRadius: 0 }} />
            <Esqueleto estilo={{ height: 32, marginHorizontal: espaco.l }} />
            <Esqueleto estilo={{ height: 80, marginHorizontal: espaco.l }} />
          </View>
        )}
      </View>
    );
  }

  const peso = gramas ?? Math.max(p.minimoGramas, p.passoGramas);
  const extras = p.grupos.reduce((soma, g) => {
    const doGrupo = escolhas[g.id] ?? {};
    return soma + g.opcoes.reduce((s, o) => s + (doGrupo[o.id] ?? 0) * o.precoCents, 0);
  }, 0);
  const unitario = p.porPeso ? Math.round((p.precoCents * peso) / 1000) : p.precoCents;
  const total = (unitario + extras) * (p.porPeso ? 1 : quantidade);

  const faltando = p.grupos.find((g) => {
    const marcadas = Object.values(escolhas[g.id] ?? {}).reduce((a, b) => a + b, 0);
    return marcadas < Math.max(g.minimo, g.obrigatorio ? 1 : 0);
  });

  const bloqueio = !p.loja.aberta
    ? (p.loja.motivoFechada ?? 'Loja fechada agora')
    : p.esgotado || !p.disponivel
      ? 'Produto esgotado'
      : null;

  const alternar = (grupo: GrupoDeComplemento, opcaoId: string) => {
    setEscolhas((atual) => {
      const doGrupo = { ...(atual[grupo.id] ?? {}) };
      if (grupo.maximo === 1) return { ...atual, [grupo.id]: { [opcaoId]: 1 } };
      const total = Object.values(doGrupo).reduce((a, b) => a + b, 0);
      if (doGrupo[opcaoId]) delete doGrupo[opcaoId];
      else if (total < grupo.maximo) doGrupo[opcaoId] = 1;
      return { ...atual, [grupo.id]: doGrupo };
    });
  };

  const colocarNaSacola = () =>
    exigirLogin(() =>
      adicionar.mutate(
        {
          lojaId: p.loja.id,
          item: {
            produtoId: p.id,
            quantidade: p.porPeso ? 1 : quantidade,
            gramas: p.porPeso ? peso : undefined,
            observacao: observacao.trim() || undefined,
            complementos: Object.values(escolhas).flatMap((g) =>
              Object.entries(g).map(([opcaoId, q]) => ({ opcaoId, quantidade: q })),
            ),
          },
        },
        { onSuccess: () => router.back() },
      ),
    );

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.foto}>
          <Foto
            url={p.imagemUrl}
            Icone={ShoppingBag}
            tamanhoDoIcone={72}
            estilo={StyleSheet.absoluteFill}
          />
          <Toque
            accessibilityLabel="Voltar"
            onPress={() => router.back()}
            style={[estilos.voltar, { top: topo + espaco.s }]}
          >
            <ArrowLeft size={22} color={cores.texto} />
          </Toque>
        </View>

        <View style={estilos.corpo}>
          <Toque
            encolhe={0.99}
            accessibilityLabel={`Abrir ${p.loja.nome}`}
            onPress={() =>
              router.push({
                pathname: '/loja/[cidade]/[loja]',
                params: { cidade, loja: p.loja.slug },
              })
            }
          >
            <T v="legenda" cor={cores.marcaEscura}>
              {p.loja.nome}
            </T>
          </Toque>
          <T v="titulo1">{p.nome}</T>
          {p.descricao ? <T cor={cores.textoMedio}>{p.descricao}</T> : null}
          <View style={estilos.linha}>
            <T v="titulo2" cor={cores.marcaEscura}>
              {dinheiro(p.precoCents)}
              {p.porPeso ? '/kg' : ''}
            </T>
            {p.precoDeCents ? (
              <T cor={cores.textoFraco} style={{ textDecorationLine: 'line-through' }}>
                {dinheiro(p.precoDeCents)}
              </T>
            ) : null}
          </View>

          {p.receita !== 'NONE' ? (
            <Aviso texto="Exige receita: você envia a foto no fechamento do pedido." />
          ) : null}
          {p.maiorDeIdade ? (
            <Aviso texto="Venda só para maiores de 18. O entregador confere o documento." />
          ) : null}

          {p.porPeso ? (
            <View style={estilos.grupo}>
              <T v="titulo3">Quanto você quer?</T>
              <View style={estilos.linha}>
                <Contador
                  rotulo="Gramas"
                  valor={peso / p.passoGramas}
                  minimo={Math.ceil(p.minimoGramas / p.passoGramas) || 1}
                  aoMudar={(n) => setGramas(n * p.passoGramas)}
                />
                <T v="corpoForte">
                  {peso >= 1000 ? `${(peso / 1000).toLocaleString('pt-BR')} kg` : `${peso} g`}
                </T>
              </View>
              <T v="legenda" cor={cores.textoMedio}>
                O peso final pode variar um pouco; a loja ajusta o valor na separação.
              </T>
            </View>
          ) : null}

          {p.grupos.map((g) => {
            const doGrupo = escolhas[g.id] ?? {};
            return (
              <View key={g.id} style={estilos.grupo}>
                <View style={estilos.linha}>
                  <View style={{ flex: 1 }}>
                    <T v="titulo3">{g.nome}</T>
                    <T v="legenda" cor={cores.textoMedio}>
                      {g.maximo === 1 ? 'Escolha 1' : `Escolha até ${g.maximo}`}
                    </T>
                  </View>
                  {g.obrigatorio || g.minimo > 0 ? (
                    <Selo texto="Obrigatório" cor={cores.textoNaCor} fundo={cores.texto} />
                  ) : null}
                </View>
                {g.opcoes.map((o) => (
                  <Opcao
                    key={o.id}
                    titulo={o.nome}
                    descricao={o.descricao}
                    direita={o.precoCents ? `+ ${dinheiro(o.precoCents)}` : undefined}
                    multipla={g.maximo > 1}
                    marcada={!!doGrupo[o.id]}
                    aoTocar={() => alternar(g, o.id)}
                  />
                ))}
              </View>
            );
          })}

          <Campo
            rotulo="Alguma observação?"
            placeholder="Ex.: sem cebola, bem passado"
            value={observacao}
            onChangeText={setObservacao}
            maxLength={140}
          />
        </View>
      </ScrollView>

      <View style={[estilos.rodape, { paddingBottom: baixo + espaco.m }]}>
        {!p.porPeso ? <Contador valor={quantidade} minimo={1} aoMudar={setQuantidade} /> : null}
        <Botao
          estilo={{ flex: 1 }}
          titulo={
            bloqueio ?? (faltando ? `Escolha: ${faltando.nome}` : `Adicionar · ${dinheiro(total)}`)
          }
          desativado={!!bloqueio || !!faltando}
          carregando={adicionar.isPending}
          aoTocar={colocarNaSacola}
        />
      </View>
    </View>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <View style={estilos.aviso}>
      <ShieldAlert size={20} color={cores.aviso} />
      <T v="legenda" cor={cores.aviso} style={{ flex: 1 }}>
        {texto}
      </T>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  foto: { height: 280 },
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
  corpo: { padding: espaco.l, gap: espaco.m },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  grupo: { gap: espaco.s, paddingTop: espaco.m },
  aviso: {
    flexDirection: 'row',
    gap: espaco.s,
    alignItems: 'center',
    padding: espaco.m,
    borderRadius: raio.medio,
    backgroundColor: cores.avisoClaro,
  },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.l,
    paddingTop: espaco.m,
    backgroundColor: cores.superficie,
    borderTopLeftRadius: raio.folha,
    borderTopRightRadius: raio.folha,
    ...elevacao.alta,
  },
});
