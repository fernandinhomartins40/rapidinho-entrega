import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { APP_NAME } from '@rapidinho/shared';
import './globals.css';

/**
 * Fonte auto-hospedada.
 *
 * Um arquivo variável de 48 KB cobre todos os pesos. Não usamos o Google
 * Fonts: ele adiciona uma conexão a terceiro no caminho crítico (caro num 3G),
 * entrega o IP de cada visitante ao Google (o que a LGPD desaconselha) e faz o
 * build depender de rede.
 */
const inter = localFont({
  src: './fonts/inter-variable.woff2',
  variable: '--font-sans',
  display: 'swap',
  weight: '100 900',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'https://rapidinhoentrega.com.br'),
  title: {
    default: `${APP_NAME} — mercado, farmácia e restaurante na sua porta`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Peça de mercados, farmácias e restaurantes da sua cidade. Pague no Pix, no cartão ou na entrega e acompanhe o pedido em tempo real.',
  keywords: ['delivery', 'entrega', 'mercado', 'farmácia', 'restaurante', 'Palmital', 'Paraná'],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/marca/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/marca/icone-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/marca/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: APP_NAME,
    title: `${APP_NAME} — delivery na sua cidade`,
    description:
      'Mercado, farmácia e restaurante da sua cidade, entregues na sua porta. Acompanhe seu pedido em tempo real.',
    images: [{ url: '/marca/icone-512.png', width: 512, height: 512, alt: APP_NAME }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d1f3c',
  width: 'device-width',
  initialScale: 1,
  // Bloquear zoom prejudica quem tem baixa visão; o layout já é responsivo.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-background min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
