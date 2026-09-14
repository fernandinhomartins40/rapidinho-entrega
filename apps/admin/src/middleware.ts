import { NextResponse, type NextRequest } from 'next/server';

/**
 * Primeira barreira de autorização do painel.
 *
 * Aqui só olhamos a presença do cookie de sessão: o middleware roda no edge e
 * não tem acesso ao banco. A checagem de papel e de vínculo com a loja é feita
 * no servidor, em `requireStoreAccess`/`requireAdmin`, antes de qualquer
 * query. Esta camada existe para evitar renderizar a página e para levar o
 * usuário à tela de login com o destino guardado.
 */

const PUBLIC_PATHS = ['/entrar', '/cadastro', '/api/auth', '/api/health'];

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const loginUrl = new URL('/entrar', request.url);
    loginUrl.searchParams.set('destino', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
