/**
 * O app Android do cliente (apps/cliente-android) acrescenta esta marca ao
 * user agent do WebView.
 *
 * O login por SMS só existe dentro do app: cada código é um SMS pago, e o app
 * guarda a sessão para sempre, então o cliente confirma o número uma vez só.
 * A marca é forjável — isto é regra de produto, não barreira de segurança. O
 * que protege o crédito de SMS é o limite por telefone e por IP.
 */
export const MARCA_DO_APP_NATIVO = 'RapidinhoApp/';

export function estaNoAppNativo(userAgent: string | null | undefined): boolean {
  return userAgent?.includes(MARCA_DO_APP_NATIVO) ?? false;
}

/** APK servido pelo próprio site (apps/web/public/baixar). */
export const LINK_DO_APK = '/baixar/rapidinho.apk';
