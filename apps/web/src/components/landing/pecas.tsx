import { cn } from '@rapidinho/ui/lib/utils';
import { LOJAS_DE_APPS } from './conteudo';

/** Destino dos selos e do "Baixar agora" enquanto não houver app nas lojas. */
export const ANCORA_PEDIR = '#pedir';

/** Etiqueta em pílula que abre cada seção ("ENTREGAS MAIS RÁPIDAS"). */
export function Etiqueta({
  children,
  tom = 'escuro',
  className,
}: {
  children: React.ReactNode;
  tom?: 'escuro' | 'claro';
  className?: string;
}) {
  return (
    <p
      className={cn(
        'inline-flex items-center rounded-full border-2 border-[#FFCB24] px-3.5 py-1 text-xs font-extrabold uppercase tracking-wide sm:text-sm',
        tom === 'escuro' ? 'bg-[#FFCB24]/10 text-[#FFCB24]' : 'bg-[#FFCB24]/10 text-[#B45309]',
        className,
      )}
    >
      {children}
    </p>
  );
}

/* Marcas das lojas de aplicativo (Simple Icons, CC0). */
function IconeGooglePlay({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#FBBC04"
        d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z"
      />
      <path
        fill="#4285F4"
        d="M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z"
      />
      <path
        fill="#34A853"
        d="M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z"
      />
      <path
        fill="#EA4335"
        d="M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z"
      />
    </svg>
  );
}

function IconeApple({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

const SELOS = [
  { chave: 'googlePlay', topo: 'Disponível no', nome: 'Google Play', Icone: IconeGooglePlay },
  { chave: 'appStore', topo: 'Disponível na', nome: 'App Store', Icone: IconeApple },
] as const;

/**
 * Selos "Google Play" e "App Store" desenhados em HTML — texto de verdade,
 * nítido em qualquer tela, sem recorte rasterizado.
 */
export function SelosDasLojas({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-3', className)}>
      {SELOS.map(({ chave, topo, nome, Icone }) => {
        const url = LOJAS_DE_APPS[chave];

        return (
          <li key={chave}>
            <a
              href={url ?? ANCORA_PEDIR}
              {...(url ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              aria-label={url ? `${topo} ${nome}` : `${nome}: em breve. Peça agora pelo site`}
              className="flex h-[3.25rem] items-center gap-2.5 rounded-xl border border-white/70 bg-black px-4 text-white transition-colors hover:border-[#FFCB24] hover:bg-[#1b1c1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB24] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <Icone className="h-6 w-6 shrink-0" />
              <span className="leading-none">
                <span className="block text-[0.625rem] font-medium">{topo}</span>
                <span className="mt-0.5 block text-lg font-semibold tracking-tight">{nome}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Sublinhado em pincelada, embaixo das frases manuscritas. */
export function Pincelada({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 24" fill="none" className={className} aria-hidden>
      <path d="M4 18C52 9 118 5 196 6" stroke="#F04B28" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
