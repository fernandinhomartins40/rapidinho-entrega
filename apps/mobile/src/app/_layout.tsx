import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts as useFonteDeTitulo,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts as useFonteDeCorpo,
} from '@expo-google-fonts/dm-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProvedorDeCidade } from '@/api/cidade';
import { ErroDaApi } from '@/api/cliente';
import { ProvedorDeSessao } from '@/api/sessao';
import { AvisoDeTermos } from '@/componentes/aviso-de-termos';
import { cores, fontes } from '@/tema/tokens';

void SplashScreen.preventAutoHideAsync();

const consultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Erro de regra não melhora repetindo; só falha de rede vale nova tentativa.
      retry: (tentativas, erro) =>
        tentativas < 2 && erro instanceof ErroDaApi && erro.codigo === 'SEM_CONEXAO',
    },
  },
});

export default function Raiz() {
  const [titulos] = useFonteDeTitulo({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const [corpo] = useFonteDeCorpo({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const pronto = titulos && corpo;

  useEffect(() => {
    if (pronto) void SplashScreen.hideAsync();
  }, [pronto]);

  if (!pronto) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={consultas}>
          <ProvedorDeSessao>
            <ProvedorDeCidade>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShadowVisible: false,
                  headerStyle: { backgroundColor: cores.noite },
                  headerTintColor: cores.textoNaNoite,
                  headerTitleStyle: { fontFamily: fontes.titulo, fontSize: 18 },
                  headerBackButtonDisplayMode: 'minimal',
                  contentStyle: { backgroundColor: cores.fundo },
                }}
              >
                <Stack.Screen name="(abas)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="entrar"
                  options={{ headerShown: false, presentation: 'modal' }}
                />
                <Stack.Screen name="cidades" options={{ presentation: 'modal' }} />
                <Stack.Screen name="busca" options={{ headerShown: false }} />
                <Stack.Screen name="lista" options={{ headerShown: false }} />
              </Stack>
              <AvisoDeTermos />
            </ProvedorDeCidade>
          </ProvedorDeSessao>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
