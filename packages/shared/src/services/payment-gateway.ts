/**
 * Contrato do gateway de pagamento.
 *
 * Nenhum código de aplicação fala com Mercado Pago ou Asaas diretamente: tudo
 * passa por esta interface, para que trocar de gateway seja trocar de
 * implementação, não reescrever o checkout.
 */

export type PaymentProviderName = 'mercadopago' | 'asaas' | 'fake';

export interface PixChargeInput {
  orderId: string;
  amountCents: number;
  description: string;
  payer: {
    name: string;
    phone: string;
    document?: string;
    email?: string;
  };
  /// Prazo para o cliente pagar. Depois disso o pedido é cancelado por job.
  expiresInSeconds?: number;
  /// Split: quanto vai para a plataforma (quando o gateway suporta).
  platformFeeCents?: number;
  /// Identificador da conta do lojista no gateway, para split/repasse direto.
  receiverAccountId?: string;
}

export interface PixCharge {
  externalId: string;
  /// Payload copia-e-cola.
  qrCode: string;
  /// Imagem do QR em data URI ou URL.
  qrCodeImage?: string;
  expiresAt?: Date;
  status: PaymentStatusName;
}

export interface CardChargeInput {
  orderId: string;
  amountCents: number;
  description: string;
  /// Token gerado no cliente pelo SDK do gateway — o PAN nunca chega ao servidor.
  cardToken: string;
  installments?: number;
  payer: {
    name: string;
    document: string;
    email?: string;
    phone?: string;
  };
  platformFeeCents?: number;
  receiverAccountId?: string;
}

export type PaymentStatusName =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'REFUNDED'
  | 'FAILED'
  | 'CANCELLED';

export interface ChargeResult {
  externalId: string;
  status: PaymentStatusName;
  paidAt?: Date;
  failReason?: string;
}

export interface RefundInput {
  externalId: string;
  amountCents?: number;
  reason?: string;
}

/** Evento de webhook já normalizado para o formato interno. */
export interface NormalizedWebhookEvent {
  provider: PaymentProviderName;
  eventType: string;
  externalId: string;
  status: PaymentStatusName;
  amountCents?: number;
  paidAt?: Date;
  /// Chave de idempotência: o mesmo webhook nunca é processado duas vezes.
  dedupeKey: string;
  raw: unknown;
}

export interface PaymentGateway {
  readonly name: PaymentProviderName;

  createPixCharge(input: PixChargeInput): Promise<PixCharge>;
  createCardCharge(input: CardChargeInput): Promise<ChargeResult>;
  getPaymentStatus(externalId: string): Promise<ChargeResult>;
  refund(input: RefundInput): Promise<ChargeResult>;

  /**
   * Valida a assinatura do webhook e normaliza o payload.
   * Retorna null quando a assinatura não confere — o endpoint deve responder
   * 401 e nunca processar o evento.
   */
  parseWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): Promise<NormalizedWebhookEvent | null>;
}
