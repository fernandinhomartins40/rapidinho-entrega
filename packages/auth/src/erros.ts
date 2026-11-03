import type { UserRole } from '@rapidinho/shared';

/**
 * Fora de `guards.ts` porque aquele arquivo carrega o Auth.js, e a autenticação
 * por token não precisa dele nem para existir.
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 = 403,
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface CurrentUser {
  id: string;
  role: UserRole;
  name: string | null;
  phone: string | null;
  email: string | null;
  /// Preenchido quando um admin está operando como outro usuário.
  impersonatedBy?: { id: string; name: string | null };
}
