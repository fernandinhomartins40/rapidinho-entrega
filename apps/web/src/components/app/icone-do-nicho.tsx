import {
  LayoutGrid,
  PawPrint,
  Pill,
  ShoppingBasket,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@rapidinho/ui';
import type { GrupoDeCategoria } from '@/lib/grupos-de-categoria';

const ICONES: Record<GrupoDeCategoria['icone'], LucideIcon> = {
  restaurantes: UtensilsCrossed,
  mercado: ShoppingBasket,
  farmacia: Pill,
  bebidas: Wine,
  'pet-shop': PawPrint,
  outros: LayoutGrid,
};

/**
 * O ícone de um nicho: traço fino, uma cor só. Substitui as ilustrações 3D
 * na interface — elas continuam na landing, que é peça de campanha.
 */
export function IconeDoNicho({
  nicho,
  className,
  strokeWidth = 1.75,
}: {
  nicho: Pick<GrupoDeCategoria, 'icone'>;
  className?: string;
  strokeWidth?: number;
}) {
  const Icone = ICONES[nicho.icone];
  return <Icone aria-hidden strokeWidth={strokeWidth} className={cn('h-5 w-5', className)} />;
}
