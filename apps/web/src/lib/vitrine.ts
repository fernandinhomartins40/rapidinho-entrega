import { isStoreOpen } from '@rapidinho/shared';
import type { LojaNaVitrine } from '@/components/app/cartao-de-loja';
import { imagemExibivel, SELECT_IMAGEM } from '@/lib/media';

/** Campos da loja que o cartão da vitrine precisa. */
export function selectDaLojaNaVitrine(agora: Date) {
  return {
    id: true,
    name: true,
    slug: true,
    description: true,
    ratingAverage: true,
    ratingCount: true,
    deliveryFeeMode: true,
    deliveryFeeCents: true,
    minOrderCents: true,
    avgPrepTimeMinutes: true,
    avgDeliveryTimeMinutes: true,
    isPausedUntil: true,
    pauseReason: true,
    sellsAtCounterPrice: true,
    city: { select: { slug: true } },
    category: { select: { name: true, slug: true } },
    logo: { select: SELECT_IMAGEM },
    hours: { select: { weekday: true, opensAt: true, closesAt: true, isActive: true } },
    closures: {
      where: { endsAt: { gte: agora } },
      select: { startsAt: true, endsAt: true, reason: true },
    },
  } as const;
}

interface LojaDoBanco {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ratingAverage: unknown;
  ratingCount: number;
  deliveryFeeMode: string;
  deliveryFeeCents: number;
  minOrderCents: number;
  avgPrepTimeMinutes: number;
  avgDeliveryTimeMinutes: number;
  isPausedUntil: Date | null;
  pauseReason: string | null;
  sellsAtCounterPrice: boolean;
  category: { name: string; slug: string } | null;
  logo: Parameters<typeof imagemExibivel>[0];
  hours: Parameters<typeof isStoreOpen>[0]['hours'];
  closures: Parameters<typeof isStoreOpen>[0]['closures'];
}

export function paraLojaNaVitrine(loja: LojaDoBanco, patrocinada = false): LojaNaVitrine {
  const abertura = isStoreOpen({
    hours: loja.hours,
    closures: loja.closures,
    pausedUntil: loja.isPausedUntil,
    pauseReason: loja.pauseReason,
  });

  return {
    id: loja.id,
    nome: loja.name,
    slug: loja.slug,
    descricao: loja.description,
    categoria: loja.category?.name ?? null,
    categoriaSlug: loja.category?.slug ?? null,
    nota: Number(loja.ratingAverage),
    avaliacoes: loja.ratingCount,
    taxaCents: loja.deliveryFeeMode === 'FREE' ? 0 : loja.deliveryFeeCents,
    taxaGratis: loja.deliveryFeeMode === 'FREE',
    minimoCents: loja.minOrderCents,
    tempoMin: loja.avgPrepTimeMinutes + loja.avgDeliveryTimeMinutes,
    aberta: abertura.isOpen,
    motivoFechada: abertura.reason ?? null,
    imagem: imagemExibivel(loja.logo),
    patrocinada,
    precoDeBalcao: loja.sellsAtCounterPrice,
  };
}
