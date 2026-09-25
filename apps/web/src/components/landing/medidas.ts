/**
 * Medidas das imagens da landing.
 *
 * ARQUIVO GERADO por `pnpm landing:gerar` — não edite à mão.
 */
export const MEDIDAS_DA_LANDING = {
  'cidade-noturna.webp': { width: 1920, height: 768 },
  'motoboy.webp': { width: 1100, height: 977 },
  'celular.webp': { width: 900, height: 943 },
  'cliente.webp': { width: 640, height: 768 },
  'categorias/restaurantes.webp': { width: 64, height: 57 },
  'categorias/mercado.webp': { width: 63, height: 60 },
  'categorias/farmacia.webp': { width: 61, height: 58 },
  'categorias/bebidas.webp': { width: 34, height: 72 },
  'categorias/pet-shop.webp': { width: 55, height: 53 },
  'categorias/outros.webp': { width: 50, height: 49 },
} as const satisfies Record<string, { width: number; height: number }>;

export type ImagemDaLanding = keyof typeof MEDIDAS_DA_LANDING;
