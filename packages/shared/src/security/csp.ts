/**
 * Content-Security-Policy da plataforma.
 *
 * Por nonce, e não por lista de domínios: a lista permite qualquer script
 * hospedado num domínio confiável, e um CDN confiável costuma hospedar
 * bibliotecas que fazem exatamente o que o atacante precisa. Com nonce, só
 * executa o que o servidor marcou naquela resposta.
 *
 * `strict-dynamic` existe porque o Next carrega os próprios chunks via script
 * criado por script: sem ele o nonce protegeria só o primeiro arquivo e o app
 * não passaria da primeira tela.
 *
 * Roda no middleware (runtime edge), então nada aqui pode depender do Node.
 */

export interface OrigensDaPolitica {
  /** Onde as imagens de produto e de loja são servidas. */
  imagens?: string | undefined;
  /** Servidor de tempo real; o socket abre conexão para ele. */
  socket?: string | undefined;
  /** Em desenvolvimento o Next usa eval para recarregar a página. */
  desenvolvimento?: boolean | undefined;
}

/** Nonce por resposta. O `crypto` global existe no edge e no Node moderno. */
export function gerarNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** Reduz uma URL à origem; entrada inválida vira vazio em vez de derrubar. */
function origem(url: string | undefined): string {
  if (!url) return '';

  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function montarCsp(nonce: string, origens: OrigensDaPolitica = {}): string {
  const imagens = origem(origens.imagens);
  const socket = origem(origens.socket);

  // O socket fala WebSocket: o esquema muda de http para ws e o `connect-src`
  // trata os dois como origens diferentes.
  const socketWs = socket.replace(/^http/, 'ws');

  const scripts = [
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Navegador sem suporte a strict-dynamic ignora o nonce e cairia aqui;
    // quem suporta ignora estes dois. É a escada de compatibilidade da
    // própria especificação, não um afrouxamento.
    "'unsafe-inline'",
    'https:',
    // Recarregamento a quente usa eval. Nunca em produção.
    ...(origens.desenvolvimento ? ["'unsafe-eval'"] : []),
  ];

  const diretivas: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': scripts,
    // O Tailwind compila para arquivo, mas React escreve `style=` em elemento
    // e o Next injeta CSS crítico inline. Estilo não executa código.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', imagens].filter(Boolean),
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", socket, socketWs, ...(origens.desenvolvimento ? ['ws:'] : [])].filter(
      Boolean,
    ),
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'"],
    // Sem plugin e sem iframe: nada no app usa, e liberar por hábito é o que
    // transforma um XSS em sequestro de sessão.
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    // Formulário só posta para nós — impede que um campo injetado mande os
    // dados do checkout para outro servidor.
    'form-action': ["'self'"],
  };

  const politica = Object.entries(diretivas)
    .map(([diretiva, valores]) => `${diretiva} ${valores.join(' ')}`)
    .join('; ');

  // Em desenvolvimento o certificado local não existe e forçar https quebraria
  // tudo.
  return origens.desenvolvimento ? politica : `${politica}; upgrade-insecure-requests`;
}
