import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LojaDetalhada } from '@contrato';
import { useAdicionarAoCarrinho, useExigirLogin } from '@/api/carrinho';
import { chamar } from '@/api/cliente';
import { Botao, dinheiro, Esqueleto, T } from '@/componentes/base';
import { Opcao } from '@/componentes/formulario';
import { cores, elevacao, espaco, raio } from '@/tema/tokens';

export default function MontarPizza() {
  const { cidade, loja: slug } = useLocalSearchParams<{ cidade: string; loja: string }>();
  const baixo = useSafeAreaInsets().bottom;
  const loja = useQuery({
    queryKey: ['loja', cidade, slug],
    queryFn: () => chamar<LojaDetalhada>(`cidades/${cidade}/lojas/${slug}`),
  });
  const adicionar = useAdicionarAoCarrinho();
  const exigirLogin = useExigirLogin();

  const [tamanhoId, setTamanhoId] = useState<string | null>(null);
  const [sabores, setSabores] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);

  const pizza = loja.data?.pizza;
  if (!loja.data || !pizza) {
    return (
      <View style={estilos.corpo}>
        <Esqueleto estilo={{ height: 200 }} />
      </View>
    );
  }

  const tamanho = pizza.tamanhos.find((t) => t.id === tamanhoId) ?? null;
  const saboresDoTamanho = tamanho ? pizza.sabores.filter((s) => s.precos[tamanho.id] != null) : [];
  const precosDosSabores = sabores.map(
    (id) => pizza.sabores.find((s) => s.id === id)?.precos[tamanhoId!] ?? 0,
  );
  const base = precosDosSabores.length
    ? pizza.regra === 'HIGHEST_PRICE'
      ? Math.max(...precosDosSabores)
      : Math.round(precosDosSabores.reduce((a, b) => a + b, 0) / precosDosSabores.length)
    : 0;
  const total =
    base +
    extras.reduce((s, id) => s + (pizza.extras.find((e) => e.id === id)?.precoCents ?? 0), 0);

  const escolherExtra = (id: string, tipo: string) =>
    setExtras((atual) => {
      if (atual.includes(id)) return atual.filter((e) => e !== id);
      // Uma borda e uma massa no máximo; adicionais à vontade.
      if (tipo === 'TOPPING') return [...atual, id];
      const mesmoTipo = pizza.extras.filter((e) => e.tipo === tipo).map((e) => e.id);
      return [...atual.filter((e) => !mesmoTipo.includes(e)), id];
    });

  const NOME_DO_EXTRA = { EDGE: 'Borda', CRUST: 'Massa', TOPPING: 'Adicionais' } as const;

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ title: 'Monte sua pizza' }} />
      <ScrollView contentContainerStyle={[estilos.corpo, { paddingBottom: baixo + 120 }]}>
        <T v="titulo3">1. Tamanho</T>
        {pizza.tamanhos.map((t) => (
          <Opcao
            key={t.id}
            titulo={t.nome}
            descricao={[t.fatias ? `${t.fatias} fatias` : null, `até ${t.maxSabores} sabores`]
              .filter(Boolean)
              .join(' · ')}
            marcada={t.id === tamanhoId}
            aoTocar={() => {
              setTamanhoId(t.id);
              setSabores((s) => s.slice(0, t.maxSabores));
            }}
          />
        ))}

        {tamanho ? (
          <>
            <T v="titulo3">
              2. Sabores ({sabores.length}/{tamanho.maxSabores})
            </T>
            {saboresDoTamanho.map((s) => (
              <Opcao
                key={s.id}
                multipla
                titulo={s.nome}
                descricao={s.descricao}
                direita={dinheiro(s.precos[tamanho.id])}
                marcada={sabores.includes(s.id)}
                desativada={!sabores.includes(s.id) && sabores.length >= tamanho.maxSabores}
                aoTocar={() =>
                  setSabores((atual) =>
                    atual.includes(s.id) ? atual.filter((x) => x !== s.id) : [...atual, s.id],
                  )
                }
              />
            ))}
            {(['EDGE', 'CRUST', 'TOPPING'] as const).map((tipo) => {
              const doTipo = pizza.extras.filter((e) => e.tipo === tipo);
              if (!doTipo.length) return null;
              return (
                <View key={tipo} style={{ gap: espaco.s }}>
                  <T v="titulo3">{NOME_DO_EXTRA[tipo]} (opcional)</T>
                  {doTipo.map((e) => (
                    <Opcao
                      key={e.id}
                      multipla={tipo === 'TOPPING'}
                      titulo={e.nome}
                      direita={e.precoCents ? `+ ${dinheiro(e.precoCents)}` : 'Grátis'}
                      marcada={extras.includes(e.id)}
                      aoTocar={() => escolherExtra(e.id, tipo)}
                    />
                  ))}
                </View>
              );
            })}
            <T v="legenda" cor={cores.textoMedio}>
              {pizza.regra === 'HIGHEST_PRICE'
                ? 'Com mais de um sabor, vale o preço do sabor mais caro.'
                : 'Com mais de um sabor, vale a média dos preços.'}
            </T>
          </>
        ) : null}
      </ScrollView>
      <View style={[estilos.rodape, { paddingBottom: baixo + espaco.m }]}>
        <Botao
          titulo={
            !tamanho
              ? 'Escolha o tamanho'
              : !sabores.length
                ? 'Escolha um sabor'
                : `Adicionar · ${dinheiro(total)}`
          }
          desativado={!tamanho || !sabores.length}
          carregando={adicionar.isPending}
          aoTocar={() =>
            exigirLogin(() =>
              adicionar.mutate(
                {
                  lojaId: loja.data.id,
                  item: { pizzaTamanhoId: tamanhoId!, saborIds: sabores, pizzaExtraIds: extras },
                },
                { onSuccess: () => router.back() },
              ),
            )
          }
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.m, paddingBottom: 120 },
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
