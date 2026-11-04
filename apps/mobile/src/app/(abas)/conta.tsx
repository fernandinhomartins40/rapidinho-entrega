import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { LucideIcon } from 'lucide-react-native';
import {
  Bike,
  ChevronRight,
  ClipboardList,
  FileText,
  LogOut,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
} from 'lucide-react-native';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConfiguracaoDoApp } from '@contrato';
import { useFolgaInferior } from '@/componentes/folga';
import { chamar, ErroDaApi, URL_DA_API } from '@/api/cliente';
import { useSessao } from '@/api/sessao';
import { Botao, T, Toque } from '@/componentes/base';
import { TopoEscuro } from '@/componentes/topo';
import {
  cores,
  degradeDaMarca,
  degradeDaNoite,
  elevacao,
  espaco,
  raio,
  toqueMinimo,
} from '@/tema/tokens';

const abrirNoSite = (caminho: string) =>
  void WebBrowser.openBrowserAsync(`${URL_DA_API}${caminho}`);

export default function Conta() {
  const topo = useSafeAreaInsets().top;
  const folga = useFolgaInferior(110);
  const { usuario, sair } = useSessao();

  const configuracao = useQuery({
    queryKey: ['configuracao'],
    queryFn: () => chamar<ConfiguracaoDoApp>('configuracao'),
    staleTime: 10 * 60_000,
  });
  const suporte = configuracao.data?.textos.suporteWhatsapp;

  if (!usuario) {
    return (
      <View style={estilos.tela}>
        <TopoEscuro
          titulo="Perfil"
          Icone={UserRound}
          subtitulo="Entre para salvar endereços e acompanhar pedidos."
        />
        <View style={estilos.corpo}>
          <Botao titulo="Entrar com celular" aoTocar={() => router.push('/entrar')} />
          <Grupo>
            <Item
              Icone={Store}
              titulo="Cadastrar minha loja"
              aoTocar={() => abrirNoSite('/cadastro-loja')}
            />
            <Item Icone={FileText} titulo="Termos de uso" aoTocar={() => abrirNoSite('/termos')} />
            <Item
              Icone={ShieldCheck}
              titulo="Privacidade"
              aoTocar={() => abrirNoSite('/privacidade')}
            />
          </Grupo>
        </View>
      </View>
    );
  }

  const excluir = () =>
    Alert.alert(
      'Excluir sua conta?',
      'Seus dados pessoais serão apagados e você sai do app. Pedidos antigos ficam só para fins fiscais, sem seu nome.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await chamar('eu', { metodo: 'DELETE' });
              await sair();
            } catch (erro) {
              Alert.alert(
                'Ainda não dá para excluir',
                erro instanceof ErroDaApi ? erro.message : 'Tente de novo em instantes.',
              );
            }
          },
        },
      ],
    );

  const inicial = (usuario.nome ?? '?').trim().charAt(0).toUpperCase();

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={{ paddingBottom: folga }}>
      <LinearGradient
        colors={degradeDaNoite}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[estilos.topo, { paddingTop: topo + espaco.l }]}
      >
        <View style={estilos.perfil}>
          <LinearGradient colors={degradeDaMarca} style={estilos.avatar}>
            <T v="gigante" cor={cores.textoNaCor}>
              {inicial}
            </T>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <T v="titulo1" cor={cores.textoNaNoite} numberOfLines={1}>
              {usuario.nome ?? 'Cliente Rapidinho'}
            </T>
            <T cor={cores.textoNaNoiteFraco}>{usuario.telefone}</T>
          </View>
        </View>
        {/* Onda laranja no pé do topo, como na identidade da marca. */}
        <LinearGradient
          colors={['#FFB21A', '#FF6A1F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={estilos.onda}
        />
      </LinearGradient>

      <View style={[estilos.corpo, { marginTop: -espaco.xl }]}>
        <Grupo>
          <Item
            Icone={ClipboardList}
            titulo="Meus pedidos"
            aoTocar={() => router.navigate('/pedidos')}
          />
          <Item Icone={MapPin} titulo="Meus endereços" aoTocar={() => router.push('/enderecos')} />
          <Item
            Icone={ShieldCheck}
            titulo="Meus dados e privacidade"
            aoTocar={() => abrirNoSite('/privacidade')}
          />
          <Item
            Icone={Store}
            titulo="Cadastrar minha loja"
            aoTocar={() => abrirNoSite('/cadastro-loja')}
          />
          {usuario.entregador || configuracao.data?.recursos.modoEntregador ? (
            <Item
              Icone={Bike}
              titulo={usuario.entregador ? 'Modo entregador' : 'Quero ser entregador'}
              aoTocar={() => router.push('/entregador')}
            />
          ) : null}
        </Grupo>

        <Grupo>
          {suporte ? (
            <Item
              Icone={MessageCircle}
              titulo="Ajuda pelo WhatsApp"
              aoTocar={() => void Linking.openURL(`https://wa.me/${suporte.replace(/\D/g, '')}`)}
            />
          ) : null}
          <Item Icone={FileText} titulo="Termos de uso" aoTocar={() => abrirNoSite('/termos')} />
        </Grupo>

        <Toque accessibilityLabel="Sair" onPress={() => void sair()} style={estilos.sair}>
          <LogOut size={22} color={cores.perigo} />
          <T v="titulo3" cor={cores.perigo}>
            Sair
          </T>
        </Toque>

        <Toque accessibilityLabel="Excluir minha conta" onPress={excluir} style={estilos.excluir}>
          <Trash2 size={16} color={cores.textoMedio} />
          <T v="legenda" cor={cores.textoMedio}>
            Excluir minha conta
          </T>
        </Toque>
      </View>
    </ScrollView>
  );
}

function Grupo({ children }: { children: React.ReactNode }) {
  return <View style={[estilos.grupo, elevacao.baixa]}>{children}</View>;
}

function Item({
  Icone,
  titulo,
  aoTocar,
}: {
  Icone: LucideIcon;
  titulo: string;
  aoTocar: () => void;
}) {
  return (
    <Toque encolhe={0.99} accessibilityLabel={titulo} onPress={aoTocar} style={estilos.item}>
      <Icone size={22} color={cores.texto} />
      <T v="corpoForte" style={{ flex: 1 }}>
        {titulo}
      </T>
      <ChevronRight size={20} color={cores.textoMedio} />
    </Toque>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    paddingHorizontal: espaco.l,
    paddingBottom: espaco.xxl + espaco.xl,
    overflow: 'hidden',
  },
  perfil: { flexDirection: 'row', alignItems: 'center', gap: espaco.l },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: raio.total,
    borderWidth: 3,
    borderColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onda: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -70,
    height: 110,
    borderTopLeftRadius: 400,
    borderTopRightRadius: 180,
    transform: [{ rotate: '-4deg' }],
  },
  corpo: { padding: espaco.l, gap: espaco.l },
  grupo: {
    backgroundColor: cores.superficie,
    borderRadius: raio.folha,
    paddingVertical: espaco.xs,
  },
  item: {
    minHeight: toqueMinimo + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingHorizontal: espaco.l,
  },
  sair: {
    minHeight: toqueMinimo + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.s,
    borderRadius: raio.total,
    borderWidth: 1.5,
    borderColor: cores.perigo,
    backgroundColor: cores.superficie,
  },
  excluir: {
    minHeight: toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.xs,
  },
});
