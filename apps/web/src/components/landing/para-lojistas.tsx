import Link from 'next/link';
import { ArrowRight, Bike, Check } from 'lucide-react';

const VANTAGENS = [
  'Comece de graça: plano sem mensalidade, você paga só uma comissão por venda',
  'Cadastre um produto em menos de 30 segundos, direto do celular',
  'Tem centenas de itens? Importe tudo de uma planilha',
  'Pedido novo toca um alerta na tela, com comanda pronta para imprimir',
  'Use seus próprios entregadores ou a frota da plataforma',
] as const;

/**
 * Conversão do lojista.
 *
 * Fica em bloco escuro para separar visualmente: quem rolou até aqui e ainda
 * está lendo provavelmente é dono de comércio, não cliente.
 */
export function ParaLojistas() {
  return (
    <section
      aria-labelledby="para-lojistas"
      className="mx-auto w-full max-w-5xl px-5 pt-20 sm:pt-24"
    >
      <div className="bg-brand-deep relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-14">
        <div className="bg-dot-grid absolute inset-0 opacity-10" aria-hidden />

        <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-brand-tint text-sm font-semibold uppercase tracking-wide">
              Para quem vende
            </p>
            <h2
              id="para-lojistas"
              className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl"
            >
              Sua loja vendendo online, sem complicação
            </h2>
            <p className="mt-4 leading-relaxed text-white/80">
              Feito para quem não tem tempo de aprender sistema. Se você sabe usar o WhatsApp, sabe
              usar o painel.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/cadastro-loja"
                className="text-brand-deep focus-visible:ring-brand-tint min-h-touch inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-6 py-3.5 text-base font-bold transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2"
              >
                Cadastrar minha loja
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <Link
                href="/entregador"
                className="focus-visible:ring-brand-tint min-h-touch inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-white/30 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
              >
                <Bike className="h-5 w-5" aria-hidden />
                Quero ser entregador
              </Link>
            </div>
          </div>

          <ul className="space-y-3.5">
            {VANTAGENS.map((vantagem) => (
              <li key={vantagem} className="flex gap-3 text-white/90">
                <span className="bg-brand-amber/20 text-brand-tint mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-4 w-4" aria-hidden />
                </span>
                <span className="leading-relaxed">{vantagem}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
