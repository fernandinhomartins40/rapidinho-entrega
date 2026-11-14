/**
 * Medidas das imagens da landing.
 *
 * ARQUIVO GERADO por `pnpm landing:gerar` — não edite à mão.
 */
export const MEDIDAS_DA_LANDING = {
  'motoboy.webp': { width: 2000, height: 1500 },
  'celular.webp': { width: 846, height: 1300 },
  'cliente.webp': { width: 640, height: 768 },
} as const satisfies Record<string, { width: number; height: number }>;

export type ImagemDaLanding = keyof typeof MEDIDAS_DA_LANDING;
