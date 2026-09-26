'use client';

import { useEffect } from 'react';
import { COOKIE_DA_CIDADE } from '@/lib/cidade-lembrada';

/**
 * Guarda a última cidade visitada.
 *
 * É o que deixa o app instalado abrir na vitrine da pessoa, e não na página
 * de apresentação ou num seletor que ela já respondeu. Cookie, e não
 * localStorage: quem lê é o servidor, antes de montar a página.
 */
export function LembrarCidade({ slug }: { slug: string }) {
  useEffect(() => {
    const umAno = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE_DA_CIDADE}=${encodeURIComponent(slug)}; path=/; max-age=${umAno}; samesite=lax`;
  }, [slug]);

  return null;
}
