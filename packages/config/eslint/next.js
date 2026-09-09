import base from './base.js';

/**
 * Config para os apps Next.js. O preset `next/core-web-vitals` é carregado via
 * FlatCompat no eslint.config.js de cada app, pois depende do diretório do app.
 */
export default [
  ...base,
  {
    rules: {
      // Imagens sempre pelo <Image> do Next ou pelo componente de mídia do design system.
      '@next/next/no-img-element': 'error',
    },
  },
];
