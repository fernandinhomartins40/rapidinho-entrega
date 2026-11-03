import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * O google-services.json fica fora do repositório, junto das outras contas
 * (~/.rapidinho-contas). No EAS ele chega pela variável de arquivo
 * GOOGLE_SERVICES_JSON.
 */
const ARQUIVO_DO_FIREBASE =
  process.env.GOOGLE_SERVICES_JSON ?? join(homedir(), '.rapidinho-contas', 'google-services.json');

// APK de teste apontado para o computador na rede local fala HTTP; o da loja, nunca.
const API_LOCAL = (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('http://');

export default ({ config }: ConfigContext): ExpoConfig => ({
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
});
