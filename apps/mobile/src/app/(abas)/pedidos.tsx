import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { CalendarDays, ChevronRight, ClipboardList } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { PedidoResumido, RespostaPedidos } from '@contrato';
import { chamar, ErroDaApi } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Botao, dinheiro, ErroDaTela, Esqueleto, T, Toque } from '@/componentes/base';
import { SeloDoStatus, TrilhaDoPedido } from '@/componentes/pedido';
import { Pilulas, TopoEscuro } from '@/componentes/topo';
import { cores, elevacao, espaco, raio } from '@/tema/tokens';

const MASCOTE = require('@/assets/marca/mascote.png');

type Filtro = 'todos' | 'andamento' | 'concluidos';

export default function Pedidos() {
  const { usuario } = useSessao();
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const pedidos = useQuery({
    queryKey: ['pedidos'],
    queryFn: () => chamar<RespostaPedidos>('pedidos'),
    enabled: !!usuario,
    // Pedido em andamento muda de estado sozinho: a lista acompanha.
    refetchInterval: (consulta) =>
      consulta.state.data?.pedidos.some((p) => p.ativo) ? 15_000 : false,
  });

  const todos = pedidos.data?.pedidos ?? [];
  const lista = todos.filter((p) =>
    filtro === 'todos' ? true : filtro === 'andamento' ? p.ativo : !p.ativo,
  );

  return (
    <View style={estilos.tela}>
      <TopoEscuro titulo="Meus pedidos" Icone={ClipboardList}>
        {usuario ? (
          <Pilulas<Filtro>
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { chave: 'todos', rotulo: 'Todos' },
              { chave: 'andamento', rotulo: 'Em andamento' },
              { chave: 'concluidos', rotulo: 'Concluídos' },
            ]}
          />
        ) : null}
      </TopoEscuro>

      {!usuario ? (
        <Vazio
          titulo="Entre para ver seus pedidos"
          texto="Com seu celular confirmado, você pede e acompanha a entrega em tempo real."
          botao="Entrar com celular"
          aoTocar={() => router.push('/entrar')}
        />
      ) : pedidos.isError ? (
        <ErroDaTela
          mensagem={pedidos.error instanceof ErroDaApi ? pedidos.error.message : 'Tente de novo.'}
          aoTentar={() => void pedidos.refetch()}
        />
      ) : !pedidos.data ? (
        <View style={estilos.lista}>
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} estilo={{ height: 120, borderRadius: raio.folha }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[estilos.lista, lista.length === 0 && { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={pedidos.isRefetching}
              onRefresh={() => void pedidos.refetch()}
              colors={[cores.marca]}
            />
          }
          ListEmptyComponent={
            todos.length === 0 ? (
              <Vazio
                titulo="Você ainda não fez nenhum pedido."
                texto="Explore as lojas da sua cidade e faça seu primeiro pedido!"
                botao="Ver lojas"
                aoTocar={() => router.navigate('/')}
              />
            ) : (
              <Vazio
                titulo="Nada neste filtro"
                texto="Troque o filtro para ver os outros pedidos."
              />
            )
          }
          renderItem={({ item }) => <CartaoDoPedido pedido={item} />}
        />
      )}
    </View>
  );
}

function Vazio({
  titulo,
  texto,
  botao,
  aoTocar,
}: {
  titulo: string;
  texto: string;
  botao?: string;
  aoTocar?: () => void;
}) {
  return (
    <View style={estilos.vazio}>
      <Image source={MASCOTE} style={estilos.mascote} contentFit="contain" />
      <T v="titulo2" style={estilos.centro}>
        {titulo}
      </T>
      <T cor={cores.textoMedio} style={estilos.centro}>
        {texto}
      </T>
      {botao && aoTocar ? <Botao titulo={botao} aoTocar={aoTocar} /> : null}
    </View>
  );
}

function CartaoDoPedido({ pedido }: { pedido: PedidoResumido }) {
  const data = new Date(pedido.criadoEm).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Toque
      encolhe={0.99}
      accessibilityLabel={`Pedido ${pedido.numero} de ${pedido.loja.nome}, ${pedido.rotuloDoStatus}`}
      onPress={() => router.push({ pathname: '/pedido/[id]', params: { id: pedido.id } })}
      style={[estilos.cartao, elevacao.baixa]}
    >
      <View style={estilos.linha}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="titulo3" numberOfLines={1}>
            {pedido.loja.nome}
          </T>
          <T v="legenda" cor={cores.textoMedio}>
            Pedido #{pedido.numero}
          </T>
        </View>
        <ChevronRight size={22} color={cores.textoMedio} />
      </View>
      <SeloDoStatus status={pedido.status} rotulo={pedido.rotuloDoStatus} />
      {pedido.ativo ? (
        <TrilhaDoPedido status={pedido.status} tipo="DELIVERY" />
      ) : (
        <View style={estilos.linha}>
          <CalendarDays size={16} color={cores.textoMedio} />
          <T v="legenda" cor={cores.textoMedio} style={{ flex: 1 }}>
            {data}
          </T>
          <T v="corpoForte">{dinheiro(pedido.totalCents)}</T>
        </View>
      )}
    </Toque>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { padding: espaco.l, paddingBottom: 110, gap: espaco.m },
  cartao: {
    backgroundColor: cores.superficie,
    borderRadius: raio.folha,
    padding: espaco.l,
    gap: espaco.m,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.s },
  vazio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: espaco.xl,
    gap: espaco.m,
  },
  mascote: { width: 180, height: 150 },
  centro: { textAlign: 'center' },
});
