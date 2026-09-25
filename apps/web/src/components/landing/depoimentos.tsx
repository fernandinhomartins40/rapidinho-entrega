'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@rapidinho/ui/lib/utils';
import { DEPOIMENTOS } from './conteudo';
import { Pincelada } from './pecas';

/**
 * Faixa amarela do depoimento.
 *
 * A foto chega do servidor pronta (`foto`), para o next/image não precisar de
 * nada do cliente. Setas e indicadores só existem com mais de um depoimento —
 * controle que não controla nada é ruído, e engana leitor de tela.
 */
export function Depoimentos({ foto }: { foto: React.ReactNode }) {
  const [atual, setAtual] = useState(0);
  const total = DEPOIMENTOS.length;
  const varios = total > 1;
  const depoimento = DEPOIMENTOS[atual];

  if (!depoimento) return null;

  const ir = (passo: number) => setAtual((indice) => (indice + passo + total) % total);

  const seta =
    'hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#101112] text-[#101112] transition-colors hover:bg-[#101112] hover:text-[#FFCB24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101112] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFCB24] sm:flex';

  return (
    <section
      id="depoimentos"
      aria-labelledby="titulo-depoimentos"
      aria-roledescription={varios ? 'carrossel' : undefined}
      className="relative z-10 scroll-mt-4 bg-[#101112]"
    >
      <h2 id="titulo-depoimentos" className="sr-only">
        Depoimentos
      </h2>

      <div className="rounded-b-[3rem] bg-gradient-to-b from-[#FFCB24] to-[#FFB900] sm:rounded-b-[5rem]">
        <div className="mx-auto grid w-full max-w-[1200px] items-end gap-4 px-5 pt-10 sm:px-8 md:grid-cols-[15rem_minmax(0,1fr)] md:pt-12 lg:grid-cols-[17rem_minmax(0,1fr)_17rem] lg:gap-8">
          <div className="order-2 mx-auto w-56 md:order-1 md:w-full">{foto}</div>

          <div className="order-1 flex items-center gap-4 self-center md:order-2 md:pb-8">
            {varios ? (
              <button
                type="button"
                onClick={() => ir(-1)}
                aria-label="Depoimento anterior"
                className={seta}
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2.6} aria-hidden />
              </button>
            ) : null}

            <div className="flex-1">
              <figure
                aria-live={varios ? 'polite' : undefined}
                className="relative rounded-3xl bg-white px-6 py-6 shadow-[0_24px_40px_-24px_rgba(16,17,18,0.55)] sm:px-8"
              >
                <span
                  className="fonte-titulo absolute left-5 top-2 text-5xl leading-none text-[#FFB900]"
                  aria-hidden
                >
                  &ldquo;
                </span>
                <blockquote className="pl-6 text-base font-medium leading-relaxed text-[#101112] sm:text-lg">
                  {depoimento.texto}
                </blockquote>
                <div
                  className="mt-3 flex gap-1 pl-6"
                  role="img"
                  aria-label={`Nota ${depoimento.nota} de 5`}
                >
                  {Array.from({ length: 5 }, (_, indice) => (
                    <Star
                      key={indice}
                      className={cn(
                        'h-5 w-5',
                        indice < depoimento.nota
                          ? 'fill-[#FFB900] text-[#FFB900]'
                          : 'fill-transparent text-[#d1d5db]',
                      )}
                      aria-hidden
                    />
                  ))}
                </div>
                <figcaption className="mt-3 pl-6">
                  <span className="block font-bold text-[#101112]">{depoimento.nome}</span>
                  <span className="block text-sm text-[#3f4247]">{depoimento.papel}</span>
                </figcaption>
              </figure>

              {varios ? (
                <div className="mt-4 flex justify-center gap-2">
                  {DEPOIMENTOS.map((item, indice) => (
                    <button
                      key={item.nome}
                      type="button"
                      onClick={() => setAtual(indice)}
                      aria-label={`Ver depoimento ${indice + 1} de ${total}`}
                      aria-current={indice === atual}
                      className={cn(
                        'h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#101112]',
                        indice === atual ? 'w-7 bg-[#101112]' : 'w-2.5 bg-[#101112]/30',
                      )}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {varios ? (
              <button
                type="button"
                onClick={() => ir(1)}
                aria-label="Próximo depoimento"
                className={seta}
              >
                <ChevronRight className="h-6 w-6" strokeWidth={2.6} aria-hidden />
              </button>
            ) : null}
          </div>

          <p
            className="fonte-manuscrita order-3 hidden -rotate-[10deg] self-center whitespace-nowrap pb-8 text-[2rem] leading-[1.15] text-[#101112] lg:block"
            aria-hidden
          >
            Rapidinho
            <br />
            <span className="pl-3">sempre com você!</span>
            <Pincelada className="ml-auto mt-1 w-40" />
          </p>
        </div>
      </div>
    </section>
  );
}
