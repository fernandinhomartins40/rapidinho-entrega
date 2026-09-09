const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Slug amigável, sem acento — usado em cidade, loja e categoria. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Remove acentos para busca tolerante ("açaí" encontra "acai"). */
export function normalizeForSearch(input: string): string {
  return input.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}
