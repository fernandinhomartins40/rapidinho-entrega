#!/usr/bin/env node
/**
 * Mapa das server actions e rotas de API, para a revisão de ponta a ponta
 * (docs/revisao/PROTOCOLO.md, fase 1).
 *
 * Para cada `export async function` de um arquivo "use server" ele diz:
 * - qual guarda protege a ação (wrapper ou require* direto);
 * - quais ids vêm do formulário/argumento;
 * - se as queries Prisma de escrita/leitura por id carregam o escopo do dono
 *   (storeId, userId, customerId, courierId) no `where`.
 *
 * É heurística por texto, não análise de tipos: serve para ordenar a fila de
 * revisão manual, não para dar a ação como segura. Uso:
 *
 *   node scripts/auditoria/mapa-de-acoes.mjs            # tabela
 *   node scripts/auditoria/mapa-de-acoes.mjs --json     # para os agentes
 *   node scripts/auditoria/mapa-de-acoes.mjs --suspeitas
 */
import fs from 'node:fs';
import path from 'node:path';

const RAIZES = ['apps/web/src', 'apps/admin/src'];

const GUARDAS = [
  ['runStoreOwnerAction', 'dono-da-loja'],
  ['runStoreAction', 'equipe-da-loja'],
  ['runAdminAction', 'admin'],
  ['requireSuperAdmin', 'super-admin'],
  ['requireAdmin', 'admin'],
  ['requireCourier', 'entregador'],
  ['requireStoreOwner', 'dono-da-loja'],
  ['requireStoreAccess', 'equipe-da-loja'],
  ['comEntregador', 'entregador'],
  ['runAuthedAction', 'logado'],
  ['requireRole', 'papel'],
  ['requireUser', 'logado'],
  ['runAction', 'PUBLICA'],
  ['getCurrentUser', 'opcional'],
];

const ESCOPO = /\b(storeId|userId|customerId|courierId|ownerId|impersonatorId)\b/;

function listar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : listar(p);
    return /\.tsx?$/.test(p) ? [p] : [];
  });
}

function corpos(fonte) {
  const re = /export\s+(?:async\s+)?function\s+(\w+)/g;
  const marcas = [];
  let m;
  while ((m = re.exec(fonte))) marcas.push({ nome: m[1], inicio: m.index });
  return marcas.map((x, i) => ({
    nome: x.nome,
    corpo: fonte.slice(x.inicio, marcas[i + 1]?.inicio ?? fonte.length),
  }));
}

/** Queries Prisma com `where: { id ... }` e se o mesmo where traz escopo. */
function queriesPorId(corpo) {
  const re =
    /prisma\.(\w+)\.(update|updateMany|delete|deleteMany|findUnique|findFirst|upsert)\(\s*\{\s*where:\s*\{([^}]*)\}/g;
  const achados = [];
  let m;
  while ((m = re.exec(corpo))) {
    const where = m[3];
    if (!/\bid\b/.test(where)) continue;
    // `id: pedido.id` reaproveita um registro já buscado (com escopo, espera-se);
    // o que interessa é id cru vindo da entrada.
    const reaproveitado = /\bid:\s*\w+\.id\b/.test(where);
    achados.push({
      modelo: m[1],
      op: m[2],
      escopado: ESCOPO.test(where) || reaproveitado,
      where: where.replace(/\s+/g, ' ').trim(),
    });
  }
  return achados;
}

const linhas = [];

for (const raiz of RAIZES) {
  for (const arquivo of listar(raiz)) {
    const fonte = fs.readFileSync(arquivo, 'utf8');
    const rel = arquivo.split(path.sep).join('/');
    const ehAcao = /^\s*['"]use server['"]/m.test(fonte);
    const ehRota = /\/app\/api\/.*route\.ts$/.test(rel);
    if (!ehAcao && !ehRota) continue;

    const funcoes = corpos(fonte);
    const nomes = funcoes.map((f) => f.nome);
    for (const { nome, corpo } of funcoes) {
      // Ação que só repassa para outra ação exportada herda a guarda dela.
      const delega = nomes.find((n) => n !== nome && new RegExp(`return\\s+${n}\\(`).test(corpo));
      const guarda = delega
        ? `via ${delega}`
        : (GUARDAS.find(([g]) => corpo.includes(`${g}(`))?.[1] ?? 'NENHUMA');
      const ids = [
        ...new Set([...corpo.matchAll(/formData\.get\(['"](\w*[iI]d)['"]\)/g)].map((x) => x[1])),
      ];
      const queries = queriesPorId(corpo);
      const semEscopo = queries.filter((q) => !q.escopado);
      const suspeita =
        (guarda === 'NENHUMA' && !ehRota) ||
        (guarda === 'PUBLICA' && ids.length > 0) ||
        (['equipe-da-loja', 'dono-da-loja', 'logado', 'entregador'].includes(guarda) &&
          semEscopo.length > 0);
      linhas.push({
        arquivo: rel,
        funcao: nome,
        tipo: ehRota ? 'rota' : 'acao',
        guarda,
        ids,
        queriesSemEscopo: semEscopo.map((q) => `${q.modelo}.${q.op}{${q.where}}`),
        suspeita,
      });
    }
  }
}

const args = new Set(process.argv.slice(2));
const saida = args.has('--suspeitas') ? linhas.filter((l) => l.suspeita) : linhas;

if (args.has('--json')) {
  console.log(JSON.stringify(saida, null, 2));
} else {
  for (const l of saida) {
    const marca = l.suspeita ? '!!' : '  ';
    console.log(
      `${marca} ${l.guarda.padEnd(15)} ${l.arquivo}#${l.funcao}` +
        (l.ids.length ? `  ids=[${l.ids.join(',')}]` : '') +
        (l.queriesSemEscopo.length ? `  sem-escopo=${l.queriesSemEscopo.join(' | ')}` : ''),
    );
  }
  const total = linhas.length;
  const susp = linhas.filter((l) => l.suspeita).length;
  console.log(`\n${total} funções mapeadas, ${susp} na fila de revisão (!!).`);
  console.log('Suspeita não é bug: a ação pode conferir o dono antes da query. Confirme lendo.');
}
