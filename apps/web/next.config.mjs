import { config as loadEnv } from 'dotenv';

// O .env é único e fica na raiz do monorepo; o Next só olha a pasta do app.
loadEnv({ path: '../../.env', quiet: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Imagem final enxuta no Docker: só o necessário para rodar.
  output: 'standalone',
  // Os pacotes do monorepo são publicados como TypeScript, não como build.
  transpilePackages: ['@rapidinho/ui', '@rapidinho/shared', '@rapidinho/auth', '@rapidinho/database', '@rapidinho/services'],
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
      { protocol: 'https', hostname: '**.rapidinhoentrega.com.br' },
    ],
  },
  // Módulos com binário nativo não podem passar pelo bundler do servidor.
  serverExternalPackages: ['@prisma/client', 'sharp', 'ioredis'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
