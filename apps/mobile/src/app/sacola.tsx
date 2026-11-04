import { router, Stack } from 'expo-router';
import { AlertTriangle, ShoppingBag } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { CarrinhoDaLoja } from '@contrato';
import { useAlterarItem, useCarrinho } from '@/api/carrinho';
import { ErroDaApi } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Botao, dinheiro, EstadoDaTela, ErroDaTela, Esqueleto, Foto, T } from '@/componentes/base';
import { useFolgaInferior } from '@/componentes/folga';
import { Cartao, Contador } from '@/componentes/formulario';
import { ehAjusteDoPrato } from '@/componentes/linhas';
import { cores, espaco, raio } from '@/tema/tokens';

export default function Sacola() {
  const folga = useFolgaInferior(espaco.xxl);
  const { usuario } = useSessao();
  const carrinho = useCarrinho();

  const conteudo = !usuario ? (
    <EstadoDaTela
      Icone={ShoppingBag}
      titulo="Entre para usar a sacola"
      descricao="Com o celular confirmado, sua sacola fica salva."
      acao={<Botao titulo="Entrar com celular" aoTocar={() => router.replace('/entrar')} />}
    />
  ) : carrinho.isError ? (
    <ErroDaTela
      mensagem={carrinho.error instanceof ErroDaApi ? carrinho.error.message : 'Tente de novo.'}
      aoTentar={() => void carrinho.refetch()}
    />
  ) : !carrinho.data ? (
    <View style={estilos.corpo}>
      <Esqueleto estilo={{ height: 200 }} />
    </View>
  ) : carrinho.data.carrinhos.length === 0 ? (
    <EstadoDaTela
      Icone={ShoppingBag}
      titulo="Sua sacola está vazia"
      descricao="Escolha uma loja e adicione o que quiser."
      acao={<Botao titulo="Ver lojas" aoTocar={() => router.navigate('/')} />}
    />
  ) : (
    <ScrollView contentContainerStyle={[estilos.corpo, { paddingBottom: folga }]}>
      {carrinho.data.carrinhos.length > 1 ? (
        <T v="legenda" cor={cores.textoMedio}>
          Cada loja vira um pedido separado, com entrega própria.
        </T>
      ) : null}
      {carrinho.data.carrinhos.map((c) => (
        <CarrinhoDeUmaLoja key={c.id} carrinho={c} />
      ))}
    </ScrollView>
  );

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ title: 'Sacola' }} />
      {conteudo}
    </View>
  );
}

function CarrinhoDeUmaLoja({ carrinho }: { carrinho: CarrinhoDaLoja }) {
  const alterar = useAlterarItem();
  const faltaMinimo = carrinho.loja.pedidoMinimoCents - carrinho.subtotalCents;

  return (
    <Cartao>
      <T v="titulo2">{carrinho.loja.nome}</T>
      {carrinho.itens.map((item) => (
        <View key={item.id} style={estilos.item}>
          <Foto url={item.imagemUrl} tamanhoDoIcone={20} estilo={estilos.foto} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="corpoForte" numberOfLines={2}>
              {item.nome}
            </T>
            {item.pizza ? (
              <T v="legenda" cor={cores.textoMedio}>
                {item.pizza.tamanho} · {item.pizza.sabores.map((s) => s.nome).join(' / ')}
              </T>
            ) : null}
            {item.complementos.length ? (
              <T v="legenda" cor={cores.textoMedio} numberOfLines={2}>
                {item.complementos.map((c) => c.nome).join(', ')}
              </T>
            ) : null}
            {item.marmita?.linhas.map((linha) => (
              <T
                key={`${linha.grupo}-${linha.nome}`}
                v="legenda"
                cor={ehAjusteDoPrato(linha.nome) ? cores.perigo : cores.textoMedio}
              >
                {ehAjusteDoPrato(linha.nome) ? linha.nome : `${linha.grupo}: ${linha.nome}`}
              </T>
            ))}
            {item.gramas ? (
              <T v="legenda" cor={cores.textoMedio}>
                {item.gramas} g
              </T>
            ) : null}
            {item.indisponivel ? (
              <T v="legenda" cor={cores.perigo}>
                {item.motivoIndisponivel ?? 'Indisponível agora'}
              </T>
            ) : null}
            <T v="corpoForte" cor={cores.marcaEscura}>
              {dinheiro(item.totalCents)}
            </T>
          </View>
          <Contador
            valor={item.quantidade}
            aoMudar={(quantidade) => alterar.mutate({ id: item.id, quantidade })}
          />
        </View>
      ))}

      {carrinho.temIndisponivel ? (
        <View style={estilos.aviso}>
          <AlertTriangle size={18} color={cores.perigo} />
          <T v="legenda" cor={cores.perigo} style={{ flex: 1 }}>
            Tire os itens indisponíveis para fechar o pedido.
          </T>
        </View>
      ) : null}

      <View style={estilos.total}>
        <T cor={cores.textoMedio}>Subtotal</T>
        <T v="titulo3">{dinheiro(carrinho.subtotalCents)}</T>
      </View>
      {faltaMinimo > 0 ? (
        <T v="legenda" cor={cores.aviso}>
          Faltam {dinheiro(faltaMinimo)} para o pedido mínimo da loja.
        </T>
      ) : null}
      <Botao
        titulo="Fechar pedido"
        desativado={carrinho.temIndisponivel || faltaMinimo > 0}
        aoTocar={() =>
          router.push({ pathname: '/checkout/[loja]', params: { loja: carrinho.lojaId } })
        }
      />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  corpo: { padding: espaco.l, gap: espaco.l, paddingBottom: espaco.xxl },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco.m },
  foto: { width: 56, height: 56, borderRadius: raio.medio },
  aviso: { flexDirection: 'row', gap: espaco.s, alignItems: 'center' },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: espaco.s,
    borderTopWidth: 1,
    borderTopColor: cores.linha,
  },
});
