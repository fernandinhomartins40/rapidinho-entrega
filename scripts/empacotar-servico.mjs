/**
 * Empacota um serviço Node (worker, realtime) num arquivo só.
 *
 * Por que empacotar, e não apenas compilar com `tsc`:
 *
 * `@rapidinho/shared` é ESM e publica `./src/index.ts` — TypeScript cru. O Node
 * 22 até carrega `.ts` por type-stripping, mas o carregador ESM exige extensão
 * em import relativo, e o shared não as tem. O resultado era que `worker` e
 * `realtime` NÃO SUBIAM: ERR_MODULE_NOT_FOUND antes da primeira linha rodar.
 *
 * Corrigir por extensão não resolve: o Node não mapeia `./x.js` para `x.ts`
 * (testado). Empacotar resolve tudo em tempo de build, e de quebra tira o
 * `packages/` inteiro da imagem.
 *
 * O que NÃO é empacotado: as dependências npm. Elas ficam externas porque
 * trazem binário nativo (sharp, engines do Prisma) ou fazem resolução própria
 * em runtime — empacotar quebraria.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// O esbuild é resolvido a partir do diretório do SERVIÇO, não deste script: o
// pnpm isola os node_modules por pacote, e `scripts/` na raiz não enxerga a
// dependência declarada em apps/<serviço>.
const exigir = createRequire(pathToFileURL(resolve('package.json')));
const { build } = await import(pathToFileURL(exigir.resolve('esbuild')).href);

const [entrada, saida] = process.argv.slice(2);

if (!entrada || !saida) {
  console.error('uso: node scripts/empacotar-servico.mjs <entrada.ts> <saida.js>');
  process.exit(1);
}

// Regra: empacota tudo, EXCETO o que quebra ao ser empacotado.
//
// A tentação é manter todo o npm externo, mas o pnpm isola: `zod` é
// transitiva de `@rapidinho/shared` e não fica resolvível a partir do serviço.
// Então o padrão é empacotar, e a lista de exceções é explícita e justificada:
//
//   sharp          — binário nativo por plataforma
//   bullmq         — carrega scripts Lua do disco em runtime
//   ioredis        — compartilhada com o bullmq; sai junto para não duplicar
//   @prisma/client — resolve os engines por caminho, em runtime
//   @sentry/node   — entra por import dinâmico e é opcional
//   @rapidinho/database — reexporta o cliente gerado do Prisma por caminho
//                    relativo; empacotar quebra o `__dirname` que localiza os
//                    engines. É CommonJS e autocontido (não importa o shared),
//                    então o Node o resolve sem problema em runtime.
//
// Quem for acrescentar algo aqui: diga POR QUE não pode ser empacotado.
const EXTERNOS_OBRIGATORIOS = process.argv.slice(4);

// O cliente gerado do Prisma não pode ser empacotado: ele localiza os engines
// com `__dirname`, que deixa de existir dentro do pacote.
//
// A primeira tentativa foi copiá-lo para `dist/prisma-client/` — e isso o
// DUPLICAVA, porque ele já vem em node_modules pela árvore de produção. Agora
// `@rapidinho/database` o expõe como subcaminho, e basta mantê-lo externo por
// nome: o Node o resolve de node_modules, uma cópia só.
const PRISMA_POR_NOME = '@rapidinho/database/generated/client';

const clienteDoPrismaAoLado = {
  name: 'prisma-ao-lado',
  setup(build) {
    build.onResolve({ filter: /generated\/client/ }, (args) => {
      if (args.kind === 'entry-point') return null;
      return { path: PRISMA_POR_NOME, external: true };
    });
  },
};

const manterExternoOQuePrecisa = {
  name: 'externos-obrigatorios',
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return null;
      if (args.path.startsWith('.') || args.path.startsWith('/')) return null;
      const externo = EXTERNOS_OBRIGATORIOS.some(
        (nome) => args.path === nome || args.path.startsWith(`${nome}/`),
      );
      return externo ? { path: args.path, external: true } : null;
    });
  },
};

const resultado = await build({
  entryPoints: [entrada],
  outfile: saida,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  plugins: [clienteDoPrismaAoLado, manterExternoOQuePrecisa],
  sourcemap: false,
  minify: false,
  // O topo dos arquivos de saída: alguns pacotes CommonJS esperam `require`
  // definido, que não existe em módulo ESM.
  banner: {
    js: [
      "import { createRequire as __criarRequire } from 'node:module';",
      'const require = __criarRequire(import.meta.url);',
    ].join('\n'),
  },
  metafile: true,
  logLevel: 'warning',
});

const bytes = Object.values(resultado.metafile.outputs)[0]?.bytes ?? 0;
console.log(`  ${saida}: ${(bytes / 1024).toFixed(0)} kB`);
