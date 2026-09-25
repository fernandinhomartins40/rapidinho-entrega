import { Headphones, MapPin, ShieldCheck, Zap } from 'lucide-react';

const BENEFICIOS = [
  { icone: Zap, titulo: 'Entregas ultrarrápidas', texto: 'Mais agilidade no seu dia a dia.' },
  { icone: MapPin, titulo: 'Acompanhe ao vivo', texto: 'Do pedido até a sua porta.' },
  { icone: ShieldCheck, titulo: 'Mais segurança', texto: 'Seus produtos em boas mãos.' },
  {
    icone: Headphones,
    titulo: 'Suporte sempre com você',
    texto: 'Atendimento rápido e humanizado.',
  },
] as const;

/** Os quatro motivos, logo abaixo do hero. */
export function Beneficios() {
  return (
    <section id="vantagens" aria-label="Vantagens" className="scroll-mt-4 bg-white">
      <ul className="mx-auto grid w-full max-w-[1200px] grid-cols-2 gap-3 px-5 py-8 sm:gap-5 sm:px-8 lg:grid-cols-4 lg:py-10">
        {BENEFICIOS.map((beneficio) => {
          const Icone = beneficio.icone;

          return (
            <li
              key={beneficio.titulo}
              className="flex flex-col items-center rounded-3xl bg-[#F5F7FA] px-3 py-5 text-center shadow-[0_10px_30px_-22px_rgba(16,17,18,0.45)] sm:px-5 sm:py-6"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFCB24] text-[#101112] shadow-[0_10px_20px_-10px_rgba(255,185,0,0.9)] sm:h-16 sm:w-16">
                <Icone className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.4} aria-hidden />
              </span>
              <h3 className="mt-3 text-base font-extrabold leading-tight text-[#101112] sm:text-lg">
                {beneficio.titulo}
              </h3>
              <p className="mt-1.5 max-w-[14rem] text-sm leading-snug text-[#3f4247]">
                {beneficio.texto}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
