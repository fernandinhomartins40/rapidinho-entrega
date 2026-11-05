import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, MessageSquareText } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SessaoCriada } from '@contrato';
import { chamar, ErroDaApi, URL_DA_API } from '@/api/cliente';
import { conferirCodigo, enviarCodigo, mensagemDoFirebase, type Confirmacao } from '@/api/firebase';
import { useSessao } from '@/api/sessao';
import { Botao, T, Toque } from '@/componentes/base';
import { Opcao } from '@/componentes/formulario';
import { cores, degradeDaMarca, espaco, fontes, raio, toqueMinimo } from '@/tema/tokens';

const MASCOTE = require('@/assets/marca/mascote.png');
const ESPERA_PARA_REENVIO = 45;

/** "(11) 98888-7777" a partir dos dígitos digitados. */
function mascarar(digitos: string) {
  const d = digitos.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function Entrar() {
  const topo = useSafeAreaInsets().top;
  const { entrar } = useSessao();
  const [digitos, setDigitos] = useState('');
  const [aceite, setAceite] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  // Conta de revisão da Google Play: o servidor confere o código, sem SMS.
  const [revisao, setRevisao] = useState(false);
  const noCodigo = confirmacao != null || revisao;
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);
  const campoDoCodigo = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const pedirCodigo = async () => {
    setErro(null);
    setOcupado(true);
    try {
      const { revisao: daRevisao } = await chamar<{ revisao: boolean }>('auth/revisao', {
        metodo: 'POST',
        corpo: { telefone: digitos },
      }).catch(() => ({ revisao: false }));
      if (daRevisao) setRevisao(true);
      else setConfirmacao(await enviarCodigo(`+55${digitos}`));
      setEspera(ESPERA_PARA_REENVIO);
      setTimeout(() => campoDoCodigo.current?.focus(), 300);
    } catch (e) {
      setErro(mensagemDoFirebase(e));
    } finally {
      setOcupado(false);
    }
  };

  const confirmar = async (valor: string) => {
    if (!noCodigo || valor.length < 6) return;
    setErro(null);
    setOcupado(true);
    try {
      const sessao = confirmacao
        ? await chamar<SessaoCriada>('auth/firebase', {
            metodo: 'POST',
            corpo: { idToken: await conferirCodigo(confirmacao, valor) },
          })
        : await chamar<SessaoCriada>('auth/revisao', {
            metodo: 'POST',
            corpo: { telefone: digitos, codigo: valor },
          });
      await entrar(sessao.token, sessao.usuario);
      // Quem marcou o aceite nesta tela já leu a versão vigente.
      if (sessao.usuario.termosPendentes) {
        await chamar('eu/aceite-de-termos', { metodo: 'POST' }).catch(() => undefined);
      }
      // Conta criada pelo SMS só tem o telefone; a loja precisa do nome no pedido.
      if (!sessao.usuario.nome?.trim()) router.replace('/meus-dados');
      else if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : mensagemDoFirebase(e));
      setCodigo('');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient
          colors={degradeDaMarca}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[estilos.topo, { paddingTop: topo + espaco.s }]}
        >
          <Toque
            accessibilityLabel="Voltar"
            onPress={() => {
              if (!noCodigo) return router.back();
              setConfirmacao(null);
              setRevisao(false);
            }}
            style={estilos.voltar}
          >
            <ArrowLeft size={22} color={cores.textoNaCor} />
          </Toque>
          <Image source={MASCOTE} style={estilos.mascote} contentFit="contain" />
          <T v="gigante" cor={cores.textoNaCor}>
            {noCodigo ? 'Digite o código' : 'Entre com seu celular'}
          </T>
          <T cor="rgba(255,255,255,0.9)">
            {revisao
              ? 'Conta de revisão: digite o código de acesso.'
              : confirmacao
                ? `Mandamos um SMS para ${mascarar(digitos)}.`
                : 'Sem senha: confirmamos seu número por SMS.'}
          </T>
        </LinearGradient>

        <View style={estilos.corpo}>
          {!noCodigo ? (
            <>
              <View style={estilos.telefone}>
                <T v="titulo3" cor={cores.textoMedio}>
                  +55
                </T>
                <TextInput
                  autoFocus
                  accessibilityLabel="Celular com DDD"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={cores.textoFraco}
                  value={mascarar(digitos)}
                  onChangeText={(t) => setDigitos(t.replace(/\D/g, '').slice(0, 11))}
                  style={estilos.entradaGrande}
                />
              </View>
              <Opcao
                multipla
                titulo="Li e aceito os termos e a privacidade"
                marcada={aceite}
                aoTocar={() => setAceite((a) => !a)}
              />
              <View style={estilos.links}>
                <Toque onPress={() => void WebBrowser.openBrowserAsync(`${URL_DA_API}/termos`)}>
                  <T v="legenda" cor={cores.marcaEscura}>
                    Ler os termos
                  </T>
                </Toque>
                <Toque
                  onPress={() => void WebBrowser.openBrowserAsync(`${URL_DA_API}/privacidade`)}
                >
                  <T v="legenda" cor={cores.marcaEscura}>
                    Ler a privacidade
                  </T>
                </Toque>
              </View>
              {erro ? <T cor={cores.perigo}>{erro}</T> : null}
              <Botao
                titulo="Receber código por SMS"
                Icone={MessageSquareText}
                desativado={digitos.length < 10 || !aceite}
                carregando={ocupado}
                aoTocar={() => void pedirCodigo()}
              />
            </>
          ) : (
            <>
              <TextInput
                ref={campoDoCodigo}
                accessibilityLabel="Código de 6 números"
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                value={codigo}
                onChangeText={(t) => {
                  const limpo = t.replace(/\D/g, '');
                  setCodigo(limpo);
                  if (limpo.length === 6) void confirmar(limpo);
                }}
                placeholder="000000"
                placeholderTextColor={cores.textoFraco}
                style={[estilos.entradaGrande, estilos.codigo]}
              />
              {erro ? <T cor={cores.perigo}>{erro}</T> : null}
              <Botao
                titulo="Confirmar"
                desativado={codigo.length < 6}
                carregando={ocupado}
                aoTocar={() => void confirmar(codigo)}
              />
              <Botao
                titulo={espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar código'}
                variante="discreto"
                desativado={espera > 0 || ocupado}
                aoTocar={() => void pedirCodigo()}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    paddingHorizontal: espaco.l,
    paddingBottom: espaco.xl,
    gap: espaco.s,
    borderBottomLeftRadius: raio.folha,
    borderBottomRightRadius: raio.folha,
  },
  voltar: {
    width: toqueMinimo,
    height: toqueMinimo,
    borderRadius: raio.total,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  mascote: { width: 96, height: 96, alignSelf: 'flex-end', marginTop: -espaco.xl },
  corpo: { padding: espaco.l, gap: espaco.l },
  telefone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.m,
    paddingLeft: espaco.l,
    borderRadius: raio.medio,
    borderWidth: 1.5,
    borderColor: cores.marca,
    backgroundColor: cores.superficie,
  },
  entradaGrande: {
    flex: 1,
    minHeight: 60,
    fontFamily: fontes.titulo,
    fontSize: 22,
    color: cores.texto,
  },
  codigo: {
    flex: 0,
    textAlign: 'center',
    letterSpacing: 12,
    borderRadius: raio.medio,
    borderWidth: 1.5,
    borderColor: cores.marca,
    backgroundColor: cores.superficie,
  },
  links: { flexDirection: 'row', gap: espaco.xl },
});
