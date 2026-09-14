import { parseCurrencyToCents } from '../utils/money';
import { productImportRowSchema, type ProductImportRow } from '../schemas/product';

/**
 * Importação de cardápio a partir de planilha.
 *
 * Vive em `shared` porque é lógica de domínio pura, sem banco: o painel usa
 * para importar de verdade e os testes rodam sem subir nada.
 *
 * A regra que guia o parser: planilha de mercadinho é bagunçada. Cabeçalho com
 * acento, sem acento, em maiúscula, coluna "Preço (R$)", linha em branco no
 * meio, preço escrito "12,90" ou "R$ 12,90". Recusar o arquivo inteiro por
 * causa disso empurraria o lojista de volta para o cadastro manual, que é
 * justamente o que a importação existe para evitar.
 */

export interface ImportedProduct {
  name: string;
  priceCents: number;
  categoryName?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  isAvailable: boolean;
  sellingUnit: 'UNIT' | 'WEIGHT_KG';
}

export interface ImportIssue {
  /// 1 é o cabeçalho; a primeira linha de dados é a 2, como o usuário vê.
  line: number;
  message: string;
}

export interface ImportResult {
  products: ImportedProduct[];
  issues: ImportIssue[];
  /// Total de linhas de dados lidas, incluindo as descartadas.
  totalRows: number;
}

/** Aceita as variações de cabeçalho que aparecem numa planilha real. */
const COLUMN_ALIASES: Record<keyof ProductImportRow, readonly string[]> = {
  nome: ['nome', 'produto', 'descricao do produto', 'item', 'name'],
  preco: ['preco', 'preço', 'valor', 'preco unitario', 'preco de venda', 'price'],
  categoria: ['categoria', 'grupo', 'secao', 'seção', 'category'],
  descricao: ['descricao', 'descrição', 'detalhes', 'observacao', 'description'],
  codigo: ['codigo', 'código', 'sku', 'referencia', 'referência', 'cod'],
  codigo_barras: ['codigo de barras', 'código de barras', 'ean', 'barcode', 'gtin'],
  disponivel: ['disponivel', 'disponível', 'ativo', 'situacao', 'status'],
  unidade: ['unidade', 'un', 'medida', 'tipo de venda'],
};

/** Minúscula, sem acento e sem pontuação — para casar cabeçalhos. */
function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Divide uma linha de CSV respeitando aspas.
 *
 * Um `split(',')` ingênuo quebra em "Refrigerante 2L, uva" — nome com vírgula
 * é comum e viraria duas colunas, deslocando o preço.
 */
export function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      // "" dentro de campo entre aspas representa uma aspa literal.
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

/**
 * Descobre o separador.
 *
 * Excel em português salva CSV com ponto e vírgula, porque a vírgula já é o
 * separador decimal. Supor vírgula deixaria a planilha do lojista brasileiro —
 * o caso comum — ilegível.
 */
export function detectDelimiter(headerLine: string): string {
  const candidates = [';', ',', '\t'];

  return (
    candidates
      .map((delimiter) => ({ delimiter, count: parseCsvLine(headerLine, delimiter).length }))
      .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ','
  );
}

function mapHeaders(headers: string[]): Partial<Record<keyof ProductImportRow, number>> {
  const mapping: Partial<Record<keyof ProductImportRow, number>> = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);

    for (const [campo, aliases] of Object.entries(COLUMN_ALIASES)) {
      const chave = campo as keyof ProductImportRow;
      if (mapping[chave] == null && aliases.includes(normalized)) {
        mapping[chave] = index;
      }
    }
  });

  return mapping;
}

/** "não", "0", "inativo" contam como indisponível; o resto é disponível. */
function readAvailability(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = normalizeHeader(value);
  return !['nao', 'n', '0', 'false', 'inativo', 'esgotado', 'indisponivel'].includes(normalized);
}

function readSellingUnit(value: string | undefined): 'UNIT' | 'WEIGHT_KG' {
  if (!value) return 'UNIT';
  const normalized = normalizeHeader(value);
  return ['kg', 'quilo', 'peso', 'granel', 'g'].includes(normalized) ? 'WEIGHT_KG' : 'UNIT';
}

export function parseProductCsv(content: string): ImportResult {
  // BOM do Excel: sem remover, o primeiro cabeçalho vira "\uFEFFnome" e não
  // casa com alias nenhum.
  const limpo = content.replace(/^\uFEFF/, '');
  const linhas = limpo.split(/\r?\n/).filter((linha) => linha.trim() !== '');

  if (linhas.length === 0) {
    return { products: [], issues: [{ line: 1, message: 'A planilha está vazia.' }], totalRows: 0 };
  }

  const delimiter = detectDelimiter(linhas[0] ?? '');
  const headers = parseCsvLine(linhas[0] ?? '', delimiter);
  const mapping = mapHeaders(headers);

  if (mapping.nome == null || mapping.preco == null) {
    return {
      products: [],
      issues: [
        {
          line: 1,
          message:
            'Não encontrei as colunas de nome e preço. A primeira linha precisa ter os títulos das colunas (ex.: Nome; Preço; Categoria).',
        },
      ],
      totalRows: 0,
    };
  }

  const products: ImportedProduct[] = [];
  const issues: ImportIssue[] = [];
  const nomesVistos = new Set<string>();

  for (let indice = 1; indice < linhas.length; indice += 1) {
    const numeroDaLinha = indice + 1;
    const campos = parseCsvLine(linhas[indice] ?? '', delimiter);

    const ler = (chave: keyof ProductImportRow): string | undefined => {
      const posicao = mapping[chave];
      if (posicao == null) return undefined;
      const valor = campos[posicao]?.trim();
      return valor === '' ? undefined : valor;
    };

    const bruto = {
      nome: ler('nome'),
      preco: ler('preco'),
      categoria: ler('categoria'),
      descricao: ler('descricao'),
      codigo: ler('codigo'),
      codigo_barras: ler('codigo_barras'),
      disponivel: ler('disponivel'),
      unidade: ler('unidade'),
    };

    const validado = productImportRowSchema.safeParse(bruto);

    if (!validado.success) {
      issues.push({
        line: numeroDaLinha,
        message: validado.error.issues[0]?.message ?? 'Linha inválida.',
      });
      continue;
    }

    const priceCents = parseCurrencyToCents(String(validado.data.preco));

    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      issues.push({
        line: numeroDaLinha,
        message: `Preço inválido: "${String(validado.data.preco)}".`,
      });
      continue;
    }

    const nome = validado.data.nome.trim();
    const chaveDuplicidade = nome.toLowerCase();

    // Planilha de mercado repete item. Avisar e pular é melhor que criar dois
    // produtos iguais que o lojista teria de caçar depois.
    if (nomesVistos.has(chaveDuplicidade)) {
      issues.push({
        line: numeroDaLinha,
        message: `"${nome}" aparece mais de uma vez na planilha.`,
      });
      continue;
    }

    nomesVistos.add(chaveDuplicidade);

    products.push({
      name: nome,
      priceCents,
      ...(validado.data.categoria ? { categoryName: validado.data.categoria.trim() } : {}),
      ...(validado.data.descricao ? { description: validado.data.descricao.trim() } : {}),
      ...(validado.data.codigo ? { sku: validado.data.codigo.trim() } : {}),
      ...(validado.data.codigo_barras ? { barcode: validado.data.codigo_barras.trim() } : {}),
      isAvailable: readAvailability(
        typeof validado.data.disponivel === 'string' ? validado.data.disponivel : undefined,
      ),
      sellingUnit: readSellingUnit(validado.data.unidade),
    });
  }

  return { products, issues, totalRows: linhas.length - 1 };
}

/** Modelo de planilha para o lojista baixar e preencher. */
export function buildImportTemplate(): string {
  return [
    'Nome;Preço;Categoria;Descrição;Código;Código de barras;Disponível;Unidade',
    'Arroz Tipo 1 5kg;27,90;Mercearia;Pacote de 5 quilos;ARR5;7891234567890;sim;un',
    'Picanha;89,90;Açougue;Peça resfriada;PIC;;sim;kg',
  ].join('\n');
}
