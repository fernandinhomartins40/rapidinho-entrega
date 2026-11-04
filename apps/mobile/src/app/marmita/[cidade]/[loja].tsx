import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ItemDeMarmita, LojaDetalhada } from '@contrato';
import { useAdicionarAoCarrinho, useExigirLogin } from '@/api/carrinho';
import { chamar } from '@/api/cliente';
import { Botao, dinheiro, Esqueleto, T, Toque } from '@/componentes/base';
import { Opcao } from '@/componentes/formulario';
import { cores, elevacao, espaco, raio } from '@/tema/tokens';

type Ajuste = 'SEM' | 'POUCO' | 'NORMAL' | 'MAIS';

const AJUSTES: { valor: Ajuste; rotulo: string }[] = [
  { valor: 'SEM', rotulo: 'sem' },
  { valor: 'POUCO', rotulo: 'pouco' },
  { valor: 'NORMAL', rotulo: 'normal' },
  { valor: 'MAIS', rotulo: 'mais' },
];

/** Agrupa o que vem no prato pelo grupo do cardápio (Base, Salada...). */
function porGrupo(itens: ItemDeMarmita[]): [string, ItemDeMarmita[]][] {
  const grupos = new Map<string, ItemDeMarmita[]>();
  for (const item of itens) {
    const nome = item.grupo ?? 'No prato';
    grupos.set(nome, [...(grupos.get(nome) ?? []), item]);
  }
  return [...grupos.entries()];
}

export default function MontarMarmita() {
  const { cidade, loja: slug } = useLocalSearchParams<{ cidade: string; loja: string }>();
  const baixo = useSafeAreaInsets().bottom;
  const loja = useQuery({
    queryKey: ['loja', cidade, slug],
    queryFn: () => chamar<LojaDetalhada>(`cidades/${cidade}/lojas/${slug}`),
  });
  const adicionar = useAdicionarAoCarrinho();
  const exigirLogin = useExigirLogin();

  const [tamanhoId, setTamanhoId] = useState<string | null>(null);
  const [misturas, setMisturas] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  // Só guarda o que mudou: o que não está aqui vem "normal".
  const [ajustes, setAjustes] = useState<Record<string, Exclude<Ajuste, 'NORMAL'>>>({});

  const marmita = loja.data?.marmita;
  if (!loja.data || !marmita) {
    return (
      <View style={estilos.corpo}>
        <Stack.Screen options={{ title: 'Monte sua marmita' }} />
        {loja.data ? (
          <T cor={cores.textoMedio}>Esta loja não tem marmita no cardápio de hoje.</T>
        ) : (
          <Esqueleto estilo={{ height: 200 }} />
        )}
      </View>
    );
  }

  const tamanho = marmita.tamanhos.find((t) => t.id === tamanhoId) ?? null;
  const doTipo = (tipo: ItemDeMarmita['tipo']) => marmita.itens.filter((i) => i.tipo === tipo);
  const opcoesDeMistura = doTipo('MISTURA');
  const noPrato = doTipo('NO_PRATO');
  const opcoesDeExtra = doTipo('EXTRA');

  const precoDe = (id: string) => marmita.itens.find((i) => i.id === id)?.precoCents ?? 0;
  const total =
    (tamanho?.precoCents ?? 0) +
    [...misturas, ...extras].reduce((soma, id) => soma + precoDe(id), 0);

  const maxMisturas = tamanho?.maxMisturas ?? 1;
  const ajustar = (id: string, valor: Ajuste) =>
    setAjustes((atual) => {
      const { [id]: _antes, ...resto } = atual;
      return valor === 'NORMAL' ? resto : { ...resto, [id]: valor };
    });

  const enviar = () =>
    exigirLogin(() =>
      adicionar.mutate(
        {
          lojaId: loja.data.id,
          item: {
            marmitaTamanhoId: tamanhoId!,
            marmita: [
              ...misturas.map((itemId) => ({ itemId, ajuste: 'ESCOLHIDO' as const })),
              ...extras.map((itemId) => ({ itemId, ajuste: 'ESCOLHIDO' as const })),
              ...Object.entries(ajustes).map(([itemId, ajuste]) => ({ itemId, ajuste })),
            ],
          },
        },
        { onSuccess: () => router.back() },
      ),
    );

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ title: 'Monte sua marmita' }} />
      <ScrollView contentContainerStyle={[estilos.corpo, { paddingBottom: baixo + 120 }]}>
        <T v="titulo3">1. Tamanho</T>
        {marmita.tamanhos.map((t) => (
          <Opcao
            key={t.id}
            titulo={t.nome}
            descricao={[
              t.descricao,
              `${t.maxMisturas} ${t.maxMisturas === 1 ? 'mistura' : 'misturas'}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            direita={dinheiro(t.precoCents)}
            marcada={t.id === tamanhoId}
            aoTocar={() => {
              setTamanhoId(t.id);
              setMisturas((atual) => atual.slice(0, t.maxMisturas));
            }}
          />
        ))}

        <T v="titulo3">
          2. {maxMisturas === 1 ? 'Mistura' : `Misturas (${misturas.length}/${maxMisturas})`}
        </T>
        {opcoesDeMistura.map((m) => {
          const marcada = misturas.includes(m.id);
          return (
            <Opcao
              key={m.id}
              multipla={maxMisturas > 1}
              titulo={m.nome}
              direita={m.precoCents ? `+ ${dinheiro(m.precoCents)}` : undefined}
              marcada={marcada}
              desativada={maxMisturas > 1 && !marcada && misturas.length >= maxMisturas}
              aoTocar={() =>
                setMisturas((atual) =>
                  marcada
                    ? atual.filter((x) => x !== m.id)
                    : maxMisturas === 1
                      ? [m.id]
                      : [...atual, m.id],
                )
              }
            />
          );
        })}

        {noPrato.length ? (
          <View style={estilos.bloco}>
            <T v="titulo3">3. O que vem no prato</T>
            <T v="legenda" cor={cores.textoMedio}>
              Não gosta de algo? Tire ou peça pouco. Gosta muito? Peça mais. Não muda o preço.
            </T>
            {porGrupo(noPrato).map(([grupo, itens]) => (
              <View key={grupo} style={estilos.grupo}>
                <T v="corpoForte" cor={cores.textoMedio}>
                  {grupo}
                </T>
                {itens.map((item) => {
                  const atual: Ajuste = ajustes[item.id] ?? 'NORMAL';
                  return (
                    <View key={item.id} style={estilos.linha}>
                      <T
                        v="corpoForte"
                        style={[estilos.nomeDoItem, atual === 'SEM' && estilos.riscado]}
                        numberOfLines={2}
                      >
                        {item.nome}
                      </T>
                      <View style={estilos.ajustes} accessibilityRole="radiogroup">
                        {AJUSTES.map((ajuste) => {
                          const ligado = atual === ajuste.valor;
                          return (
                            <Toque
                              key={ajuste.valor}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: ligado }}
                              accessibilityLabel={`${ajuste.rotulo} ${item.nome}`}
                              onPress={() => ajustar(item.id, ajuste.valor)}
                              style={[
                                estilos.ajuste,
                                ligado &&
                                  (ajuste.valor === 'SEM'
                                    ? estilos.ajusteSem
                                    : estilos.ajusteLigado),
                              ]}
                            >
                              <T
                                v="mini"
                                cor={
                                  ligado
                                    ? ajuste.valor === 'SEM'
                                      ? cores.perigo
                                      : cores.marcaEscura
                                    : cores.textoMedio
                                }
                              >
                                {ajuste.rotulo}
                              </T>
                            </Toque>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : null}

        {opcoesDeExtra.length ? (
          <View style={estilos.bloco}>
            <T v="titulo3">{noPrato.length ? '4' : '3'}. Extras (opcional)</T>
            {opcoesDeExtra.map((e) => (
              <Opcao
                key={e.id}
                multipla
                titulo={e.nome}
                direita={`+ ${dinheiro(e.precoCents)}`}
                marcada={extras.includes(e.id)}
                aoTocar={() =>
                  setExtras((atual) =>
                    atual.includes(e.id) ? atual.filter((x) => x !== e.id) : [...atual, e.id],
                  )
                }
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={[estilos.rodape, { paddingBottom: baixo + espaco.m }]}>
        <Botao
          titulo={
            !tamanho
              ? 'Escolha o tamanho'
              : !misturas.length
                ? 'Escolha a mistura'
                : `Adicionar · ${dinheiro(total)}`
          }
          desativado={!tamanho || !misturas.length}
          carregando={adicionar.isPending}
          aoTocar={enviar}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.m, paddingBottom: 120 },
  bloco: { gap: espaco.m, marginTop: espaco.s },
  grupo: {
    gap: espaco.s,
    padding: espaco.m,
    borderRadius: raio.grande,
    backgroundColor: cores.superficie,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.s, minHeight: 48 },
  nomeDoItem: { flex: 1 },
  riscado: { textDecorationLine: 'line-through', color: cores.textoFraco },
  ajustes: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
    borderRadius: raio.total,
    backgroundColor: cores.superficieAlta,
  },
  ajuste: {
    minWidth: 46,
    minHeight: 36,
    paddingHorizontal: espaco.s,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ajusteLigado: { backgroundColor: cores.marcaClara },
  ajusteSem: { backgroundColor: cores.perigoClaro },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: espaco.l,
    paddingTop: espaco.m,
    backgroundColor: cores.superficie,
    borderTopLeftRadius: raio.folha,
    borderTopRightRadius: raio.folha,
    ...elevacao.alta,
  },
});
