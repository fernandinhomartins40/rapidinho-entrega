/** "SEM feijão", "POUCO arroz", "MAIS salada": ajuste do prato da marmita. */
export const ehAjusteDoPrato = (nome: string) => /^(SEM|POUCO|MAIS) /.test(nome);

/**
 * Complemento numa linha: o ajuste vai sem "+"; os demais levam "+" e a
 * quantidade só quando passa de um. Igual à comanda da loja.
 */
export function linhaDoComplemento(nome: string, quantidade: number): string {
  if (ehAjusteDoPrato(nome)) return nome;
  return quantidade > 1 ? `+ ${quantidade}× ${nome}` : `+ ${nome}`;
}
