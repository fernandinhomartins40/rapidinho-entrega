import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Bike, Clock, MessageCircle, Star } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { Badge } from '@rapidinho/ui';
import { formatCents, isStoreOpen, whatsappLink } from '@rapidinho/shared';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';
import { Cardapio } from './cardapio';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cidade: string; loja: string }>;
}) {
  const { loja } = await params;
  const encontrada = await prisma.store.findFirst({
    where: { slug: loja, status: 'ACTIVE', deletedAt: null },
    select: { name: true, description: true },
  });

  if (!encontrada) return { title: 'Loja não encontrada' };

  return {
    title: encontrada.name,
    description: encontrada.description ?? `Peça no ${encontrada.name} pelo Rapidinho Entrega.`,
  };
}

async function carregarLoja(citySlug: string, storeSlug: string) {
  const loja = await prisma.store.findFirst({
    where: {
      slug: storeSlug,
      status: 'ACTIVE',
      deletedAt: null,
      city: { slug: citySlug, isActive: true },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      phone: true,
      whatsapp: true,
      street: true,
      number: true,
      neighborhood: true,
      referencePoint: true,
      ratingAverage: true,
      ratingCount: true,
      deliveryFeeMode: true,
      deliveryFeeCents: true,
      freeDeliveryAboveCents: true,
      minOrderCents: true,
      avgPrepTimeMinutes: true,
      avgDeliveryTimeMinutes: true,
      acceptsPickup: true,
      acceptsPix: true,
      acceptsCardOnline: true,
      acceptsCashOnDelivery: true,
      acceptsCardOnDelivery: true,
      isPausedUntil: true,
      pauseReason: true,
      pizzaPricingRule: true,
      logo: { select: SELECT_IMAGEM },
      cover: { select: SELECT_IMAGEM },
      city: { select: { slug: true, name: true } },
      hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
      closures: {
        where: { endsAt: { gte: new Date() } },
        select: { startsAt: true, endsAt: true, reason: true },
      },
      menuCategories: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          products: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: {
              id: true,
              name: true,
              description: true,
              priceCents: true,
              compareAtPriceCents: true,
              sellingUnit: true,
              isAvailable: true,
              pausedUntil: true,
              image: { select: SELECT_IMAGEM },
            },
          },
        },
      },
      // Produtos sem categoria não podem sumir do cardápio só porque o lojista
      // não organizou: eles entram numa seção própria.
      products: {
        where: { deletedAt: null, categoryId: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          priceCents: true,
          compareAtPriceCents: true,
          sellingUnit: true,
          isAvailable: true,
          pausedUntil: true,
          image: { select: SELECT_IMAGEM },
        },
      },
      pizzaSizes: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, maxFlavors: true, slices: true },
      },
    },
  });

  return loja;
}

export default async function LojaPage({
  params,
}: {
  params: Promise<{ cidade: string; loja: string }>;
}) {
  const { cidade, loja: storeSlug } = await params;
  const loja = await carregarLoja(cidade, storeSlug);

  if (!loja) notFound();

  const abertura = isStoreOpen({
    hours: loja.hours,
    closures: loja.closures,
    pausedUntil: loja.isPausedUntil,
    pauseReason: loja.pauseReason,
  });

  const capa = imagemExibivel(loja.cover, 'large');
  const logo = imagemExibivel(loja.logo, 'medium');
  const agora = new Date();

  const mapear = (produto: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    compareAtPriceCents: number | null;
    sellingUnit: string;
    isAvailable: boolean;
    pausedUntil: Date | null;
    image: {
      thumbKey: string | null;
      mediumKey: string | null;
      largeKey: string | null;
      blurDataUrl: string | null;
    } | null;
  }) => ({
    id: produto.id,
    nome: produto.name,
    descricao: produto.description,
    precoCents: produto.priceCents,
    precoDeCents: produto.compareAtPriceCents,
    porPeso: produto.sellingUnit === 'WEIGHT_KG',
    disponivel:
      produto.isAvailable && (produto.pausedUntil == null || produto.pausedUntil <= agora),
    imagem: imagemExibivel(produto.image),
  });

  const secoes = [
    ...loja.menuCategories
      .filter((categoria) => categoria.products.length > 0)
      .map((categoria) => ({
        id: categoria.id,
        nome: categoria.name,
        descricao: categoria.description,
        produtos: categoria.products.map(mapear),
      })),
    ...(loja.products.length > 0
      ? [
          {
            id: 'sem-categoria',
            nome: 'Outros',
            descricao: null,
            produtos: loja.products.map(mapear),
          },
        ]
      : []),
  ];

  const contato = loja.whatsapp ?? loja.phone;

  return (
    <main>
      <div className="relative h-40 w-full sm:h-56">
        {capa.url ? (
          <Image
            src={capa.url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            {...(capa.blurDataUrl
              ? { placeholder: 'blur' as const, blurDataURL: capa.blurDataUrl }
              : {})}
          />
        ) : (
          <div className="from-primary to-brand-deep h-full w-full bg-gradient-to-br" aria-hidden />
        )}

        <Link
          href={`/${cidade}`}
          aria-label="Voltar"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      </div>

      <div className="mx-auto max-w-lg px-5">
        <div className="bg-card relative -mt-10 rounded-2xl border p-4 shadow-sm">
          <div className="flex items-start gap-3">
            {logo.url ? (
              <Image
                src={logo.url}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-xl border object-cover"
              />
            ) : null}

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight">{loja.name}</h1>
              {loja.description ? (
                <p className="text-muted-foreground mt-0.5 text-sm">{loja.description}</p>
              ) : null}
            </div>
          </div>

          <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {loja.ratingCount > 0 ? (
              <span className="flex items-center gap-1">
                <Star className="fill-warning text-warning h-4 w-4" aria-hidden />
                {Number(loja.ratingAverage).toFixed(1)} ({loja.ratingCount})
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden />
              {loja.avgPrepTimeMinutes + loja.avgDeliveryTimeMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <Bike className="h-4 w-4" aria-hidden />
              {loja.deliveryFeeMode === 'FREE' || loja.deliveryFeeCents === 0
                ? 'Entrega grátis'
                : formatCents(loja.deliveryFeeCents)}
            </span>
          </div>

          {loja.minOrderCents > 0 ? (
            <p className="text-muted-foreground mt-1 text-sm">
              Pedido mínimo de {formatCents(loja.minOrderCents)}
            </p>
          ) : null}

          {loja.freeDeliveryAboveCents ? (
            <p className="text-success mt-1 text-sm font-medium">
              Entrega grátis acima de {formatCents(loja.freeDeliveryAboveCents)}
            </p>
          ) : null}

          <p className="text-muted-foreground mt-2 text-sm">
            {[loja.street, loja.number].filter(Boolean).join(', ')} — {loja.neighborhood}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={abertura.isOpen ? 'success' : 'warning'}>
              {abertura.isOpen ? 'Aberta agora' : (abertura.reason ?? 'Fechada')}
            </Badge>
            {loja.acceptsPickup ? <Badge variant="secondary">Aceita retirada</Badge> : null}
            {loja.acceptsPix ? <Badge variant="secondary">Pix</Badge> : null}
            {loja.acceptsCashOnDelivery ? <Badge variant="secondary">Dinheiro</Badge> : null}
            {loja.acceptsCardOnDelivery ? <Badge variant="secondary">Maquininha</Badge> : null}
          </div>

          {contato ? (
            <a
              href={whatsappLink(contato)}
              target="_blank"
              rel="noreferrer"
              className="text-success min-h-touch mt-3 inline-flex items-center gap-2 text-sm font-semibold"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
              Falar com a loja no WhatsApp
            </a>
          ) : null}
        </div>

        <Cardapio
          storeId={loja.id}
          secoes={secoes}
          pizzaSizes={loja.pizzaSizes}
          aberta={abertura.isOpen}
          cidadeSlug={cidade}
        />
      </div>
    </main>
  );
}
