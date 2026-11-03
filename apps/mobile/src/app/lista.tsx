import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  ClipboardList,
  Coffee,
  Flame,
  Pill,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { EntradaListaNoCarrinho, PedidoMontado, RespostaListaNoCarrinho } from '@contrato';
import { avisarErro, useExigirLogin } from '@/api/carrinho';
import { useCidade } from '@/api/cidade';
import { chamar } from '@/api/cliente';
import { Botao, dinheiro, T, Toque } from '@/componentes/base';
import { Cartao } from '@/componentes/formulario';
import { TopoEscuro } from '@/componentes/topo';
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

export default function PedidoPorLista() {
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

  // O plano diz de qual loja sai cada item; o primeiro candidato é o mais provável.
  const escolhidos = pedido
    ? pedido.itens.flatMap((item) => {
        const lojaId = pedido.plano[item.indice];
        const loja = pedido.lojas.find((l) => l.id === lojaId);
        const produto = loja?.produtos[item.indice]?.find((p) => !p.precisaEscolher);
        return loja && produto ? [{ item, loja, produto }] : [];
      })
    : [];

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: espaco.xxl }}
      >
        <TopoEscuro voltar titulo="Pedido por lista" Icone={ClipboardList}>
          <View style={estilos.chamada}>
            <View style={{ flex: 1, gap: espaco.xs }}>
              <T v="titulo1" cor={cores.textoNaNoite}>
                Diga o que você precisa.
              </T>
              <T v="titulo2" cor={cores.amarelo}>
                A gente acha e monta.
              </T>
              <T v="legenda" cor={cores.textoNaNoiteFraco}>
                Escreva sua lista, um item por linha. Procuramos nas lojas abertas e montamos o
                pedido no menor número de lojas.
              </T>
            </View>
            <Image source={ENTREGADOR} style={estilos.entregador} contentFit="contain" />
          </View>
        </TopoEscuro>

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
              {escolhidos.length ? (
                <Cartao>
                  <T v="titulo3">
                    Encontramos {escolhidos.length} {escolhidos.length === 1 ? 'item' : 'itens'}
                  </T>
                  {escolhidos.map(({ item, loja, produto }) => (
                    <View key={item.indice} style={estilos.achado}>
                      <ShoppingBag size={18} color={cores.marca} />
                      <View style={{ flex: 1 }}>
                        <T v="corpoForte">
                          {item.quantidade}x {produto.nome}
                        </T>
                        <T v="legenda" cor={cores.textoMedio}>
                          {loja.nome} · você pediu “{item.original}”
                        </T>
                      </View>
                      <T v="corpoForte">{dinheiro(produto.precoCents * item.quantidade)}</T>
                    </View>
                  ))}
                </Cartao>
              ) : null}
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
              {escolhidos.length ? (
                <Botao
                  titulo="Colocar na sacola"
                  carregando={levar.isPending}
                  aoTocar={() =>
                    exigirLogin(() =>
                      levar.mutate({
                        itens: escolhidos.map(({ item, loja, produto }) => ({
                          lojaId: loja.id,
                          produtoId: produto.id,
                          quantidade: item.quantidade,
                          gramas: produto.gramas,
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
  corpo: { padding: espaco.l, gap: espaco.l, marginTop: -espaco.l },
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
});
