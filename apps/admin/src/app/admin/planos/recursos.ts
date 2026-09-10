/**
 * Recursos que um plano pode liberar.
 *
 * Vive fora do arquivo de Server Actions por duas razões: um arquivo
 * 'use server' só pode exportar funções, e cada chave aqui corresponde a uma
 * verificação no código — o que o painel controla é quais delas cada plano
 * liga, não a existência delas.
 */
export const RECURSOS_DO_PLANO = [
  { chave: 'reports', rotulo: 'Relatórios e histórico financeiro' },
  { chave: 'coupons', rotulo: 'Cupons próprios da loja' },
  { chave: 'boost', rotulo: 'Comprar impulsionamento' },
  { chave: 'csvImport', rotulo: 'Importar catálogo por planilha' },
  { chave: 'ownCouriers', rotulo: 'Entregadores próprios' },
] as const;
