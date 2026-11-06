import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useFocusEffect, type ErrorBoundaryProps } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RespostaAlternarFavorito, RespostaFavoritos } from '@contrato';
import { avisarErro } from '@/api/carrinho';
import { chamar, ErroDaApi } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Botao, ErroDaTela, Esqueleto, T, Toque } from '@/componentes/base';
import { TopoDaTela } from '@/componentes/topo';
import { CartaoDeLoja } from '@/componentes/vitrine';
import { cores, elevacao, espaco, raio, toqueMinimo } from '@/tema/tokens';

const MASCOTE = require('@/assets/marca/mascote.png');

export default function Favoritos() {
  const folga = useSafeAreaInsets().bottom + espaco.xl;
  const { usuario } = useSessao();
  const consultas = useQueryClient();

  const favoritos = useQuery({
    queryKey: ['favoritos'],
    queryFn: () => chamar<RespostaFavoritos>('favoritos'),
    enabled: !!usuario,
  });

  const alternar = useMutation({
    mutationFn: (lojaId: string) =>
      chamar<RespostaAlternarFavorito>('favoritos/alternar', { metodo: 'POST', corpo: { lojaId } }),
    onSuccess: () => {
      void consultas.invalidateQueries({ queryKey: ['favoritos'] });
      void consultas.invalidateQueries({ queryKey: ['loja'] });
    },
    onError: avisarErro,
  });

  // A aba fica montada por trás das outras: ao voltar, confere o que foi favoritado na loja.
  useFocusEffect(
    useCallback(() => {
      if (usuario) void consultas.invalidateQueries({ queryKey: ['favoritos'] });
    }, [usuario, consultas]),
  );

  const lojas = favoritos.data?.lojas ?? [];

  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopoDaTela
        voltar
        titulo="Lojas favoritas"
        Icone={Heart}
        subtitulo="Suas lojas preferidas, a um toque."
      />
      {!usuario ? (
        <Vazio
          texto="Entre com seu celular para guardar suas lojas preferidas."
          botao="Entrar com celular"
          aoTocar={() => router.push('/entrar')}
        />
      ) : favoritos.isError ? (
        <ErroDaTela
          mensagem={
            favoritos.error instanceof ErroDaApi ? favoritos.error.message : 'Tente de novo.'
          }
          aoTentar={() => void favoritos.refetch()}
        />
      ) : !favoritos.data || (lojas.length === 0 && favoritos.isFetching) ? (
        <View style={estilos.lista}>
          {[0, 1, 2].map((i) => (
            <Esqueleto key={i} estilo={{ height: 136, borderRadius: raio.folha }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={lojas}
          keyExtractor={(l) => l.id}
          contentContainerStyle={[
            estilos.lista,
            { paddingBottom: folga },
            lojas.length === 0 && { flexGrow: 1 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={favoritos.isRefetching}
              onRefresh={() => void favoritos.refetch()}
              colors={[cores.marca]}
            />
          }
          ListEmptyComponent={
            <Vazio
              texto="Toque no coração de uma loja para ela aparecer aqui."
              botao="Ver lojas"
              aoTocar={() => router.navigate('/')}
            />
          }
          renderItem={({ item }) => (
            <View>
              <CartaoDeLoja loja={item} cidade={item.cidadeSlug} />
              <Toque
                accessibilityLabel={`Tirar ${item.nome} dos favoritos`}
                onPress={() => alternar.mutate(item.id)}
                style={[estilos.coracao, elevacao.baixa]}
              >
                <Heart size={22} color={cores.marca} fill={cores.marca} />
              </Toque>
            </View>
          )}
        />
      )}
    </View>
  );
}

/** Se a tela quebrar, mostra o motivo em vez de fechar o app e voltar ao início. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={estilos.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopoDaTela voltar titulo="Lojas favoritas" Icone={Heart} />
      <ErroDaTela
        mensagem={`Não deu para mostrar seus favoritos. ${error.message}`}
        aoTentar={() => void retry()}
      />
    </View>
  );
}

function Vazio({ texto, botao, aoTocar }: { texto: string; botao: string; aoTocar: () => void }) {
  return (
    <View style={estilos.vazio}>
      <Image source={MASCOTE} style={estilos.mascote} contentFit="contain" />
      <T v="titulo2" style={estilos.centro}>
        Nenhum favorito ainda
      </T>
      <T cor={cores.textoMedio} style={estilos.centro}>
        {texto}
      </T>
      <Botao titulo={botao} aoTocar={aoTocar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { paddingVertical: espaco.l, gap: espaco.m },
  coracao: {
    position: 'absolute',
    top: espaco.s,
    right: espaco.l + espaco.s,
    width: toqueMinimo,
    height: toqueMinimo,
    borderRadius: raio.total,
    backgroundColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
