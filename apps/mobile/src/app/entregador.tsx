import { useMutation, useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import { Bike, MapPin, Navigation, Phone, ShieldAlert, Store } from 'lucide-react-native';
import { useEffect } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import type {
  CorridaDisponivel,
  CorridaMinha,
  EnderecoDoPedido,
  PainelDoEntregador,
  TipoDeCorrida,
} from '@contrato';
import { avisarErro } from '@/api/carrinho';
import { chamar, ErroDaApi } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Botao, dinheiro, EstadoDaTela, ErroDaTela, Esqueleto, T } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { Cartao } from '@/componentes/formulario';
import { cores, espaco, raio } from '@/tema/tokens';

const INTERVALO_DA_POSICAO = 10_000;

const textoDoEndereco = (e: EnderecoDoPedido | null) =>
  e ? [`${e.rua}${e.numero ? `, ${e.numero}` : ''}`, e.bairro].join(' · ') : 'Retirada no balcão';

export default function Entregador() {
  const folga = useFolgaInferior(espaco.xxl);
  const { usuario } = useSessao();
  const aprovado = usuario?.entregador?.status === 'ACTIVE';

  const painel = useQuery({
    queryKey: ['painel-do-entregador'],
    queryFn: () => chamar<PainelDoEntregador>('entregador/painel'),
    enabled: aprovado,
    refetchInterval: 12_000,
  });

  const emCorrida =
    (painel.data?.minhas.length ?? 0) + (painel.data?.avulsasMinhas.length ?? 0) > 0;

  // A posição só sai do aparelho com corrida em andamento, e com o app aberto.
  useEffect(() => {
    if (!emCorrida) return;
    let ativo = true;
    const enviar = async () => {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted || !ativo) return;
      const atual = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await chamar('entregador/localizacao', {
        metodo: 'POST',
        corpo: { latitude: atual.coords.latitude, longitude: atual.coords.longitude },
      }).catch(() => undefined);
    };
    void Location.requestForegroundPermissionsAsync().then(enviar);
    const relogio = setInterval(() => void enviar(), INTERVALO_DA_POSICAO);
    return () => {
      ativo = false;
      clearInterval(relogio);
    };
  }, [emCorrida]);

  const disponibilidade = useMutation({
    mutationFn: (online: boolean) =>
      chamar('entregador/disponibilidade', { metodo: 'POST', corpo: { online } }),
    onSuccess: () => void painel.refetch(),
    onError: avisarErro,
  });

  const acao = useMutation({
    mutationFn: ({
      id,
      tipo,
      o,
      status,
    }: {
      id: string;
      tipo: TipoDeCorrida;
      o: 'aceitar' | 'recusar' | 'avancar';
      status?: 'PICKED_UP' | 'DELIVERED';
    }) => chamar(`entregador/corridas/${id}/${o}`, { metodo: 'POST', corpo: { tipo, status } }),
    onSuccess: () => void painel.refetch(),
    onError: avisarErro,
  });

  if (!aprovado) {
    return (
      <View style={estilos.tela}>
        <Stack.Screen options={{ title: 'Entregador' }} />
        <EstadoDaTela
          Icone={Bike}
          titulo={usuario?.entregador ? 'Cadastro em análise' : 'Seja entregador Rapidinho'}
          descricao={
            usuario?.entregador
              ? 'Assim que a equipe conferir sua CNH e o veículo, as corridas aparecem aqui.'
              : 'Faça o cadastro com seus documentos pelo site rapidinhoentrega.com.br/entregador.'
          }
        />
      </View>
    );
  }

  const p = painel.data;

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.corpo, { paddingBottom: folga }]}
      refreshControl={
        <RefreshControl
          refreshing={painel.isRefetching}
          onRefresh={() => void painel.refetch()}
          colors={[cores.marca]}
        />
      }
    >
      <Stack.Screen options={{ title: 'Modo entregador' }} />
      {painel.isError && !p ? (
        <ErroDaTela
          mensagem={painel.error instanceof ErroDaApi ? painel.error.message : 'Tente de novo.'}
          aoTentar={() => void painel.refetch()}
        />
      ) : !p ? (
        <Esqueleto estilo={{ height: 160 }} />
      ) : (
        <>
          <Cartao
            estilo={{
              backgroundColor: p.entregador.online ? cores.sucessoClaro : cores.superficie,
            }}
          >
            <View style={estilos.linha}>
              <View style={{ flex: 1 }}>
                <T v="titulo2">
                  {p.entregador.online ? 'Você está disponível' : 'Você está offline'}
                </T>
                <T v="legenda" cor={cores.textoMedio}>
                  Hoje: {dinheiro(p.ganhosDeHoje.ganhoCents)} em {p.ganhosDeHoje.entregas}{' '}
                  {p.ganhosDeHoje.entregas === 1 ? 'entrega' : 'entregas'}
                </T>
              </View>
              <Switch
                accessibilityLabel="Disponível para corridas"
                value={p.entregador.online}
                onValueChange={(v) => disponibilidade.mutate(v)}
                trackColor={{ true: cores.sucesso, false: cores.linha }}
                thumbColor={cores.superficie}
              />
            </View>
          </Cartao>

          {p.minhas.map((c) => (
            <CorridaEmAndamento
              key={c.id}
              corrida={c}
              ocupado={acao.isPending}
              aoAvancar={(status) =>
                acao.mutate({ id: c.id, tipo: 'pedido', o: 'avancar', status })
              }
            />
          ))}

          <T v="titulo2">Corridas disponíveis</T>
          {!p.entregador.online ? (
            <T cor={cores.textoMedio}>Fique disponível para ver e aceitar corridas.</T>
          ) : p.disponiveis.length === 0 && p.avulsasDisponiveis.length === 0 ? (
            <T cor={cores.textoMedio}>Nenhuma corrida agora. Avisamos quando surgir.</T>
          ) : (
            p.disponiveis.map((c) => (
              <CorridaDaFila
                key={c.id}
                corrida={c}
                ocupado={acao.isPending}
                aoAceitar={() => acao.mutate({ id: c.id, tipo: 'pedido', o: 'aceitar' })}
                aoRecusar={() => acao.mutate({ id: c.id, tipo: 'pedido', o: 'recusar' })}
              />
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function CorridaDaFila({
  corrida,
  ocupado,
  aoAceitar,
  aoRecusar,
}: {
  corrida: CorridaDisponivel;
  ocupado: boolean;
  aoAceitar: () => void;
  aoRecusar: () => void;
}) {
  return (
    <Cartao>
      <View style={estilos.linha}>
        <T v="titulo2" cor={cores.sucesso} style={{ flex: 1 }}>
          {dinheiro(corrida.ganhoCents)}
        </T>
        {corrida.distanciaMetros ? (
          <T v="corpoForte">
            {(corrida.distanciaMetros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}{' '}
            km
          </T>
        ) : null}
      </View>
      <Trecho Icone={Store} titulo={corrida.loja.nome} texto={corrida.loja.endereco} />
      <Trecho
        Icone={MapPin}
        titulo="Entrega"
        texto={corrida.destino?.bairro ?? 'Bairro informado ao aceitar'}
      />
      <View style={estilos.linha}>
        <Botao titulo="Recusar" variante="discreto" desativado={ocupado} aoTocar={aoRecusar} />
        <Botao
          titulo="Aceitar corrida"
          estilo={{ flex: 1 }}
          carregando={ocupado}
          aoTocar={aoAceitar}
        />
      </View>
    </Cartao>
  );
}

function CorridaEmAndamento({
  corrida,
  ocupado,
  aoAvancar,
}: {
  corrida: CorridaMinha;
  ocupado: boolean;
  aoAvancar: (status: 'PICKED_UP' | 'DELIVERED') => void;
}) {
  const retirada = corrida.status === 'PICKED_UP';
  const destino = retirada ? textoDoEndereco(corrida.destino) : corrida.loja.endereco;

  return (
    <Cartao estilo={{ borderWidth: 2, borderColor: cores.marca }}>
      <T v="mini" cor={cores.marcaEscura}>
        PEDIDO #{corrida.numero} · {retirada ? 'LEVANDO AO CLIENTE' : 'RETIRAR NA LOJA'}
      </T>
      <Trecho Icone={Store} titulo={corrida.loja.nome} texto={corrida.loja.endereco} />
      <Trecho Icone={MapPin} titulo={corrida.cliente} texto={textoDoEndereco(corrida.destino)} />
      {corrida.destino?.referencia ? (
        <T v="legenda" cor={cores.textoMedio}>
          Referência: {corrida.destino.referencia}
        </T>
      ) : null}
      {corrida.pagamento && corrida.pagamento.status !== 'PAID' ? (
        <View style={estilos.alerta}>
          <T v="corpoForte" cor={cores.aviso}>
            Receber {dinheiro(corrida.totalCents)} na entrega
            {corrida.pagamento.trocoParaCents
              ? ` · troco para ${dinheiro(corrida.pagamento.trocoParaCents)}`
              : ''}
          </T>
        </View>
      ) : null}
      {corrida.conferirDocumento || corrida.conferirReceita ? (
        <View style={estilos.alerta}>
          <ShieldAlert size={18} color={cores.aviso} />
          <T v="legenda" cor={cores.aviso} style={{ flex: 1 }}>
            {corrida.conferirReceita ? 'Recolha a receita original. ' : ''}
            {corrida.conferirDocumento ? 'Confira documento com foto (18+).' : ''}
          </T>
        </View>
      ) : null}
      <View style={estilos.linha}>
        <Botao
          titulo="Rota"
          variante="secundario"
          Icone={Navigation}
          aoTocar={() =>
            void Linking.openURL(
              `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`,
            )
          }
        />
        <Botao
          titulo="Ligar"
          variante="secundario"
          Icone={Phone}
          aoTocar={() =>
            void Linking.openURL(
              `tel:${retirada ? corrida.telefoneDoCliente : corrida.loja.telefone}`,
            )
          }
        />
      </View>
      <Botao
        titulo={retirada ? 'Entreguei' : 'Peguei o pedido'}
        carregando={ocupado}
        aoTocar={() => aoAvancar(retirada ? 'DELIVERED' : 'PICKED_UP')}
      />
    </Cartao>
  );
}

function Trecho({ Icone, titulo, texto }: { Icone: typeof Store; titulo: string; texto: string }) {
  return (
    <View style={estilos.trecho}>
      <Icone size={20} color={cores.marcaEscura} />
      <View style={{ flex: 1 }}>
        <T v="corpoForte">{titulo}</T>
        <T v="legenda" cor={cores.textoMedio}>
          {texto}
        </T>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.l, paddingBottom: espaco.xxl },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  trecho: { flexDirection: 'row', gap: espaco.m, alignItems: 'flex-start' },
  alerta: {
    flexDirection: 'row',
    gap: espaco.s,
    alignItems: 'center',
    padding: espaco.m,
    borderRadius: raio.medio,
    backgroundColor: cores.avisoClaro,
  },
});
