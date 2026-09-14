import base from '@rapidinho/config/eslint/next';

export default [
  ...base,
  {
    // O service worker roda num contexto próprio: `self`, `caches` e
    // `clients` existem lá, mas não no navegador comum nem no Node, então o
    // preset padrão os trata como indefinidos.
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        clients: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Promise: 'readonly',
      },
    },
  },
];
