/**
 * Destino de redirecionamento depois do login: só caminho interno.
 *
 * `startsWith('/') && !startsWith('//')` não basta: o navegador trata `\`
 * como `/`, e `/\exemplo.com` vira `//exemplo.com`, um site externo com o
 * domínio legítimo no link do golpe. Qualquer barra invertida, caractere de
 * controle ou destino que resolva para outra origem cai na raiz.
 */
export function destinoInterno(destino: string | null | undefined, padrao = '/'): string {
  if (!destino || !destino.startsWith('/') || destino.startsWith('//')) return padrao;
  const temCaractereProibido = [...destino].some((letra) => {
    const codigo = letra.charCodeAt(0);
    return codigo === 0x5c || codigo < 0x20 || codigo === 0x7f; // 0x5c = barra invertida
  });
  if (temCaractereProibido) return padrao;
  try {
    const base = 'http://interno.invalid';
    const url = new URL(destino, base);
    if (url.origin !== base) return padrao;
    return url.pathname + url.search + url.hash;
  } catch {
    return padrao;
  }
}
