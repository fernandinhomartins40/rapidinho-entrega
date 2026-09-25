'use client';

import { useEffect, useId, useState } from 'react';
import { Download, Menu, X } from 'lucide-react';
import { NAVEGACAO } from './conteudo';
import { ANCORA_PEDIR } from './pecas';

/**
 * Barra do topo, sobre o fundo escuro do hero.
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
        className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB24]"
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
                className="relative block py-2 text-sm font-semibold text-white transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-[#FFCB24] after:opacity-0 after:transition-opacity hover:text-[#FFCB24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB24] aria-[current=page]:after:opacity-100"
              >
                {item.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-2">
        <a
          href={ANCORA_PEDIR}
          className="hidden h-12 items-center gap-2 rounded-xl bg-[#FFCB24] px-5 text-sm font-bold text-[#101112] shadow-[0_10px_30px_-10px_rgba(255,203,36,0.7)] transition-colors hover:bg-[#FFB900] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#101112] sm:inline-flex"
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
          className="min-h-touch min-w-touch inline-flex items-center justify-center rounded-xl border border-white/25 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB24] lg:hidden"
        >
          {aberto ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
        </button>
      </div>

      <nav
        id={idDoMenu}
        aria-label="Principal"
        hidden={!aberto}
        className="absolute inset-x-5 top-full rounded-2xl border border-white/10 bg-[#101112]/95 p-3 shadow-2xl backdrop-blur-md sm:inset-x-8 lg:hidden"
      >
        <ul>
          {NAVEGACAO.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={() => setAberto(false)}
                className="min-h-touch flex items-center rounded-xl px-4 text-base font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB24]"
              >
                {item.rotulo}
              </a>
            </li>
          ))}
          <li className="mt-2 sm:hidden">
            <a
              href={ANCORA_PEDIR}
              onClick={() => setAberto(false)}
              className="min-h-touch flex items-center justify-center gap-2 rounded-xl bg-[#FFCB24] px-4 text-base font-bold text-[#101112]"
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
