'use client';

import { useEffect, useId, useState } from 'react';
import { Download, Menu, X } from 'lucide-react';
import { NAVEGACAO } from './conteudo';
import { LINK_BAIXAR } from './pecas';

/**
 * Barra do topo, sobre o fundo claro do hero.
 *
 * No celular a navegação vira um menu que abre por botão, fecha com Esc e ao
 * escolher um destino — âncoras não trocam de página, então sem isso o menu
 * ficaria aberto cobrindo a seção para onde a pessoa acabou de ir.
 *
 * O logo chega pronto do servidor: assim o módulo da marca não entra no
 * bundle do cliente.
 */
export function Cabecalho({ logo }: { logo: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const idDoMenu = useId();

  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false);
    }

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  return (
    <div className="relative z-20 mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-5 py-5 sm:px-8 lg:py-6">
      <a
        href="#inicio"
        className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
      >
        {logo}
      </a>

      <nav aria-label="Principal" className="hidden lg:block">
        <ul className="flex items-center gap-8">
          {NAVEGACAO.map((item, indice) => (
            <li key={item.href}>
              <a
                href={item.href}
                {...(indice === 0 ? { 'aria-current': 'page' as const } : {})}
                className="relative block py-2 text-sm font-semibold text-[#111214] transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-[#FF6B00] after:opacity-0 after:transition-opacity hover:text-[#CF4600] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] aria-[current=page]:after:opacity-100"
              >
                {item.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-2">
        <a
          href={LINK_BAIXAR}
          download
          className="hidden h-12 items-center gap-2 rounded-xl bg-[#CF4600] px-5 text-sm font-bold text-white shadow-[0_10px_30px_-10px_rgba(255,107,0,0.8)] transition-colors hover:bg-[#B83D00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111214] focus-visible:ring-offset-2 sm:inline-flex"
        >
          <Download className="h-4 w-4" aria-hidden />
          Baixar agora
        </a>

        <button
          type="button"
          onClick={() => setAberto((valor) => !valor)}
          aria-expanded={aberto}
          aria-controls={idDoMenu}
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          className="min-h-touch min-w-touch inline-flex items-center justify-center rounded-xl border border-[#111214]/15 text-[#111214] transition-colors hover:bg-[#111214]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] lg:hidden"
        >
          {aberto ? (
            <X className="h-6 w-6" aria-hidden />
          ) : (
            <Menu className="h-6 w-6" aria-hidden />
          )}
        </button>
      </div>

      <nav
        id={idDoMenu}
        aria-label="Principal"
        hidden={!aberto}
        className="absolute inset-x-5 top-full rounded-2xl border border-[#111214]/10 bg-white p-3 shadow-2xl sm:inset-x-8 lg:hidden"
      >
        <ul>
          {NAVEGACAO.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={() => setAberto(false)}
                className="min-h-touch flex items-center rounded-xl px-4 text-base font-semibold text-[#111214] hover:bg-[#FFF1E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
              >
                {item.rotulo}
              </a>
            </li>
          ))}
          <li className="mt-2 sm:hidden">
            <a
              href={LINK_BAIXAR}
              download
              onClick={() => setAberto(false)}
              className="min-h-touch flex items-center justify-center gap-2 rounded-xl bg-[#CF4600] px-4 text-base font-bold text-white"
            >
              <Download className="h-5 w-5" aria-hidden />
              Baixar agora
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
