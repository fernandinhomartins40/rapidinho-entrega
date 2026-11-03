/**
 * Sabor de pizza que pode ser pedido agora.
 *
 * Dois motivos tiram um sabor do ar: `isAvailable = false` (a loja removeu do
 * cardápio) e `pausedUntil` no futuro (acabou hoje e volta sozinho). Cardápio,
 * "Tô com fome", vitrine, carrinho e validação do item usam este filtro, para
 * um sabor pausado não aparecer numa tela e ser aceito em outra.
 *
 * Usa `OR` na raiz: quem combinar com outro `OR` precisa envolver em `AND`.
 */
export function saborDisponivelAgora(agora: Date = new Date()) {
  return {
    isAvailable: true,
    OR: [{ pausedUntil: null }, { pausedUntil: { lte: agora } }],
  };
}

export function saborForaDoAr(sabor: { isAvailable: boolean; pausedUntil: Date | null }) {
  return !sabor.isAvailable || (sabor.pausedUntil != null && sabor.pausedUntil > new Date());
}
