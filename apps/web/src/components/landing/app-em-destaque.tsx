import Image from 'next/image';
import { Check, ChevronRight, Download } from 'lucide-react';
import { MEDIDAS_DA_LANDING } from './medidas';
import { LINK_BAIXAR, Etiqueta } from './pecas';

const DESTAQUES = [
  'Variedade de lojas parceiras',
  'Cupons e promoções exclusivas',
  'Pagamento seguro e prático',
  'Avalie e ajude a melhorar',
] as const;

/** O que cabe no app, com o celular mostrando a tela inicial. */
export function AppEmDestaque() {
  return (
    <section aria-labelledby="tudo-em-um-app" className="overflow-hidden bg-white">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-5 pb-6 pt-8 sm:px-8 lg:grid-cols-2 lg:gap-6 lg:pb-0 lg:pt-4">
        <div>
          <Etiqueta tom="claro">Tudo em um só app</Etiqueta>

          <h2
            id="tudo-em-um-app"
            className="fonte-titulo mt-4 text-[2.4rem] leading-[1.05] text-[#111214] sm:text-5xl lg:text-[3.4rem]"
          >
            Muito mais
            <br />
            <span className="pr-2 text-[#EE5500]">do que entregas.</span>
          </h2>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-[#4B4F56] sm:text-lg">
            Com o Rapidinho Entrega, você pede comida, mercado, farmácia, bebidas, pet shop e muito
            mais, de forma rápida, segura e prática.
          </p>

          <ul className="mt-6 space-y-4">
            {DESTAQUES.map((destaque) => (
              <li key={destaque} className="flex items-center gap-4 font-semibold text-[#111214]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF6B00] text-white">
                  <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
                </span>
                {destaque}
              </li>
            ))}
          </ul>

          <a
            href={LINK_BAIXAR}
            download
            className="group mt-9 inline-flex h-16 w-full max-w-[20rem] items-center justify-between gap-4 rounded-2xl bg-[#CF4600] px-7 text-lg font-extrabold text-white shadow-[0_18px_36px_-16px_rgba(242,92,0,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-[#B83D00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111214] focus-visible:ring-offset-2 active:translate-y-0"
          >
            <span className="flex items-center gap-3">
              <Download className="h-6 w-6" strokeWidth={2.6} aria-hidden />
              Baixar agora
            </span>
            <ChevronRight
              className="h-6 w-6 transition-transform group-hover:translate-x-1"
              strokeWidth={2.6}
              aria-hidden
            />
          </a>
          <p className="mt-3 text-sm text-[#4B4F56]">Disponível para Android e iOS.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[20rem] sm:max-w-[24rem] lg:max-w-[27rem]">
          <Image
            src="/landing/celular.webp"
            {...MEDIDAS_DA_LANDING['celular.webp']}
            alt="Tela inicial do app Rapidinho Entrega com a busca e as categorias Restaurantes, Mercado, Farmácia, Bebidas e Pet Shop"
            loading="lazy"
            sizes="(min-width: 1024px) 27rem, (min-width: 640px) 24rem, 20rem"
            className="h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
}
