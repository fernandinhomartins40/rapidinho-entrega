/**
 * Barril do pacote.
 *
 * As fábricas de provedor vivem em `providers.ts` e são apenas reexportadas
 * aqui: `notifications` precisa delas, e importá-las deste arquivo fecharia um
 * ciclo — que o TypeScript aceita, mas que o bundler resolve como `undefined`
 * em tempo de execução.
 *
 * O processamento de imagem (sharp) fica fora de propósito: importe de
 * `@rapidinho/services/images` onde for realmente usado, para que rotas sem
 * upload não carreguem o binário nativo.
 */
export * from './providers';
export * from './logger';
export * from './observability';
export * from './redis';
export * from './queues';
export * from './rate-limit';
export * from './realtime/publisher';
export * from './storage/s3';
export * from './messaging/whatsapp';
export * from './messaging/otp';
export * from './payments/fake';
export * from './messaging/email';
export * from './messaging/push';
export * from './notifications';
export * from './notifications/campaign';
export * from './payments/mercadopago';
