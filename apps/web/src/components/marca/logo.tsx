import Image from 'next/image';
import { APP_NAME, MEDIDAS_DA_MARCA, type ArteDaMarca } from '@rapidinho/shared';
import { cn } from '@rapidinho/ui/lib/utils';

/**
 * Logotipo da marca.
 *
 * As letras da arte são pretas: sobre fundo escuro, use `variante="negativo"`.
 *
 * As medidas vêm do módulo gerado junto com as artes. Digitá-las aqui foi o
 * que fez o Next reservar um espaço de altura diferente da imagem — o CSS
 * corrige o desenho, mas o espaço reservado continua errado.
 */
function medidas(arte: ArteDaMarca) {
  return MEDIDAS_DA_MARCA[arte];
}

export function Logotipo({
  variante = 'lettering',
  className,
  priority = false,
}: {
  /** `negativo`: letras brancas, para fundo escuro. */
  variante?: 'lettering' | 'completa' | 'negativo';
  className?: string;
  priority?: boolean;
}) {
  const arte = (
    {
      lettering: 'lettering.webp',
      completa: 'logo-completa.webp',
      negativo: 'lettering-negativo.webp',
    } as const
  )[variante];

  return (
    <Image
      src={`/marca/${arte}`}
      {...medidas(arte)}
      alt={APP_NAME}
      priority={priority}
      className={cn('h-auto w-auto select-none', className)}
    />
  );
}

/** Só o símbolo, para cabeçalhos compactos e barra de navegação. */
export function Simbolo({ className }: { className?: string }) {
  return (
    <Image
      src="/marca/simbolo.webp"
      {...medidas('simbolo.webp')}
      alt=""
      aria-hidden
      className={cn('select-none', className)}
    />
  );
}
