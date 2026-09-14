import Image from 'next/image';
import { APP_NAME, MEDIDAS_DA_MARCA } from '@rapidinho/shared';
import { cn } from '@rapidinho/ui/lib/utils';

/**
 * Logotipo do painel. Mesma arte do app do cliente, servida do /public local.
 *
 * As medidas vêm do módulo gerado junto com as artes, e não digitadas: o
 * gerador recorta o transparente em volta, então a altura muda quando a arte
 * muda.
 */
export function Logotipo({ className }: { className?: string }) {
  return (
    <Image
      src="/marca/lettering.webp"
      {...MEDIDAS_DA_MARCA['lettering.webp']}
      alt={APP_NAME}
      priority
      className={cn('h-auto w-auto select-none', className)}
    />
  );
}
