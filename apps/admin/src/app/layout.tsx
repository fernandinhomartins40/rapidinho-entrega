import type { Metadata, Viewport } from 'next';
import { APP_NAME } from '@rapidinho/shared';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `Painel · ${APP_NAME}`,
    template: `%s · Painel ${APP_NAME}`,
  },
  description: 'Painel de gestão da loja e da plataforma.',
  // O painel não deve aparecer em busca.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#ea6a12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background min-h-dvh font-sans">{children}</body>
    </html>
  );
}
