/**
 * Dinheiro no sistema é sempre Int em centavos. Estas funções são a única
 * fronteira entre centavos e o texto que o usuário lê.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * O Intl separa "R$" do valor com espaço não-quebrável (U+00A0/U+202F).
 * Normalizamos para espaço comum: o caractere invisível vaza para busca,
 * comparação de string e comanda impressa.
 */
function normalizeSpaces(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, ' ');
}

export function formatCents(cents: number): string {
  return normalizeSpaces(BRL.format(cents / 100));
}

/** "R$ 12,50", "12,50" ou "12.50" → 1250 */
export function parseCurrencyToCents(input: string): number {
  const digits = input.replace(/[^\d,.-]/g, '').trim();
  if (digits === '') return 0;

  const normalized = digits.includes(',') ? digits.replace(/\./g, '').replace(',', '.') : digits;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return 0;

  return Math.round(value * 100);
}

/**
 * Aplica percentual sobre um valor em centavos, arredondando para o centavo
 * mais próximo. Usado para comissão e cupom percentual.
 */
export function percentOfCents(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

/** Preço proporcional ao peso escolhido. `pricePerKgCents` é o preço do quilo. */
export function weightPriceCents(pricePerKgCents: number, grams: number): number {
  return Math.round((pricePerKgCents * grams) / 1000);
}

export function formatGrams(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
  }
  return `${grams} g`;
}
