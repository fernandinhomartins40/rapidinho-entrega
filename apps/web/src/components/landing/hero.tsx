import Image from 'next/image';
import { MapPin, ShieldCheck, Star, Zap } from 'lucide-react';
import { getPublicEnv } from '@rapidinho/shared';
import { Logotipo } from '@/components/marca/logo';
import { SeletorDeCidade, type CidadeDisponivel } from './seletor-de-cidade';

/**
 * Topo da página.
 *
 * Fundo navy da identidade visual, com o mascote à direita no desktop. O
 * seletor de cidade fica logo abaixo, avançando sobre o fundo: quem chega já
 * sabendo o que quer não deve precisar rolar para começar.
 */
export function Hero({ cidades }: { cidades: CidadeDisponivel[] }) {
  const totalLojas = cidades.reduce((soma, cidade) => soma + cidade.lojas, 0);
  const temOperacao = cidades.length > 0;

  return (
    <header className="relative">
      {/*
        O fundo mora num wrapper próprio, e não no <header>: o cartão abaixo
        avança para cima com margem negativa, e um `overflow-hidden` no header
        (necessário para conter o brilho e o mascote) o cortaria pela metade.
      */}
      <div className="bg-brand-deep relative overflow-hidden">
        <div className="from-brand-deep via-brand-deep to-brand-deeper absolute inset-0 bg-gradient-to-b" />
        <div className="bg-radial-glow absolute inset-0" aria-hidden />
        <div className="bg-dot-grid absolute inset-0 opacity-[0.07]" aria-hidden />

        {/* Mascote da marca. Decorativo: some no celular, onde o espaço é do
            texto e da ação. */}
        <div
          className="pointer-events-none absolute -right-8 top-28 hidden w-[25rem] lg:block xl:-right-4 xl:top-24 xl:w-[30rem]"
          aria-hidden
        >
          <Image
            src="/marca/mascote.webp"
            width={480}
            height={420}
            alt=""
            priority
            className="h-auto w-full drop-shadow-[0_25px_50px_rgba(0,0,0,0.45)]"
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-32 pt-7 sm:pb-36 sm:pt-10">
          <div className="flex items-center justify-between gap-4">
            <Logotipo className="h-9 w-auto sm:h-11" priority />

            {/* O painel é outro app, em subdomínio próprio: um caminho
                relativo levaria a uma rota que não existe aqui. */}
            <a
              href={getPublicEnv().NEXT_PUBLIC_ADMIN_URL}
              className="focus-visible:ring-brand-tint min-h-touch hidden items-center rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 sm:inline-flex"
            >
              Sou lojista
            </a>
          </div>

          <div className="mt-12 max-w-2xl sm:mt-16">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
              {temOperacao ? (
                <>
                  <MapPin className="text-brand-tint h-4 w-4" aria-hidden />
                  {cidades.length === 1
                    ? `Entregando em ${cidades[0]?.nome}`
                    : `Entregando em ${cidades.length} cidades`}
                  {totalLojas > 0 ? (
                    <span className="text-white/60">
                      · {totalLojas} {totalLojas === 1 ? 'loja' : 'lojas'}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <Star className="text-brand-tint h-4 w-4" aria-hidden />
                  Estamos chegando na sua cidade
                </>
              )}
            </p>

            <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.03] tracking-tight text-white sm:text-6xl">
              O mercado, a farmácia
              <br />
              <span className="from-brand-tint via-brand-amber to-brand-flame bg-gradient-to-r bg-clip-text text-transparent">
                e o melhor da cidade
              </span>
              <br />
              na sua porta.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/75">
              Peça do comércio que você já conhece. Pague no Pix, no cartão ou na entrega — e
              acompanhe tudo em tempo real, do preparo até a sua porta.
            </p>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-white/70">
              <li className="flex items-center gap-2">
                <Zap className="text-brand-amber h-4 w-4" aria-hidden />
                Entrega em minutos
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="text-brand-amber h-4 w-4" aria-hidden />
                Pagamento seguro
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="text-brand-amber h-4 w-4" aria-hidden />
                Comércio da sua cidade
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* O cartão sobe sobre o fundo: dá profundidade e puxa o olho para a
          ação principal. */}
      <div className="relative z-10 mx-auto -mt-24 w-full max-w-3xl px-5 sm:-mt-28">
        <SeletorDeCidade cidades={cidades} />
      </div>
    </header>
  );
}
