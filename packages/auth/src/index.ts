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
  purgeExpiredOtpCodes,
  type RequestOtpResult,
  type VerifyOtpResult,
} from './otp';
