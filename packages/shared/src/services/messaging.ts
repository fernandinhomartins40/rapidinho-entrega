/**
 * Contratos de mensageria: WhatsApp, OTP, e-mail e push.
 *
 * No interior o WhatsApp tem muito mais alcance que push, então ele é canal de
 * primeira classe, não um extra.
 */

export interface WhatsAppMessage {
  to: string;
  text: string;
  /// URL de mídia opcional (comprovante, cardápio, QR do Pix).
  mediaUrl?: string;
}

export interface WhatsAppProvider {
  readonly name: 'evolution' | 'cloud' | 'fake';
  sendText(message: WhatsAppMessage): Promise<{ messageId: string } | null>;
  isConfigured(): boolean;
}

export interface OtpSendInput {
  phone: string;
  code: string;
  expiresInMinutes: number;
}

export interface OtpSender {
  readonly channel: 'whatsapp' | 'sms' | 'console';
  send(input: OtpSendInput): Promise<void>;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailProvider {
  readonly name: 'resend' | 'fake';
  send(message: EmailMessage): Promise<{ id: string } | null>;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
  /// Mantém a notificação na tela até o lojista interagir.
  requireInteraction?: boolean;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushProvider {
  send(
    subscription: PushSubscriptionData,
    payload: PushPayload,
  ): Promise<{ ok: boolean; expired?: boolean }>;
}
