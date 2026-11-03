/**
 * Regras de negócio do cliente e do entregador, sem cookies nem `next/headers`:
 * recebem o usuário já autenticado. Server Actions do site e rotas do app chamam
 * as mesmas funções, para preço, frete, cupom, estoque e status terem uma fonte só.
 *
 * Fora do barril de `@rapidinho/services`: elas importam o barril por dentro, e
 * `upload` fica de fora daqui porque carrega o sharp.
 */
export * from './resultado';
export * from './termos';
export * from './item';
export * from './carrinho';
export * from './checkout';
export * from './pedidos';
export * from './enderecos';
export * from './conta';
export * from './entregador';
export * from './catalogo';
export * from './pratos';
export * from './produtos-da-loja';
export * from './pedir';
export * from './fome';
export * from './leituras';
