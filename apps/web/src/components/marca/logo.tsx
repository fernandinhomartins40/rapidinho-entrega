import Image from 'next/image';
import { APP_NAME } from '@rapidinho/shared';
import { cn } from '@rapidinho/ui/lib/utils';

/**
 * Logotipo da marca.
 *
 * A arte tem contorno azul-marinho, então some em fundo escuro se usada
 * sozinha — por isso a variante `simbolo` (usada sobre o hero navy) vem dentro
 * de uma pastilha âmbar, que é como o símbolo aparece na caixa de entrega do
 * mascote.
 */
export function Logotipo({
  variante = 'lettering',
  className,
  priority = false,
}: {
  variante?: 'lettering' | 'completa';
  className?: string;
  priority?: boolean;
}) {
  const arte =
    variante === 'completa'
      ? { src: '/marca/logo-completa.webp', width: 640, height: 640 }
      : { src: '/marca/lettering.webp', width: 560, height: 186 };

  return (
    <Image
      src={arte.src}
      width={arte.width}
      height={arte.height}
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
      width={256}
      height={256}
      alt=""
      aria-hidden
      className={cn('select-none', className)}
    />
  );
}
