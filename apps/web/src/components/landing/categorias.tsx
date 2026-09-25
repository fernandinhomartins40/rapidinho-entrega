import Image from 'next/image';
import Link from 'next/link';
import { MEDIDAS_DA_LANDING, type ImagemDaLanding } from './medidas';

/**
 * As seis vitrines da arte. Cada uma aponta para o slug de categoria do banco
 * que mais se aproxima; se a categoria não existir (ou for "Outros"), o cartão
 * leva para a cidade inteira.
 */
const CATEGORIAS = [
  {
    nome: 'Restaurantes',
    imagem: 'categorias/restaurantes.webp',
    slugs: ['restaurante', 'hamburgueria', 'lanchonete'],
  },
  { nome: 'Mercado', imagem: 'categorias/mercado.webp', slugs: ['supermercado', 'mercearia'] },
  { nome: 'Farmácia', imagem: 'categorias/farmacia.webp', slugs: ['farmacia'] },
  { nome: 'Bebidas', imagem: 'categorias/bebidas.webp', slugs: ['bebidas', 'adega', 'agua-e-gas'] },
  { nome: 'Pet Shop', imagem: 'categorias/pet-shop.webp', slugs: ['petshop', 'pet-shop'] },
  { nome: 'Outros', imagem: 'categorias/outros.webp', slugs: [] },
] as const satisfies ReadonlyArray<{
  nome: string;
  imagem: ImagemDaLanding;
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
    <section aria-labelledby="parceiros" className="bg-white py-12 sm:py-14">
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-10">
        <div>
          <h2
            id="parceiros"
            className="fonte-titulo text-[1.75rem] leading-[1.12] text-[#101112] sm:text-[2rem]"
          >
            Parceiros para todas
            <br />
            as <span className="text-[#FFB900]">suas necessidades</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#3f4247]">
            Do seu restaurante favorito ao mercado da sua região. Tudo em um só lugar.
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CATEGORIAS.map((categoria) => {
            const slug = categoria.slugs.find((candidato) => ativos.has(candidato));
            const conteudo = (
              <>
                <span className="flex h-16 items-center justify-center">
                  <Image
                    src={`/landing/${categoria.imagem}`}
                    {...MEDIDAS_DA_LANDING[categoria.imagem]}
                    alt=""
                    loading="lazy"
                    className="max-h-14 w-auto"
                  />
                </span>
                <span className="mt-3 block text-sm font-bold text-[#101112]">
                  {categoria.nome}
                </span>
              </>
            );
            const estilo =
              'flex h-full flex-col items-center justify-end rounded-2xl bg-[#F5F7FA] px-2 pb-4 pt-5 text-center';

            return (
              <li key={categoria.nome}>
                {cidadeSlug ? (
                  <Link
                    href={slug ? `/${cidadeSlug}/${slug}` : `/${cidadeSlug}`}
                    className={`${estilo} transition-all hover:-translate-y-1 hover:shadow-[0_16px_30px_-18px_rgba(16,17,18,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB900]`}
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
