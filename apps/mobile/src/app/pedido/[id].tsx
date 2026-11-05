import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Bike,
  Check,
  Copy,
  MapPin,
  MessageCircle,
  Phone,
  Receipt,
  Star,
  XCircle,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { ConfiguracaoDoApp, PedidoDetalhado, StatusDoPedido } from '@contrato';
import { avisarErro } from '@/api/carrinho';
import { chamar, enviarImagem, ErroDaApi } from '@/api/cliente';
import { Botao, dinheiro, ErroDaTela, Esqueleto, T, Toque } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { Campo, Cartao, Linha } from '@/componentes/formulario';
import { ehAjusteDoPrato, linhaDoComplemento } from '@/componentes/linhas';
import { MapaDaEntrega } from '@/componentes/mapa-da-entrega';
import { cores, degradeDaMarca, espaco, raio, toqueMinimo } from '@/tema/tokens';

/** As etapas que o cliente reconhece, na ordem em que acontecem. */
const ETAPAS: { status: StatusDoPedido[]; rotulo: string }[] = [
  { status: ['PENDING_PAYMENT', 'RECEIVED'], rotulo: 'Recebido' },
  { status: ['ACCEPTED', 'PREPARING'], rotulo: 'Preparando' },
  { status: ['READY'], rotulo: 'Pronto' },
  { status: ['OUT_FOR_DELIVERY'], rotulo: 'A caminho' },
  { status: ['DELIVERED'], rotulo: 'Entregue' },
];

export default function Pedido() {
  const folga = useFolgaInferior(espaco.xxl);
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultas = useQueryClient();

  const pedido = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => chamar<PedidoDetalhado>(`pedidos/${id}`),
    // Enquanto anda, a tela acompanha sozinha; a caminho, mais depressa, pela moto no mapa.
    refetchInterval: (consulta) => {
      const atual = consulta.state.data;
      if (!atual?.ativo) return false;
      return atual.status === 'OUT_FOR_DELIVERY' ? 5_000 : 10_000;
    },
  });

  const configuracao = useQuery({
    queryKey: ['configuracao'],
    queryFn: () => chamar<ConfiguracaoDoApp>('configuracao'),
    staleTime: 10 * 60_000,
  });
  const [mapaFalhou, setMapaFalhou] = useState(false);

  const atualizar = (novo: PedidoDetalhado) => consultas.setQueryData(['pedido', id], novo);

  const cancelar = useMutation({
    mutationFn: () =>
      chamar<PedidoDetalhado>(`pedidos/${id}/cancelar`, { metodo: 'POST', corpo: {} }),
    onSuccess: () => void pedido.refetch(),
    onError: avisarErro,
  });

  const p = pedido.data;

  if (pedido.isError && !p) {
    return (
      <ErroDaTela
        mensagem={pedido.error instanceof ErroDaApi ? pedido.error.message : 'Tente de novo.'}
        aoTentar={() => void pedido.refetch()}
      />
    );
  }

  if (!p) {
    return (
      <View style={estilos.corpo}>
        <Esqueleto estilo={{ height: 180 }} />
        <Esqueleto estilo={{ height: 120 }} />
      </View>
    );
  }

  const cancelado = p.status === 'CANCELLED' || p.status === 'REJECTED';
  const etapaAtual = ETAPAS.findIndex((e) => e.status.includes(p.status));
  const etapas = p.tipo === 'PICKUP' ? ETAPAS.filter((e) => e.rotulo !== 'A caminho') : ETAPAS;
  const atual = p.tipo === 'PICKUP' && etapaAtual > 3 ? etapaAtual - 1 : etapaAtual;

  const chaveDoMapa = configuracao.data?.googleMapsApiKey;
  const posicao = p.entregador?.posicao ?? null;
  // O mapa só aparece com algo para mostrar além da loja: a casa ou a moto.
  const comMapa =
    !!chaveDoMapa &&
    !mapaFalhou &&
    p.ativo &&
    p.tipo === 'DELIVERY' &&
    !!(p.mapa?.destino || posicao);

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ title: `Pedido #${p.numero}` }} />
      <ScrollView
        contentContainerStyle={[estilos.corpo, { paddingBottom: folga }]}
        refreshControl={
          <RefreshControl
            refreshing={pedido.isRefetching}
            onRefresh={() => void pedido.refetch()}
            colors={[cores.marca]}
          />
        }
      >
        <LinearGradient
          colors={cancelado ? ['#8C7768', '#6F5B4F'] : degradeDaMarca}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.destaque}
        >
          <T v="mini" cor="rgba(255,255,255,0.85)">
            {p.loja.nome.toUpperCase()}
          </T>
          <T v="titulo1" cor={cores.textoNaCor}>
            {p.rotuloDoStatus}
          </T>
          <T cor={cores.textoNaCor}>{p.motivoDoCancelamento ?? p.mensagemDoStatus}</T>
          {!cancelado ? (
            <View style={estilos.etapas}>
              {etapas.map((e, i) => (
                <View key={e.rotulo} style={estilos.etapa}>
                  <View style={[estilos.bolinha, i <= atual && estilos.bolinhaFeita]}>
                    {i < atual ? <Check size={12} color={cores.marca} strokeWidth={3} /> : null}
                  </View>
                  <T v="mini" cor={i <= atual ? cores.textoNaCor : 'rgba(255,255,255,0.6)'}>
                    {e.rotulo}
                  </T>
                </View>
              ))}
            </View>
          ) : null}
        </LinearGradient>

        {comMapa && chaveDoMapa ? (
          <MapaDaEntrega
            chave={chaveDoMapa}
            pontos={{
              loja: p.mapa?.loja ?? null,
              destino: p.mapa?.destino ?? null,
              entregador: posicao,
            }}
            aoFalhar={() => setMapaFalhou(true)}
          />
        ) : null}

        {p.entregador ? <CartaoDoEntregador pedido={p} comMapa={comMapa} /> : null}

        {p.pagamento?.pix && p.pagamento.status !== 'PAID' && !cancelado ? (
          <CartaoDoPix pedido={p} aoAtualizar={() => void pedido.refetch()} />
        ) : null}

        <Cartao>
          <T v="titulo3">Itens</T>
          {p.itens.map((item) => (
            <View key={item.id} style={estilos.item}>
              <T v="corpoForte" cor={cores.marcaEscura}>
                {item.quantidade}x
              </T>
              <View style={{ flex: 1 }}>
                <T>{item.substituto ? `${item.substituto.nome} (troca)` : item.nome}</T>
                {item.sabores.length ? (
                  <T v="legenda" cor={cores.textoMedio}>
                    {[item.pizzaTamanho, item.sabores.map((s) => s.nome).join(' / ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </T>
                ) : null}
                {item.complementos.map((complemento) => (
                  <T
                    key={complemento.id}
                    v="legenda"
                    cor={ehAjusteDoPrato(complemento.nome) ? cores.perigo : cores.textoMedio}
                  >
                    {linhaDoComplemento(complemento.nome, complemento.quantidade)}
                  </T>
                ))}
                {item.statusDaSeparacao === 'MISSING' ? (
                  <T v="legenda" cor={cores.perigo}>
                    Faltou na loja
                  </T>
                ) : null}
              </View>
              <T v="corpoForte">{dinheiro(item.totalCents)}</T>
            </View>
          ))}
          <Linha rotulo="Subtotal" valor={dinheiro(p.subtotalCents)} />
          <Linha
            rotulo="Entrega"
            valor={p.taxaEntregaCents ? dinheiro(p.taxaEntregaCents) : 'Grátis'}
          />
          {p.descontoCents ? (
            <Linha rotulo="Desconto" valor={`- ${dinheiro(p.descontoCents)}`} />
          ) : null}
          <Linha rotulo="Total" valor={dinheiro(p.totalCents)} forte />
        </Cartao>

        {p.endereco ? (
          <Cartao>
            <View style={estilos.linha}>
              <MapPin size={20} color={cores.marcaEscura} />
              <View style={{ flex: 1 }}>
                <T v="corpoForte">
                  {p.endereco.rua}
                  {p.endereco.numero ? `, ${p.endereco.numero}` : ''}
                </T>
                <T v="legenda" cor={cores.textoMedio}>
                  {[p.endereco.bairro, p.endereco.complemento, p.endereco.referencia]
                    .filter(Boolean)
                    .join(' · ')}
                </T>
              </View>
            </View>
          </Cartao>
        ) : null}

        {p.loja.whatsapp || p.loja.telefone ? (
          <Botao
            titulo="Falar com a loja"
            variante="secundario"
            Icone={MessageCircle}
            aoTocar={() =>
              void Linking.openURL(
                p.loja.whatsapp
                  ? `https://wa.me/${p.loja.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Oi! Sobre o pedido #${p.numero}`)}`
                  : `tel:${p.loja.telefone}`,
              )
            }
          />
        ) : null}

        {p.podeAvaliar && !p.jaAvaliado ? <Avaliacao id={p.id} aoAvaliar={atualizar} /> : null}

        {p.podeCancelar ? (
          <Botao
            titulo="Cancelar pedido"
            variante="perigo"
            Icone={XCircle}
            carregando={cancelar.isPending}
            aoTocar={() =>
              Alert.alert('Cancelar o pedido?', 'A loja é avisada na hora.', [
                { text: 'Voltar', style: 'cancel' },
                { text: 'Cancelar pedido', style: 'destructive', onPress: () => cancelar.mutate() },
              ])
            }
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function CartaoDoEntregador({ pedido, comMapa }: { pedido: PedidoDetalhado; comMapa: boolean }) {
  const e = pedido.entregador!;
  const posicao = e.posicao;
  return (
    <Cartao>
      <View style={estilos.linha}>
        <View style={estilos.iconeRedondo}>
          <Bike size={22} color={cores.marcaEscura} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="titulo3">{e.nome}</T>
          <T v="legenda" cor={cores.textoMedio}>
            Seu entregador
          </T>
        </View>
        {e.telefone ? (
          <Toque
            accessibilityLabel="Ligar para o entregador"
            onPress={() => void Linking.openURL(`tel:${e.telefone}`)}
            style={estilos.ligar}
          >
            <Phone size={20} color={cores.textoNaCor} />
          </Toque>
        ) : null}
      </View>
      {posicao && !comMapa ? (
        <Botao
          titulo="Ver no mapa"
          variante="secundario"
          Icone={MapPin}
          aoTocar={() =>
            void Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${posicao.latitude},${posicao.longitude}`,
            )
          }
        />
      ) : null}
    </Cartao>
  );
}

function CartaoDoPix({
  pedido,
  aoAtualizar,
}: {
  pedido: PedidoDetalhado;
  aoAtualizar: () => void;
}) {
  const pix = pedido.pagamento!.pix!;
  const [enviando, setEnviando] = useState(false);
  const codigo = pix.copiaECola ?? pix.chave;

  const enviarComprovante = async () => {
    const escolha = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      mediaTypes: ['images'],
    });
    if (escolha.canceled) return;
    setEnviando(true);
    try {
      const imagem = await enviarImagem(escolha.assets[0].uri, 'comprovante');
      await chamar(`pedidos/${pedido.id}/comprovante`, {
        metodo: 'POST',
        corpo: { imagemId: imagem.id },
      });
      aoAtualizar();
    } catch (erro) {
      avisarErro(erro);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Cartao estilo={{ borderWidth: 2, borderColor: cores.sucesso }}>
      <T v="titulo3">Pague {dinheiro(pedido.totalCents)} no Pix</T>
      <T v="legenda" cor={cores.textoMedio}>
        O Pix vai direto para a loja. Ela confere o recebimento e libera o preparo.
      </T>
      {codigo ? (
        <>
          <View style={estilos.codigo}>
            <T v="legenda" numberOfLines={2} style={{ flex: 1 }}>
              {codigo}
            </T>
          </View>
          <Botao
            titulo={pix.copiaECola ? 'Copiar Pix copia e cola' : 'Copiar chave Pix'}
            Icone={Copy}
            aoTocar={() => {
              void Clipboard.setStringAsync(codigo);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Copiado', 'Agora cole no app do seu banco.');
            }}
          />
        </>
      ) : null}
      {pedido.podeEnviarComprovante ? (
        <Botao
          titulo={pix.comprovanteEnviado ? 'Comprovante enviado' : 'Enviar comprovante (opcional)'}
          variante="secundario"
          Icone={Receipt}
          carregando={enviando}
          desativado={pix.comprovanteEnviado}
          aoTocar={() => void enviarComprovante()}
        />
      ) : null}
    </Cartao>
  );
}

function Avaliacao({ id, aoAvaliar }: { id: string; aoAvaliar: (p: PedidoDetalhado) => void }) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const avaliar = useMutation({
    mutationFn: () =>
      chamar<PedidoDetalhado>(`pedidos/${id}/avaliar`, {
        metodo: 'POST',
        corpo: { notaDaLoja: nota, comentarioDaLoja: comentario.trim() || undefined },
      }),
    onSuccess: (p) => (p?.id ? aoAvaliar(p) : undefined),
    onError: avisarErro,
  });

  if (avaliar.isSuccess) {
    return (
      <Cartao>
        <T v="titulo3">Obrigado pela avaliação!</T>
      </Cartao>
    );
  }

  return (
    <Cartao>
      <T v="titulo3">Como foi o pedido?</T>
      <View style={estilos.estrelas}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Toque
            key={n}
            accessibilityLabel={`${n} estrelas`}
            onPress={() => setNota(n)}
            style={estilos.estrela}
          >
            <Star
              size={32}
              color={cores.amarelo}
              fill={n <= nota ? cores.amarelo : 'transparent'}
            />
          </Toque>
        ))}
      </View>
      {nota ? (
        <>
          <Campo
            rotulo="Quer contar mais? (opcional)"
            value={comentario}
            onChangeText={setComentario}
            maxLength={300}
            multiline
          />
          <Botao
            titulo="Enviar avaliação"
            carregando={avaliar.isPending}
            aoTocar={() => avaliar.mutate()}
          />
        </>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.l, paddingBottom: espaco.xxl },
  destaque: { borderRadius: raio.folha, padding: espaco.xl, gap: espaco.s },
  etapas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: espaco.m },
  etapa: { alignItems: 'center', gap: espaco.xs, flex: 1 },
  bolinha: {
    width: 22,
    height: 22,
    borderRadius: raio.total,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bolinhaFeita: { backgroundColor: cores.superficie, borderColor: cores.superficie },
  item: { flexDirection: 'row', gap: espaco.m, alignItems: 'flex-start' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  iconeRedondo: {
    width: 44,
    height: 44,
    borderRadius: raio.total,
    backgroundColor: cores.marcaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligar: {
    width: toqueMinimo,
    height: toqueMinimo,
    borderRadius: raio.total,
    backgroundColor: cores.sucesso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codigo: {
    flexDirection: 'row',
    padding: espaco.m,
    borderRadius: raio.medio,
    backgroundColor: cores.sucessoClaro,
  },
  estrelas: { flexDirection: 'row', justifyContent: 'center' },
  estrela: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
});
