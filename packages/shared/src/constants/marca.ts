/**
 * Medidas das artes da marca.
 *
 * ARQUIVO GERADO por `pnpm marca:gerar` — não edite à mão.
 *
 * O gerador recorta o transparente em volta de cada arte, então a altura final
 * só se conhece depois de processar. Digitar essas medidas nos componentes é o
 * que fazia o Next reservar um espaço que não correspondia à imagem.
 */
export const MEDIDAS_DA_MARCA = {
  'logo-completa.webp': { width: 640, height: 431 },
  'lettering.webp': { width: 560, height: 115 },
  'lettering-negativo.webp': { width: 560, height: 115 },
  'mascote.webp': { width: 480, height: 333 },
  'simbolo.webp': { width: 256, height: 176 },
} as const satisfies Record<string, { width: number; height: number }>;

export type ArteDaMarca = keyof typeof MEDIDAS_DA_MARCA;
