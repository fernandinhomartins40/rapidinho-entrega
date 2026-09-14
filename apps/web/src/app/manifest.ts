import type { MetadataRoute } from 'next';
import { APP_NAME } from '@rapidinho/shared';

/**
 * Manifesto do PWA.
 *
 * Gerado pelo Next em vez de um arquivo estático para o nome e as cores
 * saírem das mesmas constantes que a interface usa — manifesto e app
 * divergindo é o tipo de coisa que ninguém percebe até o ícone instalado
 * ficar com o nome antigo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: 'Rapidinho',
    description: 'Mercado, farmácia e restaurante da sua cidade, entregues na sua porta.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'pt-BR',
    dir: 'ltr',
    background_color: '#0d1f3c',
    theme_color: '#0d1f3c',
    categories: ['food', 'shopping', 'lifestyle'],
    icons: [
      { src: '/marca/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/marca/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/marca/icone-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Meus pedidos', url: '/pedidos' },
      { name: 'Carrinho', url: '/carrinho' },
    ],
  };
}
