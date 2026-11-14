import Image from 'next/image';
import { Logotipo } from '@/components/marca/logo';
import { Cabecalho } from './cabecalho';
import { NUMEROS } from './conteudo';
import { MEDIDAS_DA_LANDING } from './medidas';
import { Etiqueta, SelosDasLojas } from './pecas';

/**
 * Topo da página: fundo claro, texto à esquerda e a foto do motoboy à direita.
 *
 * No computador a foto ocupa a metade direita e se funde ao branco por um
 * degradê; no celular ela vem inteira, embaixo do texto. É a única imagem da
 * página com prioridade de carga: é o que se vê primeiro.
 */
export function Hero() {
  return (
    <header id="inicio" className="relative isolate overflow-hidden bg-white">
      <Cabecalho logo={<Logotipo className="h-10 w-auto sm:h-12" priority />} />

      <div className="relative lg:min-h-[36rem]">
        <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 pb-10 pt-6 sm:px-8 lg:pb-20 lg:pt-12">
          <div className="lg:max-w-[33rem]">
            <Etiqueta tom="claro">Entregas mais rápidas</Etiqueta>

            <h1 className="fonte-titulo mt-5 text-[2.6rem] leading-[1.02] text-[#111214] sm:text-6xl lg:text-[4.1rem]">
              Seu pedido,
              <br />
              na velocidade
              <br />
              <span className="text-[#EE5500]">da sua vida.</span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-relaxed text-[#4B4F56] sm:text-lg">
              Com o Rapidinho Entrega, você recebe o que precisa, quando precisa. Mais praticidade,
              segurança e variedade, direto na sua porta.
            </p>

            <SelosDasLojas className="mt-8" />

            {NUMEROS.length > 0 ? (
              <dl className="mt-10 grid grid-cols-3 sm:flex">
                {NUMEROS.map((numero, indice) => (
                  <div
                    key={numero.rotulo}
                    className={
                      indice === 0 ? 'pr-3 sm:pr-7' : 'border-l border-[#111214]/15 px-3 sm:px-7'
                    }
                  >
                    <dt className="sr-only">{numero.rotulo}</dt>
                    <dd className="whitespace-nowrap text-xl font-extrabold text-[#EE5500] sm:text-[1.7rem]">
                      {numero.valor}
                    </dd>
                    <dd className="text-xs leading-snug text-[#4B4F56] sm:text-sm" aria-hidden>
                      {numero.rotulo}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>

        <div className="relative aspect-[4/3] w-full lg:absolute lg:inset-y-0 lg:right-0 lg:aspect-auto lg:w-[58%]">
          <Image
            src="/landing/motoboy.webp"
            {...MEDIDAS_DA_LANDING['motoboy.webp']}
            alt="Entregador do Rapidinho Entrega pilotando a moto com a mochila térmica da marca"
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="h-full w-full object-cover"
          />
          {/* Funde a foto ao fundo branco: em cima no celular, à esquerda no computador. */}
          <div
            className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-2/5 lg:bg-gradient-to-r"
            aria-hidden
          />
        </div>
      </div>
    </header>
  );
}
