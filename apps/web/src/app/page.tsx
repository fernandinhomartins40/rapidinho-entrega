import { unstable_cache } from 'next/cache';
import { prisma } from '@rapidinho/database';
import Image from 'next/image';
import { Hero } from '@/components/landing/hero';
import { Beneficios } from '@/components/landing/beneficios';
import { AppEmDestaque } from '@/components/landing/app-em-destaque';
import { ComoFunciona } from '@/components/landing/como-funciona';
import { Categorias } from '@/components/landing/categorias';
import { Depoimentos } from '@/components/landing/depoimentos';
import { ChamadaFinal } from '@/components/landing/chamada-final';
import { Rodape } from '@/components/landing/rodape';
import { fonteManuscrita, fonteTitulo } from '@/components/landing/fontes';
import { MEDIDAS_DA_LANDING } from '@/components/landing/medidas';

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
        select: { slug: true },
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

  // Com uma cidade só, os cartões de categoria já levam direto para ela — não
  // faz sentido pedir uma escolha que só tem uma resposta.
  const cidadeUnica = cidadesDisponiveis.length === 1 ? cidadesDisponiveis[0]?.slug : undefined;

  return (
    <div className={`${fonteTitulo.variable} ${fonteManuscrita.variable} bg-[#101112]`}>
      <Hero />

      <main>
        <Beneficios />
        <AppEmDestaque />
        <ComoFunciona />
        <Categorias
          slugsDisponiveis={categorias.map((categoria) => categoria.slug)}
          {...(cidadeUnica ? { cidadeSlug: cidadeUnica } : {})}
        />
        <Depoimentos
          foto={
            <Image
              src="/landing/cliente.webp"
              {...MEDIDAS_DA_LANDING['cliente.webp']}
              alt="Cliente sorrindo enquanto faz um pedido pelo celular"
              loading="lazy"
              sizes="(min-width: 1024px) 19rem, 15rem"
              className="h-auto w-full"
            />
          }
        />
        <ChamadaFinal cidades={cidadesDisponiveis} />
      </main>

      <Rodape />
    </div>
  );
}
