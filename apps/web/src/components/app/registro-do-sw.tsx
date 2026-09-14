'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker.
 *
 * Só em produção: em desenvolvimento o SW cacheia o build e faz parecer que a
 * alteração não surtiu efeito, que é meia hora perdida toda vez.
 */
export function RegistroDoServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // Depois do load: registrar durante o carregamento disputa banda com o
    // conteúdo que a pessoa veio ver.
    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch((erro) => {
        console.error('[sw] falha ao registrar', erro);
      });
    };

    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar, { once: true });
  }, []);

  return null;
}
