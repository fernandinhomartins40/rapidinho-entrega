import Link from 'next/link';
import { APP_NAME, getPublicEnv } from '@rapidinho/shared';

/** O painel é outro app, em subdomínio próprio. */
const LINK_DO_PAINEL = getPublicEnv().NEXT_PUBLIC_ADMIN_URL;
import { Logotipo } from '@/components/marca/logo';

const LINKS = [
  {
    titulo: 'Plataforma',
    itens: [
      { rotulo: 'Cadastrar minha loja', href: '/cadastro-loja' },
      { rotulo: 'Ser entregador', href: '/entregador' },
      { rotulo: 'Entrar no painel', href: LINK_DO_PAINEL, externo: true },
    ],
  },
  {
    titulo: 'Ajuda',
    itens: [
      { rotulo: 'Central de ajuda', href: '/ajuda' },
      { rotulo: 'Falar com o suporte', href: '/ajuda/contato' },
    ],
  },
  {
    // Exigidos pela LGPD e pelo Código de Defesa do Consumidor.
    titulo: 'Legal',
    itens: [
      { rotulo: 'Termos de uso', href: '/termos' },
      { rotulo: 'Política de privacidade', href: '/privacidade' },
      { rotulo: 'Meus dados', href: '/privacidade/meus-dados' },
    ],
  },
] as const;

export function Rodape() {
  return (
    <footer className="bg-secondary/50 mt-20 border-t sm:mt-24">
      <div className="mx-auto w-full max-w-5xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logotipo className="h-9 w-auto" />
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Delivery do comércio local, feito para cidades do interior.
            </p>
          </div>

          {LINKS.map((grupo) => (
            <nav key={grupo.titulo} aria-label={grupo.titulo}>
              <h2 className="text-sm font-bold">{grupo.titulo}</h2>
              <ul className="mt-3 space-y-2">
                {grupo.itens.map((item) => (
                  <li key={item.href}>
                    {'externo' in item && item.externo ? (
                      <a
                        href={item.href}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {item.rotulo}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {item.rotulo}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="text-muted-foreground mt-10 border-t pt-6 text-sm">
          © {new Date().getFullYear()} {APP_NAME}. Feito no interior do Paraná.
        </p>
      </div>
    </footer>
  );
}
