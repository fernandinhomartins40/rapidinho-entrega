/**
 * O que a tela do produto pode oferecer agora.
 *
 * Mesma leitura no site e no app: produto pausado, controlado (Portaria 344/98)
 * ou com estoque zerado não se compra. Produto por peso não conta unidade, o
 * estoque dele é o da balança.
 */
export function situacaoDoProduto(
  produto: {
    isAvailable: boolean;
    pausedUntil: Date | null;
    prescription: string;
    sellingUnit: string;
    stockQuantity: number | null;
  },
  agora: Date = new Date(),
): { disponivel: boolean; esgotado: boolean; estoque: number | null } {
  const porPeso = produto.sellingUnit === 'WEIGHT_KG';
  const pausado = produto.pausedUntil != null && produto.pausedUntil > agora;

  return {
    disponivel:
      produto.isAvailable &&
      !pausado &&
      produto.prescription !== 'CONTROLLED' &&
      (porPeso || produto.stockQuantity !== 0),
    esgotado: !porPeso && produto.stockQuantity === 0,
    estoque: porPeso ? null : produto.stockQuantity,
  };
}
