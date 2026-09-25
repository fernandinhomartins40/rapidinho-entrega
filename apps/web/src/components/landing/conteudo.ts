/**
 * Conteúdo publicitário da landing.
 *
 * Fica separado dos componentes porque é o que muda sem mexer em layout — e
 * porque parte dele ainda é PROVISÓRIO: números e depoimentos vieram da arte
 * de referência e precisam ser confirmados antes de valerem como afirmação ao
 * consumidor (CDC, art. 37).
 */

/** Links âncora da navegação, na ordem da arte. */
export const NAVEGACAO = [
  { rotulo: 'Início', href: '#inicio' },
  { rotulo: 'Vantagens', href: '#vantagens' },
  { rotulo: 'Como funciona', href: '#como-funciona' },
  { rotulo: 'Depoimentos', href: '#depoimentos' },
  { rotulo: 'Contato', href: '#contato' },
] as const;

/** PROVISÓRIO: números da arte de referência, ainda sem apuração. */
export const NUMEROS = [
  { valor: '+10 mil', rotulo: 'usuários' },
  { valor: '+500', rotulo: 'lojas parceiras' },
  { valor: '+50 mil', rotulo: 'entregas realizadas' },
] as const;

export interface Depoimento {
  texto: string;
  nome: string;
  papel: string;
  nota: number;
}

/**
 * PROVISÓRIO: depoimento da arte de referência. Publicar só com autorização
 * de quem falou. Com mais de um item, o carrossel mostra setas e indicadores.
 */
export const DEPOIMENTOS: Depoimento[] = [
  {
    texto: 'O Rapidinho facilitou minha rotina! Peço tudo pelo app e sempre chega rápido.',
    nome: 'Ana Paula Souza',
    papel: 'Usuária do Rapidinho',
    nota: 5,
  },
];

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
