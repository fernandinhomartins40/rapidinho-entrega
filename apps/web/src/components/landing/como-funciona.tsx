import Image from 'next/image';
import { ChevronRight, MapPin, Package, Search, Smartphone } from 'lucide-react';
import { MEDIDAS_DA_MARCA } from '@rapidinho/shared';
import { Etiqueta } from './pecas';

const PASSOS = [
  { icone: Smartphone, titulo: 'Baixe o app', texto: 'Disponível para Android e iOS.' },
  {
    icone: Search,
    titulo: 'Escolha o que você precisa',
    texto: 'Restaurantes, mercado, farmácia e muito mais.',
  },
  { icone: MapPin, titulo: 'Acompanhe a entrega', texto: 'Em tempo real, no seu mapa.' },
  { icone: Package, titulo: 'Receba onde estiver', texto: 'Com agilidade e segurança.' },
] as const;

export function ComoFunciona() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="titulo-como-funciona"
      className="relative isolate scroll-mt-4 overflow-hidden bg-[#101112] py-14 text-white sm:py-16"
    >
      {/* O "R" da marca como marca-d'água, como na caixa do motoboy. */}
      <Image
        src="/marca/simbolo.webp"
        {...MEDIDAS_DA_MARCA['simbolo.webp']}
        alt=""
        loading="lazy"
        className="pointer-events-none absolute -right-10 -top-6 -z-10 w-72 -rotate-6 opacity-[0.06] grayscale sm:w-96"
      />

      <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        <Etiqueta>Como funciona</Etiqueta>
        <h2 id="titulo-como-funciona" className="fonte-titulo mt-4 text-4xl sm:text-5xl">
          É rápido e <span className="text-[#FFCB24]">fácil!</span>
        </h2>
        <p className="mt-3 text-base text-white/85 sm:text-lg">
          Em poucos passos, seu pedido chega até você.
        </p>

        <ol className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-0">
          {PASSOS.map((passo, indice) => {
            const Icone = passo.icone;

            return (
              <li key={passo.titulo} className="relative flex flex-col items-center text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFCB24] text-[#101112] shadow-[0_0_0_6px_rgba(255,203,36,0.12)] sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Icone className="h-8 w-8" strokeWidth={2.4} aria-hidden />
                </span>
                <h3 className="mt-5 max-w-[12rem] text-base font-extrabold leading-tight sm:text-lg">
                  {indice + 1}. {passo.titulo}
                </h3>
                <p className="mt-2 max-w-[13rem] text-sm leading-snug text-white/75">
                  {passo.texto}
                </p>

                {indice < PASSOS.length - 1 ? (
                  <ChevronRight
                    className="absolute -right-3 top-5 hidden h-7 w-7 text-white/40 lg:block"
                    aria-hidden
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
