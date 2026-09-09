import type { Metadata, Viewport } from 'next';
import { APP_NAME } from '@rapidinho/shared';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — delivery na sua cidade`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Peça de mercados, farmácias e restaurantes da sua cidade e acompanhe a entrega em tempo real.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#ea6a12',
  width: 'device-width',
  initialScale: 1,
  // Bloquear zoom prejudica quem tem baixa visão; o layout já é responsivo.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background min-h-dvh font-sans">{children}</body>
    </html>
  );
}
