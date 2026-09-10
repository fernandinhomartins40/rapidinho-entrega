import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { APP_NAME } from '@rapidinho/shared';
import './globals.css';

// Auto-hospedada: um arquivo variável de 48 KB cobre todos os pesos, sem
// depender do Google Fonts no caminho crítico nem no build.
const inter = localFont({
  src: './fonts/inter-variable.woff2',
  variable: '--font-sans',
  display: 'swap',
  weight: '100 900',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: `Painel · ${APP_NAME}`,
    template: `%s · Painel ${APP_NAME}`,
  },
  description: 'Painel de gestão da loja e da plataforma.',
  // O painel não deve aparecer em busca.
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: '/marca/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/marca/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d1f3c',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-background min-h-dvh font-sans">{children}</body>
    </html>
  );
}
