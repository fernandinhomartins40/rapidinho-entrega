/**
 * Conteúdo publicitário da landing.
 *
 * Fica separado dos componentes porque é o que muda sem mexer em layout — e
 * porque números e depoimentos só entram quando forem reais: afirmação ao
 * consumidor sem lastro é publicidade enganosa (CDC, art. 37).
 */

/** Links âncora da navegação, na ordem da arte. */
export const NAVEGACAO = [
  { rotulo: 'Início', href: '#inicio' },
  { rotulo: 'Vantagens', href: '#vantagens' },
  { rotulo: 'Como funciona', href: '#como-funciona' },
  // "Depoimentos" volta para cá quando houver depoimento real publicado.
  { rotulo: 'Contato', href: '#contato' },
] as const;

/**
 * Números da plataforma no topo da landing. Vazio até haver números apurados:
 * os da arte de referência ("+10 mil usuários", "+500 lojas") eram afirmação
 * ao consumidor sem lastro (CDC, art. 37). Preencha com dados reais.
 */
export const NUMEROS: readonly { valor: string; rotulo: string }[] = [];

export interface Depoimento {
  texto: string;
  nome: string;
  papel: string;
  nota: number;
}

/**
 * Depoimentos reais, publicados com autorização de quem falou. Vazio, a seção
 * não aparece: o da arte de referência era de uma pessoa que não existe. Com
 * mais de um item, o carrossel mostra setas e indicadores.
 */
export const DEPOIMENTOS: Depoimento[] = [];

/**
 * Lojas de aplicativo. Hoje o app é um PWA instalado pelo próprio site; quando
 * houver publicação nas lojas, basta preencher as URLs. Sem URL, o selo leva
 * para o pedido pelo site em vez de prometer um download que não existe.
 */
export const LOJAS_DE_APPS = {
  googlePlay: null as string | null,
  appStore: null as string | null,
};

/** Perfis oficiais. Só aparecem no rodapé os que tiverem URL. */
export const REDES_SOCIAIS = {
  instagram: null as string | null,
  facebook: null as string | null,
  youtube: null as string | null,
  tiktok: null as string | null,
};
