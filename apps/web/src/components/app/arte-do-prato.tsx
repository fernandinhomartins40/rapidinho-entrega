import Image from 'next/image';
import type { ArteDoPrato as Arte } from '@rapidinho/shared';
import { cn } from '@rapidinho/ui';

/**
 * A cara do prato: a foto da loja quando existe; quando não, uma arte feita do
 * próprio prato (emoji grande sobre o degradê do tipo). Hoje nenhuma loja
 * subiu foto — sem isto, uma vitrine de pratos seria uma parede de cinza.
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
  tamanho?: 'sm' | 'md' | 'lg';
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

  return (
    <div
      role="img"
      aria-label={nome}
      className={cn('relative flex items-center justify-center overflow-hidden', className)}
      style={{ background: `linear-gradient(145deg, ${arte.fundo[0]}, ${arte.fundo[1]})` }}
    >
      {/* Brilho e textura: sem isso o degradê liso parece placeholder. */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.55), transparent 45%), radial-gradient(circle at 80% 90%, rgba(0,0,0,0.35), transparent 50%)',
        }}
      />
      <span
        aria-hidden
        className={cn(
          'relative select-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]',
          tamanho === 'lg' ? 'text-[6.5rem]' : tamanho === 'md' ? 'text-6xl' : 'text-4xl',
        )}
      >
        {arte.emoji}
      </span>
    </div>
  );
}
