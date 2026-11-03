import type { LucideIcon } from 'lucide-react-native';
import {
  Flame,
  PawPrint,
  Pill,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  Wine,
} from 'lucide-react-native';
import type { ChaveDaCategoria } from './tokens';

const ICONES: Record<ChaveDaCategoria, LucideIcon> = {
  comida: UtensilsCrossed,
  mercado: ShoppingBasket,
  farmacia: Pill,
  bebidas: Wine,
  pet: PawPrint,
  casa: Flame,
  outros: Store,
};

export const iconeDaCategoria = (chave: ChaveDaCategoria) => ICONES[chave];

/** O banco tem categorias editáveis; o app só precisa saber de que família são. */
export function chaveDaCategoria(slug?: string | null, segmento?: string | null): ChaveDaCategoria {
  const nome = slug ?? '';
  if (/pet|agro|racao/.test(nome)) return 'pet';
  if (/bebida|adega|distribuidora-de-bebidas/.test(nome)) return 'bebidas';
  if (/gas|agua/.test(nome)) return 'casa';
  if (/farmacia|drogaria/.test(nome) || segmento === 'PHARMACY') return 'farmacia';
  if (/mercado|mercearia|acougue|hortifruti|padaria/.test(nome) || segmento === 'MARKET') {
    return 'mercado';
  }
  if (segmento === 'RESTAURANT') return 'comida';
  return /restaurante|lanche|pizza|hamburguer|acai|sorvete/.test(nome) ? 'comida' : 'outros';
}
