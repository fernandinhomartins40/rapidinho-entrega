import nextPlugin from '@next/eslint-plugin-next';
import base from './base.js';

/** Config para os apps Next.js. */
export default [
  ...base,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Imagem sempre pelo <Image> do Next ou pelo componente de mídia do
      // design system: o público está em 3G e foto sem otimização custa caro.
      '@next/next/no-img-element': 'error',
    },
  },
  {
    // Arquivos gerados pelo Next a cada build.
    ignores: ['next-env.d.ts', '.next/**'],
  },
];
