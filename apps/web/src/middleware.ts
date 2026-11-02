import { NextResponse, type NextRequest } from 'next/server';
import { gerarNonce, montarCsp } from '@rapidinho/shared/security';

/**
 * Cabeçalhos de segurança por requisição.
 *
 * O app do cliente não tem rota protegida no middleware — quem precisa de
 * sessão checa no servidor, antes da query. O que exige middleware aqui é o
 * nonce da CSP: ele muda a cada resposta, então não pode sair de `next.config`,
 * que é estático.
 *
 * O nonce vai também nos cabeçalhos da requisição porque é assim que o Next o
 * encontra e o aplica aos próprios scripts; sem isso a página carregaria com a
 * política bloqueando o código do framework.
 */
const COOKIES_DE_SESSAO = ['__Secure-authjs.session-token', 'authjs.session-token'];
const SESSAO_SEGUNDOS = 60 * 60 * 24 * Number(process.env.RAPIDINHO_SESSAO_DIAS ?? 30);

/**
 * Empurra o vencimento do cookie de sessão a cada página aberta. O Auth.js
 * renova o prazo no banco, mas não consegue regravar o cookie durante a
 * renderização; sem isto o cookie venceria contado do login, mesmo com uso
 * diário. Só em GET: logout é Server Action (POST) e apaga o cookie na mesma
 * resposta — regravar ali brigaria com a exclusão.
 */
function renovarCookieDeSessao(request: NextRequest, resposta: NextResponse): void {
  if (request.method !== 'GET') return;

  for (const nome of COOKIES_DE_SESSAO) {
    const valor = request.cookies.get(nome)?.value;
    if (!valor) continue;
    resposta.cookies.set(nome, valor, {
      httpOnly: true,
      sameSite: 'lax',
      secure: nome.startsWith('__Secure-'),
      path: '/',
      maxAge: SESSAO_SEGUNDOS,
    });
  }
}

export function middleware(request: NextRequest) {
  const nonce = gerarNonce();

  const csp = montarCsp(nonce, {
    imagens: process.env.S3_PUBLIC_URL,
    socket: process.env.NEXT_PUBLIC_SOCKET_URL,
    desenvolvimento: process.env.NODE_ENV === 'development',
  });

  const cabecalhos = new Headers(request.headers);
  cabecalhos.set('x-nonce', nonce);
  cabecalhos.set('Content-Security-Policy', csp);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set('Content-Security-Policy', csp);
  renovarCookieDeSessao(request, resposta);

  return resposta;
}

export const config = {
  matcher: [
    /*
     * Fora os estáticos: CSP em arquivo já entregue é custo de CPU sem ganho,
     * e o app do cliente roda em conexão de interior.
     *
     * `marca/` precisa estar na lista: o middleware respondendo por um asset
     * faz o otimizador do next/image receber outra coisa no lugar da imagem, e
     * a página inteira falha a renderizar — sintoma longe da causa.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|marca/|robots.txt|sw.js).*)',
  ],
};
