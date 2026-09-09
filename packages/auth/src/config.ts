import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@rapidinho/database';
import type { UserRole } from '@rapidinho/shared';
import type { NextAuthConfig } from 'next-auth';

/**
 * Configuração do Auth.js.
 *
 * A sessão vive no banco (não em JWT), como o projeto exige: assim o super
 * admin consegue revogar acesso na hora — indispensável para suspender uma
 * loja ou encerrar uma sessão de impersonation.
 *
 * O login por OTP não passa por um Provider do Auth.js: `Credentials` não
 * funciona com sessão em banco. O fluxo do telefone valida o código e cria a
 * sessão direto pelo adapter (veja `otp.ts` e `session.ts`), reaproveitando as
 * mesmas tabelas e o mesmo cookie.
 */
/**
 * Amplia os tipos do Auth.js com os campos que o projeto usa.
 * Fica aqui, e não num .d.ts solto, porque assim a declaração é carregada por
 * quem importa o pacote — um arquivo de tipos avulso não é visto pelo tsconfig
 * dos apps.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      phone: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: UserRole;
    phone: string | null;
  }
}

declare module '@auth/core/adapters' {
  interface AdapterUser {
    role: UserRole;
    phone: string | null;
  }
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'database',
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  pages: {
    signIn: '/entrar',
    error: '/entrar',
  },
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      // O papel precisa estar na sessão: o middleware decide a rota antes de
      // qualquer query, e uma ida ao banco por request seria desperdício.
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.phone = user.phone;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    },
  },
  providers: [],
} satisfies NextAuthConfig;
