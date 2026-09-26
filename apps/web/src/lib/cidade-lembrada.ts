/**
 * Cookie com a última cidade visitada.
 *
 * Módulo à parte, e não exportado do componente cliente que o grava: constante
 * exportada de arquivo `'use client'` chega ao servidor como referência de
 * cliente, não como valor.
 */
export const COOKIE_DA_CIDADE = 'rapidinho_cidade';
