import Link from 'next/link';
import {
  LayoutGrid,
  PawPrint,
  Pill,
  ShoppingCart,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react';

/**
 * As seis vitrines da arte. Cada uma aponta para o slug de categoria do banco
 * que mais se aproxima; se a categoria não existir (ou for "Outros"), o cartão
 * leva para a cidade inteira.
 */
const CATEGORIAS = [
  {
    nome: 'Restaurantes',
    icone: UtensilsCrossed,
    slugs: ['restaurante', 'hamburgueria', 'lanchonete'],
  },
  { nome: 'Mercado', icone: ShoppingCart, slugs: ['supermercado', 'mercearia'] },
  { nome: 'Farmácia', icone: Pill, slugs: ['farmacia'] },
  { nome: 'Bebidas', icone: Wine, slugs: ['bebidas', 'adega', 'agua-e-gas'] },
  { nome: 'Pet Shop', icone: PawPrint, slugs: ['petshop', 'pet-shop'] },
  { nome: 'Outros', icone: LayoutGrid, slugs: [] },
] as const satisfies ReadonlyArray<{
  nome: string;
  icone: LucideIcon;
  slugs: readonly string[];
}>;

export function Categorias({
  slugsDisponiveis,
  cidadeSlug,
}: {
  /** Slugs das categorias ativas no banco. */
  slugsDisponiveis: string[];
  /** Com uma cidade só, os cartões já levam direto para ela. */
  cidadeSlug?: string;
}) {
  const ativos = new Set(slugsDisponiveis);

  return (
    <section
      id="parceiros"
      aria-labelledby="titulo-parceiros"
      className="scroll-mt-4 bg-white py-12 sm:py-14"
    >
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2
            id="titulo-parceiros"
            className="fonte-titulo text-[1.75rem] leading-[1.12] text-[#111214] sm:text-[2rem]"
          >
            Parceiros para todas
            <br />
            as <span className="text-[#EE5500]">suas necessidades</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#4B4F56]">
            Do seu restaurante favorito ao mercado da sua região. Tudo em um só lugar.
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CATEGORIAS.map((categoria) => {
            const slug = categoria.slugs.find((candidato) => ativos.has(candidato));
            const Icone = categoria.icone;
            const conteudo = (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#EE5500] shadow-[0_8px_18px_-12px_rgba(17,18,20,0.45)]">
                  <Icone className="h-7 w-7" strokeWidth={2} aria-hidden />
                </span>
                <span className="mt-3 block text-sm font-bold text-[#111214]">
                  {categoria.nome}
                </span>
              </>
            );
            const estilo =
              'flex h-full flex-col items-center justify-end rounded-2xl bg-[#F5F6F8] px-2 pb-4 pt-5 text-center';

            return (
              <li key={categoria.nome}>
                {cidadeSlug ? (
                  <Link
                    href={slug ? `/${cidadeSlug}/${slug}` : `/${cidadeSlug}`}
                    className={`${estilo} transition-all hover:-translate-y-1 hover:shadow-[0_16px_30px_-18px_rgba(16,17,18,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]`}
                  >
                    {conteudo}
                  </Link>
                ) : (
                  <div className={estilo}>{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
