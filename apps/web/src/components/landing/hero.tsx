import Image from 'next/image';
import { Logotipo } from '@/components/marca/logo';
import { Cabecalho } from './cabecalho';
import { NUMEROS } from './conteudo';
import { MEDIDAS_DA_LANDING } from './medidas';
import { Etiqueta, Pincelada, SelosDasLojas } from './pecas';

/**
 * Topo da página: rua à noite ao fundo, o mascote acelerando à direita.
 *
 * O fundo é escurecido da esquerda para a direita — o texto fica sobre a parte
 * mais escura e o brilho dos postes sobra para o lado do motoboy. As imagens
 * são as únicas da página com prioridade de carga: são o que se vê primeiro.
 */
export function Hero() {
  return (
    <header id="inicio" className="relative isolate overflow-hidden bg-[#101112]">
      <Image
        src="/landing/cidade-noturna.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover object-right"
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-[#101112] via-[#101112]/80 to-[#101112]/10"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#101112] to-transparent"
        aria-hidden
      />

      <Cabecalho logo={<Logotipo className="h-12 w-auto sm:h-14 lg:h-16" priority />} />

      <div className="relative mx-auto grid w-full max-w-[1200px] gap-6 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-0 lg:pb-20 lg:pt-8">
        <div className="relative z-10">
          <Etiqueta>Entregas mais rápidas</Etiqueta>

          <h1 className="fonte-titulo mt-5 text-[2.6rem] leading-[1.02] text-white sm:text-6xl lg:text-[4.1rem]">
            Seu pedido,
            <br />
            na velocidade
            <br />
            <span className="text-[#FFCB24]">da sua vida.</span>
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">
            Com o Rapidinho Entrega, você recebe o que precisa, quando precisa. Com mais
            praticidade, segurança e variedade, direto na sua porta.
          </p>

          <SelosDasLojas className="mt-8" />

          <dl className="mt-10 grid grid-cols-3 sm:flex">
            {NUMEROS.map((numero, indice) => (
              <div
                key={numero.rotulo}
                className={
                  indice === 0 ? 'pr-3 sm:pr-7' : 'border-l border-white/20 px-3 sm:px-7'
                }
              >
                <dt className="sr-only">{numero.rotulo}</dt>
                <dd className="whitespace-nowrap text-xl font-extrabold text-[#FFCB24] sm:text-[1.7rem]">
                  {numero.valor}
                </dd>
                <dd className="text-xs leading-snug text-white/85 sm:text-sm" aria-hidden>
                  {numero.rotulo}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative mx-auto w-full max-w-[34rem] lg:-mr-10 lg:max-w-none">
          <Image
            src="/landing/motoboy.webp"
            {...MEDIDAS_DA_LANDING['motoboy.webp']}
            alt="Mascote do Rapidinho Entrega pilotando uma scooter amarela com a caixa de entrega"
            priority
            sizes="(min-width: 1024px) 640px, (min-width: 640px) 34rem, 92vw"
            className="relative h-auto w-full drop-shadow-[0_30px_40px_rgba(0,0,0,0.55)] lg:mt-6"
          />

          {/* Frase manuscrita: decorativa, o h1 já diz o mesmo. */}
          <p
            className="fonte-manuscrita pointer-events-none absolute -top-2 right-0 hidden -rotate-[14deg] text-right text-[2.4rem] leading-[1.05] text-[#FFCB24] drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] sm:block lg:-right-2 lg:-top-6 xl:-right-8 xl:text-[2.75rem]"
            aria-hidden
          >
            Chegou
            <br />
            Rápido,
            <br />
            <span className="pl-6">Chegou</span>
            <br />
            <span className="pl-16">Bem!</span>
            <Pincelada className="-mt-1 ml-auto w-28 rotate-[8deg]" />
          </p>
        </div>
      </div>
    </header>
  );
}
