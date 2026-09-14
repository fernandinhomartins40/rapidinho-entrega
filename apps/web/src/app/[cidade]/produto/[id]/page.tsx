import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { isStoreOpen } from '@rapidinho/shared';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { FormularioDoProduto } from './formulario';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { name: true, description: true },
  });

  if (!produto) return { title: 'Produto não encontrado' };
  return { title: produto.name, description: produto.description ?? undefined };
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ cidade: string; id: string }>;
}) {
  const { cidade, id } = await params;

  const produto = await prisma.product.findFirst({
    where: {
      id,
      deletedAt: null,
      store: { status: 'ACTIVE', deletedAt: null, city: { slug: cidade, isActive: true } },
    },
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      compareAtPriceCents: true,
      sellingUnit: true,
      weightStepGrams: true,
      minWeightGrams: true,
      isAvailable: true,
      pausedUntil: true,
      image: { select: SELECT_IMAGEM },
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          isPausedUntil: true,
          pauseReason: true,
          hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
          closures: {
            where: { endsAt: { gte: new Date() } },
            select: { startsAt: true, endsAt: true, reason: true },
          },
        },
      },
      complementGroups: {
        orderBy: { sortOrder: 'asc' },
        select: {
          group: {
            select: {
              id: true,
              name: true,
              description: true,
              isRequired: true,
              minChoices: true,
              maxChoices: true,
              allowRepeat: true,
              isActive: true,
              options: {
                where: { isAvailable: true },
                orderBy: { sortOrder: 'asc' },
                select: { id: true, name: true, description: true, priceCents: true },
              },
            },
          },
        },
      },
    },
  });

  if (!produto) notFound();

  const abertura = isStoreOpen({
    hours: produto.store.hours,
    closures: produto.store.closures,
    pausedUntil: produto.store.isPausedUntil,
    pauseReason: produto.store.pauseReason,
  });

  const imagem = imagemExibivel(produto.image, 'large');
  const pausado = produto.pausedUntil != null && produto.pausedUntil > new Date();

  return (
    <main className="mx-auto max-w-lg pb-32">
      <div className="relative">
        {imagem.url ? (
          <div className="relative aspect-square w-full">
            <Image
              src={imagem.url}
              alt=""
              fill
              priority
              sizes="(max-width: 512px) 100vw, 512px"
              className="object-cover"
              {...(imagem.blurDataUrl
                ? { placeholder: 'blur' as const, blurDataURL: imagem.blurDataUrl }
                : {})}
            />
          </div>
        ) : (
          <div className="bg-muted aspect-[3/2] w-full" aria-hidden />
        )}

        <Link
          href={`/${cidade}/${produto.store.slug}`}
          aria-label="Voltar para a loja"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      <FormularioDoProduto
        produto={{
          id: produto.id,
          nome: produto.name,
          descricao: produto.description,
          precoCents: produto.priceCents,
          precoDeCents: produto.compareAtPriceCents,
          porPeso: produto.sellingUnit === 'WEIGHT_KG',
          passoGramas: produto.weightStepGrams ?? 100,
          minimoGramas: produto.minWeightGrams ?? 100,
          disponivel: produto.isAvailable && !pausado,
        }}
        loja={{
          id: produto.store.id,
          nome: produto.store.name,
          slug: produto.store.slug,
          aberta: abertura.isOpen,
          motivoFechada: abertura.reason ?? null,
        }}
        grupos={produto.complementGroups
          .map((vinculo) => vinculo.group)
          .filter((grupo) => grupo.isActive && grupo.options.length > 0)
          .map((grupo) => ({
            id: grupo.id,
            nome: grupo.name,
            descricao: grupo.description,
            obrigatorio: grupo.isRequired,
            minimo: grupo.minChoices,
            maximo: grupo.maxChoices,
            permiteRepetir: grupo.allowRepeat,
            opcoes: grupo.options.map((opcao) => ({
              id: opcao.id,
              nome: opcao.name,
              descricao: opcao.description,
              precoCents: opcao.priceCents,
            })),
          }))}
        cidadeSlug={cidade}
      />
    </main>
  );
}
