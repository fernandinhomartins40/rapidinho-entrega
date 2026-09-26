'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Mesma condição do script inline em `script-do-app.ts`. */
function estaNoApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * A landing é para quem ainda não conhece o Rapidinho; dentro do app instalado
 * ela quebraria a experiência de aplicativo.
 *
 * O script inline resolve o carregamento direto. Este componente cobre a
 * navegação interna — um link para `/` em Termos, no login… —, em que o Next
 * troca a página sem recarregar e o script inline não roda.
 */
export function GuardaDoApp() {
  const router = useRouter();

  useEffect(() => {
    if (estaNoApp()) router.replace('/app');
  }, [router]);

  return null;
}
