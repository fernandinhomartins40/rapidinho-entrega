import Image from 'next/image';
import {
  Apple,
  Baby,
  Beef,
  Beer,
  CakeSlice,
  Candy,
  Carrot,
  ChefHat,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Droplet,
  Egg,
  Fish,
  Flame,
  Grape,
  IceCreamCone,
  Milk,
  Package,
  PawPrint,
  Pill,
  Pizza,
  Salad,
  Sandwich,
  ShoppingBasket,
  Soup,
  SprayCan,
  Utensils,
  Wheat,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { ArteDoPrato as Arte, IconeDoPrato } from '@rapidinho/shared';
import { cn } from '@rapidinho/ui';

const ICONES: Record<IconeDoPrato, LucideIcon> = {
  Apple,
  Baby,
  Beef,
  Beer,
  CakeSlice,
  Candy,
  Carrot,
  ChefHat,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Droplet,
  Egg,
  Fish,
  Flame,
  Grape,
  IceCreamCone,
  Milk,
  Package,
  PawPrint,
  Pill,
  Pizza,
  Salad,
  Sandwich,
  ShoppingBasket,
  Soup,
  SprayCan,
  Utensils,
  Wheat,
  Wine,
};

/**
 * A cara do prato: a foto da loja quando existe; quando não, o ícone do tipo
 * em traço fino sobre um tom pastel. Hoje nenhuma loja subiu foto — sem isto
 * a vitrine seria uma parede de cinza, e com desenho colorido grande ficava
 * com cara de livro infantil.
 */
export function ArteDoPrato({
  imagem,
  arte,
  nome,
  tamanho = 'md',
  className,
  prioridade = false,
}: {
  imagem: string | null;
  arte: Arte;
  nome: string;
  tamanho?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  prioridade?: boolean;
}) {
  if (imagem) {
    return (
      <div className={cn('relative overflow-hidden', className)}>
        <Image
          src={imagem}
          alt={nome}
          fill
          priority={prioridade}
          sizes={tamanho === 'lg' ? '(max-width: 512px) 100vw, 512px' : '240px'}
          className="object-cover"
        />
      </div>
    );
  }

  const Icone = ICONES[arte.icone] ?? Utensils;

  return (
    <div
      role="img"
      aria-label={nome}
      className={cn('relative flex items-center justify-center overflow-hidden', className)}
      style={{ backgroundColor: arte.tom.fundo, color: arte.tom.tinta }}
    >
      <Icone
        aria-hidden
        strokeWidth={1.25}
        className={cn(
          tamanho === 'lg'
            ? 'h-24 w-24'
            : tamanho === 'md'
              ? 'h-14 w-14'
              : tamanho === 'sm'
                ? 'h-10 w-10'
                : 'h-7 w-7',
        )}
      />
    </div>
  );
}
