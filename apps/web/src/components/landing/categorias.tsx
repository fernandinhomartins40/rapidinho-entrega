import Link from 'next/link';

export interface CategoriaDestaque {
  id: string;
  nome: string;
  slug: string;
  emoji: string;
}

/**
 * Vitrine de categorias.
 *
 * As categorias vêm do banco (são dado, não código), e o emoji entra como
 * fallback visual: um ícone colorido por categoria custaria upload e
 * manutenção para um ganho pequeno nesta seção.
 */
const EMOJI_POR_SLUG: Record<string, string> = {
  supermercado: '🛒',
  mercearia: '🏪',
  acougue: '🥩',
  farmacia: '💊',
  pizzaria: '🍕',
  hamburgueria: '🍔',
  lanchonete: '🥐',
  'acai-e-sorvetes': '🍨',
  restaurante: '🍽️',
  petshop: '🐶',
  'agua-e-gas': '💧',
};

export function emojiDaCategoria(slug: string): string {
  return EMOJI_POR_SLUG[slug] ?? '🛍️';
}

export function Categorias({
  categorias,
  cidadeSlug,
}: {
  categorias: CategoriaDestaque[];
  cidadeSlug?: string;
}) {
  if (categorias.length === 0) return null;

  return (
    <section aria-labelledby="categorias" className="mx-auto w-full max-w-5xl px-5 pt-20 sm:pt-24">
      <h2 id="categorias" className="text-2xl font-bold tracking-tight sm:text-3xl">
        O que você encontra
      </h2>
      <p className="text-muted-foreground mt-2">
        Do arroz e feijão ao remédio de última hora, passando pela pizza de sexta.
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categorias.map((categoria) => {
          const conteudo = (
            <>
              <span
                className="bg-accent flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                aria-hidden
              >
                {categoria.emoji}
              </span>
              <span className="mt-3 block text-sm font-semibold leading-snug sm:text-base">
                {categoria.nome}
              </span>
            </>
          );

          // Sem cidade escolhida ainda, o cartão é só informativo: mandar para
          // uma listagem vazia seria pior que não ter link.
          return (
            <li key={categoria.id}>
              {cidadeSlug ? (
                <Link
                  href={`/${cidadeSlug}/${categoria.slug}`}
                  className="border-input hover:border-primary focus-visible:ring-ring bg-card block h-full rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(13,31,60,0.5)] focus-visible:outline-none focus-visible:ring-2"
                >
                  {conteudo}
                </Link>
              ) : (
                <div className="border-input bg-card h-full rounded-2xl border p-4">{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
