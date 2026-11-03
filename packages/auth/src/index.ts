import NextAuth from 'next-auth';
import { authConfig } from './config';

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export { authConfig } from './config';
export * from './guards';
export * from './api';
export * from './session';
export {
  requestOtp,
  verifyOtp,
  conferirCodigoDoTelefone,
  purgeExpiredOtpCodes,
  confirmInboundSms,
  entrarComTelefoneConfirmado,
  type RequestOtpResult,
  type VerifyOtpResult,
  type InboundSmsResult,
} from './otp';
export * from './sms-login';
export * from './senha';
export * from './consentimento';
export * from './token';
export * from './api-do-app';
export * from './login-por-telefone';
export * from './firebase';
export * from './entregador';
