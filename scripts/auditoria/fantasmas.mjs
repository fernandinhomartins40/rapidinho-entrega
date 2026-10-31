#!/usr/bin/env node
/**
 * Caça "funcionalidade fantasma": coisa que existe numa camada e não tem par
 * na outra (docs/revisao/PROTOCOLO.md, fase 1). É o sintoma típico de
 * implementação feita em pedaços isolados:
 *
 * - modelo Prisma que ninguém grava (fora do seed) ou que ninguém lê;
 * - fila BullMQ com produtor e sem worker, ou o contrário;
 * - evento de tempo real publicado e não escutado, ou o contrário;
 * - server action exportada que nenhuma tela importa;
 * - valor de enum que o código nunca atribui nem compara.
 *
 * Heurística por texto: cada linha é um ponto de partida para investigar,
 * não um bug confirmado. Uso:
 *
 *   node scripts/auditoria/fantasmas.mjs
 *   node scripts/auditoria/fantasmas.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = 'packages/database/prisma/schema.prisma';
const RAIZES = [
  'apps/web/src',
  'apps/admin/src',
  'apps/worker/src',
  'apps/realtime/src',
  'packages',
];
const IGNORAR =
  /node_modules|[\\/]\.next[\\/]|[\\/]dist[\\/]|prisma[\\/]seed|[\\/]migrations[\\/]|\.test\.ts$/;

function listar(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (IGNORAR.test(p)) return [];
    if (e.isDirectory()) return listar(p);
    return /\.(ts|tsx|mjs)$/.test(p) ? [p] : [];
  });
}

const arquivos = RAIZES.flatMap(listar).map((p) => ({
  rel: p.split(path.sep).join('/'),
  fonte: fs.readFileSync(p, 'utf8'),
}));
const tudo = arquivos.map((a) => a.fonte).join('\n');
const schema = fs.readFileSync(SCHEMA, 'utf8');
const achados = [];

// 1. Modelos sem escrita ou sem leitura -------------------------------------
const modelos = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
for (const modelo of modelos) {
  const acessor = modelo[0].toLowerCase() + modelo.slice(1);
  const base = `\\b(?:prisma|tx|db|cliente)\\.${acessor}\\.`;
  const escreve = new RegExp(`${base}(?:create|createMany|update|updateMany|upsert)\\(`).test(tudo);
  const le = new RegExp(`${base}(?:find\\w*|count|aggregate|groupBy)\\(`).test(tudo);
  // Escrita aninhada: `itens: { create: ... }` dentro do pai também conta.
  const aninhado = new RegExp(
    `\\b${acessor}s?\\s*:\\s*\\{\\s*(?:create|createMany|upsert|connectOrCreate)`,
  ).test(tudo);
  if (!escreve && !aninhado) achados.push({ tipo: 'modelo-sem-escrita', item: modelo });
  if (!le) achados.push({ tipo: 'modelo-sem-leitura-direta', item: modelo });
}

// 2. Filas -------------------------------------------------------------------
const filas = [...tudo.matchAll(/QUEUES\.(\w+)/g)].map((m) => m[1]);
for (const fila of new Set(filas)) {
  const consumida = new RegExp(`new Worker(?:<[^>]*>)?\\(\\s*QUEUES\\.${fila}\\b`).test(tudo);
  const produzida = new RegExp(`getQueue\\(\\s*QUEUES\\.${fila}\\)`).test(tudo);
  if (produzida && !consumida) achados.push({ tipo: 'fila-sem-worker', item: fila });
  if (consumida && !produzida) achados.push({ tipo: 'worker-sem-produtor', item: fila });
}
const declaradas = [
  ...(tudo.match(/export const QUEUES = \{([\s\S]*?)\}/)?.[1] ?? '').matchAll(/(\w+):/g),
].map((m) => m[1]);
for (const fila of declaradas) {
  if (!filas.includes(fila)) achados.push({ tipo: 'fila-declarada-e-nao-usada', item: fila });
}

// 3. Eventos de tempo real -----------------------------------------------------
const publicados = new Map();
const escutados = new Map();
for (const { rel, fonte } of arquivos) {
  const publica = /publishRealtime\w*\(/.test(fonte);
  for (const m of fonte.matchAll(/REALTIME_EVENTS\.(\w+)/g)) {
    const alvo = publica ? publicados : escutados;
    if (!alvo.has(m[1])) alvo.set(m[1], new Set());
    alvo.get(m[1]).add(rel);
  }
}
for (const [evento, onde] of publicados) {
  if (!escutados.has(evento))
    achados.push({ tipo: 'evento-sem-ouvinte', item: evento, onde: [...onde] });
}
for (const [evento, onde] of escutados) {
  if (!publicados.has(evento))
    achados.push({ tipo: 'ouvinte-sem-publicador', item: evento, onde: [...onde] });
}

// 4. Server actions que nada importa -------------------------------------------
for (const { rel, fonte } of arquivos) {
  if (!/^\s*['"]use server['"]/m.test(fonte)) continue;
  for (const m of fonte.matchAll(/export\s+async\s+function\s+(\w+)/g)) {
    const nome = m[1];
    const usos = arquivos.filter((a) => a.rel !== rel && new RegExp(`\\b${nome}\\b`).test(a.fonte));
    const usoInterno = (fonte.match(new RegExp(`\\b${nome}\\b`, 'g')) ?? []).length > 1;
    if (usos.length === 0 && !usoInterno)
      achados.push({ tipo: 'acao-nunca-chamada', item: nome, onde: [rel] });
  }
}

// 5. Valores de enum nunca usados no código ------------------------------------
for (const m of schema.matchAll(/^enum (\w+) \{([\s\S]*?)\}/gm)) {
  const valores = m[2]
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => /^[A-Z][A-Z0-9_]*$/.test(l));
  for (const valor of valores) {
    if (!new RegExp(`['"\`.]${valor}['"\`\\b]`).test(tudo))
      achados.push({ tipo: 'enum-nunca-usado', item: `${m[1]}.${valor}` });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(achados, null, 2));
} else {
  const porTipo = Object.groupBy(achados, (a) => a.tipo);
  for (const [tipo, lista] of Object.entries(porTipo)) {
    console.log(`\n## ${tipo} (${lista.length})`);
    for (const a of lista) console.log(`- ${a.item}${a.onde ? `  (${a.onde.join(', ')})` : ''}`);
  }
  console.log(
    `\n${achados.length} pontos para investigar. Cada um precisa ser confirmado no código e em runtime.`,
  );
}
