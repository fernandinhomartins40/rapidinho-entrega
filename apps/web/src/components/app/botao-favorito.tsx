'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { cn } from '@rapidinho/ui';
import { alternarFavorito } from '@/app/favoritos/actions';

/**
 * Coração da loja. Muda na hora (otimista) e se corrige com a resposta do
 * servidor; sem login, leva para entrar e volta para a mesma loja.
 */
export function BotaoFavorito({
  storeId,
  favorita: inicial,
  logado,
  className,
}: {
  storeId: string;
  favorita: boolean;
  logado: boolean;
  className?: string;
}) {
  const [favorita, setFavorita] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  function alternar() {
    if (!logado) {
      router.push(`/entrar?destino=${encodeURIComponent(pathname)}`);
      return;
    }

    setFavorita((atual) => !atual);
    iniciar(async () => {
      const resultado = await alternarFavorito(storeId);
      if (resultado.ok && resultado.favorita != null) setFavorita(resultado.favorita);
      else setFavorita(inicial);
    });
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={pendente}
      aria-pressed={favorita}
      aria-label={favorita ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform active:scale-90',
        className,
      )}
    >
      <Heart className={cn('h-5 w-5', favorita && 'fill-primary text-primary')} aria-hidden />
    </button>
  );
}
