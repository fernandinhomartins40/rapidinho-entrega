/**
 * Estado do formulário de login.
 *
 * Vive fora de `actions.ts` porque aquele arquivo é `'use server'`, e um
 * módulo de Server Actions só pode exportar funções async. Exportar uma
 * constante de lá faz o Next entregar outra coisa ao cliente — o sintoma foi o
 * formulário abrindo direto na etapa do código, sem nunca pedir o telefone.
 */

export interface LoginState {
  step: 'phone' | 'code';
  phone?: string;
  error?: string;
  /// Em desenvolvimento o código volta aqui, para não depender do WhatsApp.
  devCode?: string;
}

export const LOGIN_INITIAL_STATE: LoginState = { step: 'phone' };
