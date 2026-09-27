import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { FormularioDeCidade } from './formulario';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Traga o Rapidinho para sua cidade',
  description:
    'Sua cidade ainda não tem aplicativo de entrega? Diga que quer — e se você tem loja ou moto, venha junto.',
};

/**
 * A porta de quem mora onde o Rapidinho ainda não chegou.
 *
 * Mostra as cidades que mais pediram: além de dar a sensação (verdadeira) de
 * movimento, é o convite para a pessoa chamar o vizinho — cada pedido a mais
 * aproxima a cidade dela da lista de abertura.
 */
export default async function MinhaCidadePage() {
  const ranking = await prisma.cityInterest.groupBy({
    by: ['cityKey', 'cityName', 'state'],
    _count: { _all: true },
    orderBy: { _count: { cityKey: 'desc' } },
    take: 5,
  });

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <Link
        href="/app?trocar=1"
        aria-label="Voltar"
        className="bg-secondary flex h-10 w-10 items-center justify-center rounded-full"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </Link>

      <h1 className="mt-5 text-[1.75rem] font-extrabold leading-tight tracking-tight">
        Sua cidade ainda não tem app de entrega?
        <br />
        <span className="text-primary-text">Então traga o Rapidinho.</span>
      </h1>
      <p className="text-muted-foreground mt-3">
        As grandes plataformas não chegam em cidade pequena. A gente chega — quando a cidade mostra
        que quer. Deixe seu WhatsApp e avisamos quando abrir. Tem loja ou moto? Venha junto: é assim
        que a cidade abre mais rápido.
      </p>

      <FormularioDeCidade />

      {ranking.length > 0 ? (
        <section aria-labelledby="ranking" className="mt-8">
          <h2 id="ranking" className="mb-3 font-bold">
            Cidades que mais pediram
          </h2>
          <ol className="space-y-2">
            {ranking.map((linha, posicao) => (
              <li
                key={linha.cityKey}
                className="bg-card flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
              >
                <span className="flex items-center gap-3">
                  <span className="text-primary-text w-5 font-extrabold">{posicao + 1}º</span>
                  <span className="font-semibold">
                    {linha.cityName}/{linha.state}
                  </span>
                </span>
                <span className="text-muted-foreground text-sm">
                  {linha._count._all} {linha._count._all === 1 ? 'pedido' : 'pedidos'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
