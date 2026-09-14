import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  ChargeResult,
  NormalizedWebhookEvent,
  PaymentGateway,
  PaymentStatusName,
} from '@rapidinho/shared';

/**
 * Mercado Pago.
 *
 * Só esta camada conhece o formato do provedor; o resto do sistema fala pela
 * interface `PaymentGateway`. Trocar para Asaas é escrever outro arquivo como
 * este, não mexer no checkout.
 */

const BASE = 'https://api.mercadopago.com';

interface Config {
  accessToken: string;
  /// Segredo da assinatura do webhook, no painel do Mercado Pago.
  webhookSecret?: string;
  notificationUrl?: string;
}

/** Status do provedor → status interno. */
function traduzirStatus(status: string): PaymentStatusName {
  switch (status) {
    case 'approved':
      return 'PAID';
    case 'authorized':
      return 'AUTHORIZED';
    case 'refunded':
    case 'charged_back':
      return 'REFUNDED';
    case 'cancelled':
      return 'CANCELLED';
    case 'rejected':
      return 'FAILED';
    default:
      return 'PENDING';
  }
}

interface RespostaDePagamento {
  id: number | string;
  status: string;
  date_approved?: string | null;
  status_detail?: string;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
}

export function createMercadoPagoGateway(config: Config): PaymentGateway {
  async function chamar(caminho: string, init?: RequestInit): Promise<unknown> {
    const resposta = await fetch(`${BASE}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const corpo = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      const detalhe =
        corpo && typeof corpo === 'object' && 'message' in corpo ? String(corpo.message) : '';
      throw new Error(`Mercado Pago respondeu ${resposta.status}. ${detalhe}`.trim());
    }

    return corpo;
  }

  return {
    name: 'mercadopago',

    async createPixCharge(input) {
      const corpo = (await chamar('/v1/payments', {
        method: 'POST',
        headers: {
          // Idempotência: um retry de rede não pode gerar duas cobranças para
          // o mesmo pedido.
          'X-Idempotency-Key': `pix_${input.orderId}`,
        },
        body: JSON.stringify({
          transaction_amount: input.amountCents / 100,
          description: input.description,
          payment_method_id: 'pix',
          external_reference: input.orderId,
          ...(config.notificationUrl ? { notification_url: config.notificationUrl } : {}),
          ...(input.expiresInSeconds
            ? {
                date_of_expiration: new Date(
                  Date.now() + input.expiresInSeconds * 1000,
                ).toISOString(),
              }
            : {}),
          ...(input.platformFeeCents ? { application_fee: input.platformFeeCents / 100 } : {}),
          payer: {
            first_name: input.payer.name.split(' ')[0],
            ...(input.payer.email ? { email: input.payer.email } : {}),
            ...(input.payer.document
              ? {
                  identification: {
                    type: input.payer.document.length > 11 ? 'CNPJ' : 'CPF',
                    number: input.payer.document,
                  },
                }
              : {}),
          },
        }),
      })) as RespostaDePagamento;

      const transacao = corpo.point_of_interaction?.transaction_data;

      return {
        externalId: String(corpo.id),
        qrCode: transacao?.qr_code ?? '',
        ...(transacao?.qr_code_base64
          ? { qrCodeImage: `data:image/png;base64,${transacao.qr_code_base64}` }
          : {}),
        ...(input.expiresInSeconds
          ? { expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000) }
          : {}),
        status: traduzirStatus(corpo.status),
      };
    },

    async createCardCharge(input) {
      const corpo = (await chamar('/v1/payments', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': `card_${input.orderId}` },
        body: JSON.stringify({
          transaction_amount: input.amountCents / 100,
          description: input.description,
          token: input.cardToken,
          installments: input.installments ?? 1,
          external_reference: input.orderId,
          ...(config.notificationUrl ? { notification_url: config.notificationUrl } : {}),
          ...(input.platformFeeCents ? { application_fee: input.platformFeeCents / 100 } : {}),
          payer: {
            ...(input.payer.email ? { email: input.payer.email } : {}),
            identification: {
              type: input.payer.document.length > 11 ? 'CNPJ' : 'CPF',
              number: input.payer.document,
            },
          },
        }),
      })) as RespostaDePagamento;

      return montarResultado(corpo);
    },

    async getPaymentStatus(externalId) {
      const corpo = (await chamar(`/v1/payments/${externalId}`)) as RespostaDePagamento;
      return montarResultado(corpo);
    },

    async refund(input) {
      await chamar(`/v1/payments/${input.externalId}/refunds`, {
        method: 'POST',
        body: JSON.stringify(input.amountCents ? { amount: input.amountCents / 100 } : {}),
      });

      return { externalId: input.externalId, status: 'REFUNDED' };
    },

    async parseWebhook(rawBody, headers): Promise<NormalizedWebhookEvent | null> {
      // Sem segredo configurado, nada é aceito: aceitar webhook não assinado
      // deixaria qualquer um marcar pedidos como pagos.
      if (!config.webhookSecret) {
        console.error('[mercadopago] webhook recebido sem MERCADOPAGO_WEBHOOK_SECRET configurado');
        return null;
      }

      const assinatura = headers['x-signature'];
      const requestId = headers['x-request-id'];

      if (!assinatura || !requestId) return null;

      // O cabeçalho vem como "ts=...,v1=...".
      const partes = Object.fromEntries(
        assinatura.split(',').map((parte) =>
          parte
            .trim()
            .split('=')
            .map((v) => v.trim()),
        ),
      ) as { ts?: string; v1?: string };

      if (!partes.ts || !partes.v1) return null;

      let payload: { data?: { id?: string | number }; type?: string; action?: string };

      try {
        payload = JSON.parse(rawBody);
      } catch {
        return null;
      }

      const dataId = payload.data?.id;
      if (!dataId) return null;

      // Manifest exatamente na ordem que o provedor documenta.
      const manifest = `id:${dataId};request-id:${requestId};ts:${partes.ts};`;
      const esperada = createHmac('sha256', config.webhookSecret).update(manifest).digest('hex');

      const bufferEsperado = Buffer.from(esperada);
      const bufferRecebido = Buffer.from(partes.v1);

      // Tempo constante: comparar com === vaza o prefixo correto pelo tempo de
      // resposta e permite forjar a assinatura byte a byte.
      if (
        bufferEsperado.length !== bufferRecebido.length ||
        !timingSafeEqual(bufferEsperado, bufferRecebido)
      ) {
        return null;
      }

      // A notificação só avisa que algo mudou; o estado verdadeiro vem da API.
      const pagamento = (await chamar(`/v1/payments/${dataId}`)) as RespostaDePagamento;

      return {
        provider: 'mercadopago',
        eventType: payload.action ?? payload.type ?? 'payment.updated',
        externalId: String(pagamento.id),
        status: traduzirStatus(pagamento.status),
        ...(pagamento.date_approved ? { paidAt: new Date(pagamento.date_approved) } : {}),
        // O mesmo pagamento no mesmo status é o mesmo evento, quantas vezes
        // o provedor reenviar.
        dedupeKey: `mercadopago:${pagamento.id}:${pagamento.status}`,
        raw: pagamento,
      };
    },
  };

  function montarResultado(corpo: RespostaDePagamento): ChargeResult {
    const status = traduzirStatus(corpo.status);

    return {
      externalId: String(corpo.id),
      status,
      ...(corpo.date_approved ? { paidAt: new Date(corpo.date_approved) } : {}),
      ...(status === 'FAILED' && corpo.status_detail ? { failReason: corpo.status_detail } : {}),
    };
  }
}
