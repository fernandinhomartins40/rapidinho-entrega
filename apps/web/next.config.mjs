import { config as loadEnv } from 'dotenv';

// O .env é único e fica na raiz do monorepo; o Next só olha a pasta do app.
loadEnv({ path: '../../.env', quiet: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Imagem final enxuta no Docker: só o necessário para rodar.
  output: 'standalone',
  // Os pacotes do monorepo são publicados como TypeScript, não como build.
  transpilePackages: [
    '@rapidinho/ui',
    '@rapidinho/shared',
    '@rapidinho/auth',
    '@rapidinho/database',
    '@rapidinho/services',
  ],
  poweredByHeader: false,
  // Cliente entra por SMS pago e fica conectado como no WhatsApp; ver
  // SESSION_MAX_AGE_SECONDS em packages/auth. O painel fica nos 30 dias.
  env: { RAPIDINHO_SESSAO_DIAS: '400' },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Era 60 s: o navegador revalidava cada foto a todo minuto e o servidor
    // recomprimia. shortcut: arte trocada com o mesmo nome pode levar até uma
    // semana para aparecer a quem já visitou; para valer na hora, mude o nome.
    minimumCacheTTL: 604800,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
      // O curinga `**.` NÃO casa com o domínio sem subdomínio, e é dele que
      // as imagens são servidas (NEXT_PUBLIC_WEB_URL). Os dois precisam estar.
      { protocol: 'https', hostname: 'rapidinhoentrega.com.br' },
      { protocol: 'https', hostname: '**.rapidinhoentrega.com.br' },
    ],
  },
  // Módulos com binário nativo não podem passar pelo bundler do servidor.
  serverExternalPackages: ['sharp', 'ioredis'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Microfone só do próprio site: é o ditado do pedido por lista, e o
          // áudio é transcrito pelo navegador, sem passar pelo servidor.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(self), payment=()',
          },
        ],
      },
      {
        // Arquivos de public/ saíam com max-age=0: logo e fotos a cada visita.
        source: '/:pasta(landing|marca)/:arquivo*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
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
