import Link from 'next/link';
import { Facebook, Instagram, Youtube } from 'lucide-react';
import { APP_NAME, getPublicEnv } from '@rapidinho/shared';
import { Logotipo } from '@/components/marca/logo';
import { NAVEGACAO, REDES_SOCIAIS } from './conteudo';

function IconeTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

const REDES = [
  { chave: 'instagram', nome: 'Instagram', Icone: Instagram },
  { chave: 'facebook', nome: 'Facebook', Icone: Facebook },
  { chave: 'youtube', nome: 'YouTube', Icone: Youtube },
  { chave: 'tiktok', nome: 'TikTok', Icone: IconeTikTok },
] as const;

/**
 * Links que a arte não mostra, mas que precisam estar na página: termos e
 * privacidade (LGPD e CDC) e as portas de entrada de lojista e entregador.
 */
const LINKS_INSTITUCIONAIS = [
  { rotulo: 'Cadastrar minha loja', href: '/cadastro-loja' },
  { rotulo: 'Seja entregador', href: '/entregador' },
  { rotulo: 'Termos de uso', href: '/termos' },
  { rotulo: 'Privacidade', href: '/privacidade' },
] as const;

const estiloLink =
  'rounded text-sm text-white/80 transition-colors hover:text-[#FFCB24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB24]';

export function Rodape() {
  const redes = REDES.flatMap((rede) => {
    const url = REDES_SOCIAIS[rede.chave];
    return url ? [{ ...rede, url }] : [];
  });

  return (
    <footer id="contato" className="scroll-mt-4 bg-[#101112] text-white">
      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <div className="flex flex-col gap-6 border-t border-white/10 py-8 md:flex-row md:items-center md:justify-between">
          <Logotipo className="h-14 w-auto self-start md:self-auto" />

          <nav aria-label="Rodapé">
            <ul className="flex flex-wrap gap-x-7 gap-y-3">
              {NAVEGACAO.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className={estiloLink}>
                    {item.rotulo}
                  </a>
                </li>
              ))}
              <li>
                {/* O painel é outro app, em subdomínio próprio. */}
                <a href={getPublicEnv().NEXT_PUBLIC_ADMIN_URL} className={estiloLink}>
                  Sou lojista
                </a>
              </li>
            </ul>
          </nav>

          {redes.length > 0 ? (
            <ul className="flex items-center gap-4" aria-label="Redes sociais">
              {redes.map(({ chave, nome, url, Icone }) => (
                <li key={chave}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${APP_NAME} no ${nome}`}
                    className="min-h-touch min-w-touch flex items-center justify-center rounded-full text-white transition-colors hover:text-[#FFCB24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB24]"
                  >
                    <Icone className="h-6 w-6" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. Todos os direitos reservados.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS_INSTITUCIONAIS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={estiloLink.replace('text-sm', 'text-xs')}>
                  {link.rotulo}
                </Link>
              </li>
            ))}
          </ul>
          <p>Entrega de confiança, sempre com você.</p>
        </div>
      </div>
    </footer>
  );
}
