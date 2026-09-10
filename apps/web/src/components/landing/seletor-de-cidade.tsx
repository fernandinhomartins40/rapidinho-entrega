import Link from 'next/link';
import { ArrowRight, MapPin, Store } from 'lucide-react';

export interface CidadeDisponivel {
  id: string;
  nome: string;
  uf: string;
  slug: string;
  lojas: number;
}

/**
 * Entrada principal do app.
 *
 * A plataforma é multi-cidade, então escolher onde se está é o primeiro passo
 * de qualquer pedido. Antes do lançamento este mesmo cartão vira uma chamada
 * para o lojista — é ele que precisamos primeiro, sem loja não há delivery.
 */
export function SeletorDeCidade({ cidades }: { cidades: CidadeDisponivel[] }) {
  if (cidades.length === 0) {
    return <ChamadaPreLancamento />;
  }

  return (
    <section
      aria-labelledby="escolha-cidade"
      className="bg-card rounded-2xl border p-5 shadow-[0_28px_70px_-30px_rgba(13,31,60,0.65)] sm:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="bg-primary/12 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <MapPin className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 id="escolha-cidade" className="text-lg font-bold leading-tight">
            Escolha sua cidade
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Mostramos as lojas abertas perto de você.
          </p>
        </div>
      </div>

      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {cidades.map((cidade) => (
          <li key={cidade.id}>
            <Link
              href={`/${cidade.slug}`}
              className="border-input hover:border-primary hover:bg-accent focus-visible:ring-ring min-h-touch group flex items-center justify-between gap-3 rounded-xl border-2 p-4 transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold">
                  {cidade.nome}
                  <span className="text-muted-foreground font-normal"> — {cidade.uf}</span>
                </span>
                <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
                  <Store className="h-3.5 w-3.5" aria-hidden />
                  {cidade.lojas === 0
                    ? 'Em breve'
                    : `${cidade.lojas} ${cidade.lojas === 1 ? 'loja' : 'lojas'}`}
                </span>
              </span>
              <ArrowRight
                className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChamadaPreLancamento() {
  return (
    <section className="bg-card rounded-2xl border p-6 shadow-[0_28px_70px_-30px_rgba(13,31,60,0.65)] sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <h2 className="text-xl font-bold">Seu comércio pode ser o primeiro</h2>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Estamos abrindo a plataforma cidade por cidade. Cadastre sua loja agora e comece a
            vender assim que a sua for ativada — sem mensalidade para começar.
          </p>
        </div>

        <Link
          href="/cadastro-loja"
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring min-h-touch inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Cadastrar minha loja
          <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
