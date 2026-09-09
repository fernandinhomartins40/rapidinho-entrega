import { z } from 'zod';

/**
 * Validação de variáveis de ambiente.
 *
 * Falhar cedo e alto: um deploy com env faltando deve quebrar no boot, não na
 * primeira vez que um cliente tenta pagar.
 */

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url('DATABASE_URL inválida'),
  REDIS_URL: z.string().url('REDIS_URL inválida'),

  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET precisa de pelo menos 32 caracteres'),
  AUTH_URL: z.string().url().optional(),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_PUBLIC_URL: z.string().url(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),

  PAYMENT_PROVIDER: z.enum(['mercadopago', 'asaas', 'fake']).default('fake'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_API_URL: z.string().url().optional(),

  WHATSAPP_PROVIDER: z.enum(['evolution', 'cloud', 'fake']).default('fake'),
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),

  OTP_PROVIDER: z.enum(['whatsapp', 'sms', 'console']).default('console'),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_WEB_URL: z.string().url(),
  NEXT_PUBLIC_ADMIN_URL: z.string().url(),
  NEXT_PUBLIC_SOCKET_URL: z.string().url(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
}

/**
 * Lê e valida as variáveis do servidor. Chame uma vez por processo.
 * Em produção, um erro aqui é fatal de propósito.
 */
export function parseServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente inválidas:\n${formatIssues(parsed.error)}\n` +
        'Confira o arquivo .env (veja .env.example).',
    );
  }

  const env = parsed.data;

  // Provedor configurado sem credencial é erro de deploy, não de runtime.
  if (env.PAYMENT_PROVIDER === 'mercadopago' && !env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('PAYMENT_PROVIDER=mercadopago exige MERCADOPAGO_ACCESS_TOKEN');
  }
  if (env.PAYMENT_PROVIDER === 'asaas' && !env.ASAAS_API_KEY) {
    throw new Error('PAYMENT_PROVIDER=asaas exige ASAAS_API_KEY');
  }
  if (env.WHATSAPP_PROVIDER === 'evolution' && !env.EVOLUTION_API_URL) {
    throw new Error('WHATSAPP_PROVIDER=evolution exige EVOLUTION_API_URL e EVOLUTION_API_KEY');
  }

  return env;
}

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const parsed = publicEnvSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(`Variáveis públicas inválidas:\n${formatIssues(parsed.error)}`);
  }

  return parsed.data;
}
