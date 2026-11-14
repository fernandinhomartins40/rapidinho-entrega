/**
 * Medidas das imagens da landing.
 *
 * ARQUIVO GERADO por `pnpm landing:gerar` — não edite à mão.
 */
export const MEDIDAS_DA_LANDING = {
  'motoboy.webp': { width: 2000, height: 1500 },
  'celular.webp': { width: 846, height: 1300 },
  'cliente.webp': { width: 640, height: 768 },
  'categorias/restaurantes.webp': { width: 64, height: 57 },
  'categorias/mercado.webp': { width: 63, height: 60 },
  'categorias/farmacia.webp': { width: 61, height: 58 },
  'categorias/bebidas.webp': { width: 34, height: 72 },
  'categorias/pet-shop.webp': { width: 55, height: 53 },
  'categorias/outros.webp': { width: 50, height: 49 },
} as const satisfies Record<string, { width: number; height: number }>;

export type ImagemDaLanding = keyof typeof MEDIDAS_DA_LANDING;
