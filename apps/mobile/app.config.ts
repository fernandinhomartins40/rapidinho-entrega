import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { withAndroidManifest } from 'expo/config-plugins';

/**
 * O google-services.json fica fora do repositório, junto das outras contas
 * (~/.rapidinho-contas). No EAS ele chega pela variável de arquivo
 * GOOGLE_SERVICES_JSON.
 */
const ARQUIVO_DO_FIREBASE =
  process.env.GOOGLE_SERVICES_JSON ?? join(homedir(), '.rapidinho-contas', 'google-services.json');

// APK de teste apontado para o computador na rede local fala HTTP; o da loja, nunca.
const API_LOCAL = (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('http://');

// Pedir permissão torna o recurso obrigatório na Play, que esconde o app de
// aparelhos sem ele. Ditado e foto da receita têm alternativa: teclado e galeria.
const RECURSOS_OPCIONAIS = [
  'android.hardware.microphone',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
];

export default ({ config }: ConfigContext): ExpoConfig =>
  withAndroidManifest(
    {
      ...(config as ExpoConfig),
      android: {
        ...config.android,
        googleServicesFile: ARQUIVO_DO_FIREBASE,
      },
      plugins: (config.plugins ?? []).map((plugin) =>
        Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
          ? [plugin[0], { android: { ...plugin[1].android, usesCleartextTraffic: API_LOCAL } }]
          : plugin,
      ),
    },
    (projeto) => {
      projeto.modResults.manifest['uses-feature'] = [
        ...(projeto.modResults.manifest['uses-feature'] ?? []),
        ...RECURSOS_OPCIONAIS.map((nome) => ({
          $: { 'android:name': nome, 'android:required': 'false' as const },
        })),
      ];
      return projeto;
    },
  );
