import Link from 'next/link';
import { ArrowRight, MapPin } from 'lucide-react';
import { SelosDasLojas } from './pecas';

export interface CidadeDisponivel {
  id: string;
  nome: string;
  uf: string;
  slug: string;
  lojas: number;
}

/**
 * "Baixe agora e sinta a diferença!".
 *
 * Logo abaixo dos selos fica a entrada que funciona hoje — o pedido pelo site,
 * escolhendo a cidade. É para cá que apontam os "Baixar agora" enquanto o app
 * não estiver publicado nas lojas.
 */
export function ChamadaFinal({ cidades }: { cidades: CidadeDisponivel[] }) {
  return (
    <section id="baixar" aria-labelledby="titulo-baixar" className="scroll-mt-4 bg-[#101112] text-white">
      <div className="mx-auto w-full max-w-[1200px] px-5 pb-10 pt-12 sm:px-8 sm:pt-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="titulo-baixar" className="fonte-titulo text-3xl sm:text-[2.4rem]">
              Baixe agora e <span className="text-[#FFCB24]">sinta a diferença!</span>
            </h2>
            <p className="mt-2 text-base text-white/85">
              Mais praticidade, mais tempo para o que realmente importa.
            </p>
          </div>
          <SelosDasLojas />
        </div>

        <div
          id="pedir"
          className="mt-8 scroll-mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6"
        >
          {cidades.length > 0 ? (
            <>
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#FFCB24]">
                <MapPin className="h-4 w-4" aria-hidden />
                Peça agora pelo site
              </p>
              <ul className="mt-4 flex flex-wrap gap-3">
                {cidades.map((cidade) => (
                  <li key={cidade.id}>
                    <Link
                      href={`/${cidade.slug}`}
                      className="min-h-touch group inline-flex items-center gap-3 rounded-xl border border-white/20 px-4 py-2 font-semibold transition-colors hover:border-[#FFCB24] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB24]"
                    >
                      <span>
                        {cidade.nome}
                        <span className="font-normal text-white/60"> — {cidade.uf}</span>
                        <span className="block text-xs font-normal text-white/60">
                          {cidade.lojas === 0
                            ? 'Em breve'
                            : `${cidade.lojas} ${cidade.lojas === 1 ? 'loja' : 'lojas'}`}
                        </span>
                      </span>
                      <ArrowRight
                        className="h-5 w-5 text-[#FFCB24] transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            // Antes do lançamento, o primeiro público é o lojista: sem loja
            // não há delivery.
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-white/85">
                Estamos chegando na sua cidade. Tem um comércio? Seja um dos primeiros parceiros.
              </p>
              <Link
                href="/cadastro-loja"
                className="min-h-touch inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#FFCB24] px-5 font-bold text-[#101112] transition-colors hover:bg-[#FFB900] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Cadastrar minha loja
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
