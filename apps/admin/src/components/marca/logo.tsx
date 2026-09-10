import Image from 'next/image';
import { APP_NAME } from '@rapidinho/shared';
import { cn } from '@rapidinho/ui/lib/utils';

/** Logotipo do painel. Mesma arte do app do cliente, servida do /public local. */
export function Logotipo({ className }: { className?: string }) {
  return (
    <Image
      src="/marca/lettering.webp"
      width={560}
      height={186}
      alt={APP_NAME}
      priority
      className={cn('h-auto w-auto select-none', className)}
    />
  );
}
