import { unstable_cache } from 'next/cache';
import { prisma } from '@rapidinho/database';
import { Hero } from '@/components/landing/hero';
import { Beneficios } from '@/components/landing/beneficios';
import { Categorias, emojiDaCategoria } from '@/components/landing/categorias';
import { ComoFunciona } from '@/components/landing/como-funciona';
import { ParaLojistas } from '@/components/landing/para-lojistas';
import { Rodape } from '@/components/landing/rodape';

/**
 * Renderizada sob demanda, não no build: a imagem Docker é construída sem
 * banco disponível, então pré-renderizar aqui quebraria o deploy. O custo é
 * absorvido pelo cache abaixo, que consulta o Postgres no máximo uma vez por
 * minuto.
 */
export const dynamic = 'force-dynamic';

const carregarVitrine = unstable_cache(
  async () => {
    const [cidades, categorias] = await Promise.all([
      prisma.city.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          state: true,
          _count: { select: { stores: { where: { status: 'ACTIVE', deletedAt: null } } } },
        },
      }),
      prisma.storeCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
        select: { id: true, name: true, slug: true },
      }),
    ]);

    return { cidades, categorias };
  },
  ['vitrine-home'],
  { revalidate: 60, tags: ['cities', 'store-categories'] },
);

export default async function HomePage() {
  const { cidades, categorias } = await carregarVitrine();

  const cidadesDisponiveis = cidades.map((cidade) => ({
    id: cidade.id,
    nome: cidade.name,
    uf: cidade.state,
    slug: cidade.slug,
    lojas: cidade._count.stores,
  }));

  const categoriasDestaque = categorias.map((categoria) => ({
    id: categoria.id,
    nome: categoria.name,
    slug: categoria.slug,
    emoji: emojiDaCategoria(categoria.slug),
  }));

  // Com uma cidade só, os cartões de categoria já levam direto para ela — não
  // faz sentido pedir uma escolha que só tem uma resposta.
  const cidadeUnica = cidadesDisponiveis.length === 1 ? cidadesDisponiveis[0]?.slug : undefined;

  return (
    <>
      <Hero cidades={cidadesDisponiveis} />

      <main>
        <Beneficios />
        <Categorias
          categorias={categoriasDestaque}
          {...(cidadeUnica ? { cidadeSlug: cidadeUnica } : {})}
        />
        <ComoFunciona />
        <ParaLojistas />
      </main>

      <Rodape />
    </>
  );
}
