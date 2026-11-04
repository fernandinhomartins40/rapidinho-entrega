import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Altura da barra de abas sem contar os botões do sistema. */
export const ALTURA_DA_BARRA = 72;

/**
 * Espaço no fim da rolagem para o último item não ficar atrás dos botões do
 * Android (voltar, início, recentes), que desenham por cima do app.
 */
export function useFolgaInferior(extra: number) {
  return useSafeAreaInsets().bottom + extra;
}
