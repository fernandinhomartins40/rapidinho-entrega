import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Camera, CheckCircle2, MapPinPlus, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  EntradaCriarPedido,
  FormaDePagamento,
  PoliticaDeSubstituicao,
  RespostaCriarPedido,
  ResumoDoCheckout,
  TipoDePedido,
} from '@contrato';
import { avisarErro } from '@/api/carrinho';
import { chamar, enviarImagem, ErroDaApi } from '@/api/cliente';
import { Botao, dinheiro, ErroDaTela, Esqueleto, T, Toque } from '@/componentes/base';
import { Campo, Cartao, Linha, Opcao } from '@/componentes/formulario';
import { cores, espaco, raio } from '@/tema/tokens';

const NOME_DA_FORMA: Record<FormaDePagamento, { titulo: string; descricao: string }> = {
  PIX: { titulo: 'Pix', descricao: 'Você paga na chave da loja depois de pedir' },
  CASH_ON_DELIVERY: { titulo: 'Dinheiro', descricao: 'Pague ao receber' },
  CARD_ON_DELIVERY: { titulo: 'Cartão na entrega', descricao: 'Maquininha com o entregador' },
};

const SUBSTITUICAO: { valor: PoliticaDeSubstituicao; titulo: string }[] = [
  { valor: 'SUBSTITUTE_SIMILAR', titulo: 'Trocar por um parecido' },
  { valor: 'CONTACT_ME', titulo: 'Falar comigo antes' },
  { valor: 'REMOVE_ITEM', titulo: 'Tirar o item do pedido' },
];

export default function Checkout() {
  const { loja } = useLocalSearchParams<{ loja: string }>();
  const baixo = useSafeAreaInsets().bottom;
  const consultas = useQueryClient();

  // A mesma chave em todas as tentativas: rede ruim não cria dois pedidos.
  const [chave] = useState(() => Crypto.randomUUID());
  const [tipo, setTipo] = useState<TipoDePedido>('DELIVERY');
  const [enderecoId, setEnderecoId] = useState<string | undefined>();
  const [forma, setForma] = useState<FormaDePagamento | null>(null);
  const [troco, setTroco] = useState('');
  const [cupomDigitado, setCupomDigitado] = useState('');
  const [cupom, setCupom] = useState<string | undefined>();
  const [observacao, setObservacao] = useState('');
  const [maioridade, setMaioridade] = useState(false);
  const [receita, setReceita] = useState<{ id: string } | null>(null);
  const [enviandoReceita, setEnviandoReceita] = useState(false);
  const [substituicao, setSubstituicao] = useState<PoliticaDeSubstituicao>('CONTACT_ME');

  const parametros = new URLSearchParams({ lojaId: loja, tipo });
  if (enderecoId) parametros.set('enderecoId', enderecoId);
  if (cupom) parametros.set('cupom', cupom);

  const resumo = useQuery({
    queryKey: ['resumo', loja, tipo, enderecoId, cupom],
    queryFn: () => chamar<ResumoDoCheckout>(`checkout/resumo?${parametros.toString()}`),
    placeholderData: keepPreviousData,
  });

  const r = resumo.data;
  const formaEscolhida = forma ?? r?.pagamentoSugerido ?? r?.formasDePagamento[0] ?? null;
  const enderecoEscolhido = enderecoId ?? r?.enderecoEscolhidoId ?? undefined;

  const pedir = useMutation({
    mutationFn: (entrada: EntradaCriarPedido) =>
      chamar<RespostaCriarPedido>('pedidos', { metodo: 'POST', corpo: entrada }),
    onSuccess: (pedido) => {
      void consultas.invalidateQueries({ queryKey: ['carrinho'] });
      void consultas.invalidateQueries({ queryKey: ['pedidos'] });
      router.dismissAll();
      router.push({ pathname: '/pedido/[id]', params: { id: pedido.id } });
    },
    onError: avisarErro,
  });

  const fotografarReceita = async () => {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    const escolha = permissao.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] });
    if (escolha.canceled) return;
    setEnviandoReceita(true);
    try {
      setReceita(await enviarImagem(escolha.assets[0].uri, 'receita'));
    } catch (erro) {
      avisarErro(erro);
    } finally {
      setEnviandoReceita(false);
    }
  };

  if (resumo.isError && !r) {
    return (
      <ErroDaTela
        mensagem={resumo.error instanceof ErroDaApi ? resumo.error.message : 'Tente de novo.'}
        aoTentar={() => void resumo.refetch()}
      />
    );
  }

  if (!r) {
    return (
      <View style={estilos.corpo}>
        <Stack.Screen options={{ title: 'Fechar pedido' }} />
        {[0, 1, 2].map((i) => (
          <Esqueleto key={i} estilo={{ height: 120 }} />
        ))}
      </View>
    );
  }

  const trocoCents = Math.round(Number(troco.replace(',', '.')) * 100) || null;
  const faltando =
    r.bloqueio ??
    (tipo === 'DELIVERY' && !enderecoEscolhido
      ? 'Escolha o endereço'
      : !formaEscolhida
        ? 'Escolha como pagar'
        : r.exigencias.maioridade && !maioridade
          ? 'Confirme que tem 18 anos'
          : r.exigencias.receita && !receita
            ? 'Envie a foto da receita'
            : null);

  const finalizar = () => {
    if (faltando || !formaEscolhida) return;
    pedir.mutate({
      chaveDeIdempotencia: chave,
      lojaId: loja,
      tipo,
      enderecoId: tipo === 'DELIVERY' ? enderecoEscolhido : undefined,
      formaDePagamento: formaEscolhida,
      trocoParaCents: formaEscolhida === 'CASH_ON_DELIVERY' ? trocoCents : undefined,
      cupom,
      observacao: observacao.trim() || undefined,
      confirmaMaioridade: r.exigencias.maioridade ? maioridade : undefined,
      receitaImagemId: receita?.id,
      politicaDeSubstituicao: r.loja.ehMercado ? substituicao : undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: r.loja.nome }} />
      <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled">
        {r.loja.aceitaRetirada ? (
          <View style={estilos.alternador}>
            {(['DELIVERY', 'PICKUP'] as const).map((t) => (
              <Toque
                key={t}
                accessibilityRole="tab"
                accessibilityState={{ selected: tipo === t }}
                accessibilityLabel={t === 'DELIVERY' ? 'Entrega' : 'Retirar na loja'}
                onPress={() => setTipo(t)}
                style={[estilos.aba, tipo === t && estilos.abaLigada]}
              >
                <T v="corpoForte" cor={tipo === t ? cores.textoNaCor : cores.textoMedio}>
                  {t === 'DELIVERY' ? 'Entrega' : 'Retirar na loja'}
                </T>
              </Toque>
            ))}
          </View>
        ) : null}

        {tipo === 'DELIVERY' ? (
          <Cartao>
            <T v="titulo3">Entregar em</T>
            {r.enderecos.map((e) => (
              <Opcao
                key={e.id}
                titulo={`${e.rua}${e.numero ? `, ${e.numero}` : ''}`}
                descricao={[e.bairro, e.complemento, e.referencia].filter(Boolean).join(' · ')}
                marcada={e.id === enderecoEscolhido}
                aoTocar={() => setEnderecoId(e.id)}
              />
            ))}
            <Botao
              titulo="Novo endereço"
              variante="secundario"
              Icone={MapPinPlus}
              aoTocar={() => router.push('/enderecos/novo')}
            />
          </Cartao>
        ) : null}

        <Cartao>
          <T v="titulo3">Como vai pagar?</T>
          {r.formasDePagamento.map((f) => (
            <Opcao
              key={f}
              titulo={NOME_DA_FORMA[f].titulo}
              descricao={NOME_DA_FORMA[f].descricao}
              marcada={f === formaEscolhida}
              aoTocar={() => setForma(f)}
            />
          ))}
          {formaEscolhida === 'CASH_ON_DELIVERY' ? (
            <Campo
              rotulo="Troco para quanto?"
              dica="Deixe em branco se não precisar de troco"
              keyboardType="decimal-pad"
              placeholder="Ex.: 100"
              value={troco}
              onChangeText={setTroco}
            />
          ) : null}
        </Cartao>

        {r.loja.ehMercado ? (
          <Cartao>
            <T v="titulo3">Se faltar algum item</T>
            {SUBSTITUICAO.map((s) => (
              <Opcao
                key={s.valor}
                titulo={s.titulo}
                marcada={substituicao === s.valor}
                aoTocar={() => setSubstituicao(s.valor)}
              />
            ))}
          </Cartao>
        ) : null}

        {r.exigencias.receita ? (
          <Cartao>
            <T v="titulo3">Receita</T>
            <T v="legenda" cor={cores.textoMedio}>
              Tire uma foto legível. A farmácia confere antes de separar e o entregador recolhe a
              original.
            </T>
            <Botao
              titulo={receita ? 'Receita enviada' : 'Fotografar receita'}
              Icone={receita ? CheckCircle2 : Camera}
              variante="secundario"
              carregando={enviandoReceita}
              aoTocar={() => void fotografarReceita()}
            />
          </Cartao>
        ) : null}

        {r.exigencias.maioridade ? (
          <Opcao
            multipla
            titulo="Tenho 18 anos ou mais"
            descricao="O entregador confere um documento com foto."
            marcada={maioridade}
            aoTocar={() => setMaioridade((m) => !m)}
          />
        ) : null}

        <Cartao>
          <View style={estilos.cupom}>
            <View style={{ flex: 1 }}>
              <Campo
                rotulo="Cupom"
                autoCapitalize="characters"
                placeholder="Tem um código?"
                value={cupomDigitado}
                onChangeText={setCupomDigitado}
                erro={cupom ? r.mensagemDoCupom : null}
              />
            </View>
            <Botao
              titulo={cupom && !r.mensagemDoCupom ? 'Aplicado' : 'Aplicar'}
              variante="secundario"
              desativado={!cupomDigitado.trim()}
              aoTocar={() => setCupom(cupomDigitado.trim().toUpperCase())}
              estilo={{ alignSelf: 'flex-end' }}
            />
          </View>
          <Campo
            rotulo="Recado para a loja"
            placeholder="Ex.: interfone quebrado, ligar ao chegar"
            value={observacao}
            onChangeText={setObservacao}
            maxLength={200}
          />
        </Cartao>

        <Cartao>
          <Linha rotulo="Subtotal" valor={dinheiro(r.valores.subtotalCents)} />
          <Linha
            rotulo={r.valores.motivoDaTaxa ?? 'Entrega'}
            valor={r.valores.taxaEntregaCents ? dinheiro(r.valores.taxaEntregaCents) : 'Grátis'}
          />
          {r.valores.descontoCents ? (
            <Linha rotulo="Desconto" valor={`- ${dinheiro(r.valores.descontoCents)}`} />
          ) : null}
          <Linha rotulo="Total" valor={dinheiro(r.valores.totalCents)} forte />
          {r.exigencias.temPesavel ? (
            <T v="legenda" cor={cores.textoMedio}>
              Itens por peso podem mudar um pouco o total depois da pesagem.
            </T>
          ) : null}
          <T v="legenda" cor={cores.textoMedio}>
            Chega em {r.loja.tempoMin}-{r.loja.tempoMax} min
          </T>
        </Cartao>

        {r.bloqueio ? (
          <View style={estilos.bloqueio}>
            <ShieldAlert size={20} color={cores.perigo} />
            <T v="corpoForte" cor={cores.perigo} style={{ flex: 1 }}>
              {r.bloqueio}
            </T>
          </View>
        ) : null}
      </ScrollView>

      <View style={[estilos.rodape, { paddingBottom: baixo + espaco.m }]}>
        <Botao
          titulo={faltando ?? `Fazer pedido · ${dinheiro(r.valores.totalCents)}`}
          desativado={!!faltando || resumo.isFetching}
          carregando={pedir.isPending}
          aoTocar={finalizar}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.l, paddingBottom: 120 },
  alternador: {
    flexDirection: 'row',
    padding: espaco.xs,
    borderRadius: raio.total,
    backgroundColor: cores.superficieAlta,
  },
  aba: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.total,
  },
  abaLigada: { backgroundColor: cores.marca },
  cupom: { flexDirection: 'row', gap: espaco.s },
  bloqueio: {
    flexDirection: 'row',
    gap: espaco.s,
    alignItems: 'center',
    padding: espaco.m,
    borderRadius: raio.medio,
    backgroundColor: cores.perigoClaro,
  },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: espaco.l,
    paddingTop: espaco.m,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.linha,
  },
});
