import { getAuth, signInWithPhoneNumber, signOut } from '@react-native-firebase/auth';

/**
 * O Firebase só confirma o telefone: a sessão do Rapidinho nasce em
 * `auth/firebase`, que troca o idToken pelo token nosso. Depois disso o
 * usuário do Firebase é descartado.
 */
export type Confirmacao = Awaited<ReturnType<typeof signInWithPhoneNumber>>;

export function enviarCodigo(telefoneE164: string): Promise<Confirmacao> {
  return signInWithPhoneNumber(getAuth(), telefoneE164);
}

export async function conferirCodigo(confirmacao: Confirmacao, codigo: string): Promise<string> {
  const credencial = await confirmacao.confirm(codigo);
  if (!credencial?.user) throw new Error('Código não confirmado');
  const idToken = await credencial.user.getIdToken();
  await signOut(getAuth()).catch(() => undefined);
  return idToken;
}

/** Converte o erro do Firebase numa frase que a pessoa entende. */
export function mensagemDoFirebase(erro: unknown): string {
  const codigo = (erro as { code?: string } | null)?.code ?? '';
  if (codigo.includes('invalid-verification-code'))
    return 'Código errado. Confira o SMS e tente de novo.';
  if (codigo.includes('code-expired') || codigo.includes('session-expired'))
    return 'O código venceu. Peça outro.';
  if (codigo.includes('invalid-phone-number')) return 'Confira o número com DDD.';
  if (codigo.includes('too-many-requests') || codigo.includes('quota-exceeded'))
    return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (codigo.includes('network')) return 'Sem conexão. Confira a internet.';
  return 'Não deu para confirmar agora. Tente de novo em instantes.';
}
