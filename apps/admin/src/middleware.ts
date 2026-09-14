import { NextResponse, type NextRequest } from 'next/server';
import { gerarNonce, montarCsp } from '@rapidinho/shared/security';

/**
 * Primeira barreira de autorização do painel, e os cabeçalhos de segurança.
 *
 * Aqui só olhamos a presença do cookie de sessão: o middleware roda no edge e
 * não tem acesso ao banco. A checagem de papel e de vínculo com a loja é feita
 * no servidor, em `requireStoreAccess`/`requireAdmin`, antes de qualquer
 * query. Esta camada existe para evitar renderizar a página e para levar o
 * usuário à tela de login com o destino guardado.
 */

const PUBLIC_PATHS = ['/entrar', '/cadastro', '/api/auth', '/api/health'];

/**
 * Aplica a CSP na resposta e na requisição.
 *
 * Nos dois porque o nonce muda a cada resposta: no cabeçalho de resposta ele
 * vira a política que o navegador cobra, e no da requisição é onde o Next o
 * procura para marcar os próprios scripts.
 */
function comCsp(request: NextRequest, criar: (cabecalhos: Headers) => NextResponse): NextResponse {
  const nonce = gerarNonce();

  const csp = montarCsp(nonce, {
    imagens: process.env.S3_PUBLIC_URL,
    socket: process.env.NEXT_PUBLIC_SOCKET_URL,
    desenvolvimento: process.env.NODE_ENV === 'development',
  });

  const cabecalhos = new Headers(request.headers);
  cabecalhos.set('x-nonce', nonce);
  cabecalhos.set('Content-Security-Policy', csp);

  const resposta = criar(cabecalhos);
  resposta.headers.set('Content-Security-Policy', csp);

  return resposta;
}

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // O redirecionamento não renderiza página nenhuma, então não precisa de
  // nonce — a CSP da tela de login virá na resposta que a entregar.
  if (!PUBLIC_PATHS.some((path) => pathname.startsWith(path)) && !hasSessionCookie(request)) {
    const loginUrl = new URL('/entrar', request.url);
    loginUrl.searchParams.set('destino', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return comCsp(request, (headers) => NextResponse.next({ request: { headers } }));
}

export const config = {
  matcher: [
    /*
     * Tudo, menos arquivos estáticos e imagens — o middleware em asset é
     * custo puro e o painel é usado em conexão ruim.
     *
     * `marca/` precisa estar aqui: sem isso o middleware responde 307 para o
     * logotipo, o otimizador do next/image recebe HTML no lugar da imagem e a
     * página inteira falha ao renderizar ("isn't a valid image ... received
     * null"). O sintoma aparece longe da causa.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|marca/|robots.txt|sw.js).*)',
  ],
};
