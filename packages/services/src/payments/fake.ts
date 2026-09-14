import { randomUUID } from 'node:crypto';
import { buildPixBrCode, type PaymentGateway } from '@rapidinho/shared';

/**
 * Gateway de desenvolvimento.
 *
 * Gera um BR Code real (o CRC confere e o app do banco aceita o formato), mas
 * nenhuma cobrança é criada. Serve para rodar o fluxo inteiro de checkout sem
 * credencial de produção.
 *
 * A validação de ambiente recusa este provedor com NODE_ENV=production — o
 * que é o comportamento desejado, e não um descuido.
 */
export function createFakePaymentGateway(): PaymentGateway {
  return {
    name: 'fake',

    async createPixCharge(input) {
      return {
        externalId: `fake_${randomUUID()}`,
        qrCode: buildPixBrCode({
          pixKey: '00000000000',
          amountCents: input.amountCents,
          merchantName: 'Rapidinho Teste',
          merchantCity: 'Palmital',
          txid: input.orderId,
        }),
        expiresAt: new Date(Date.now() + (input.expiresInSeconds ?? 3600) * 1000),
        status: 'PENDING',
      };
    },

    async createCardCharge(input) {
      return {
        externalId: `fake_${randomUUID()}`,
        // Em desenvolvimento o cartão aprova na hora; testar recusa é papel do
        // ambiente de homologação do gateway de verdade.
        status: input.cardToken === 'recusar' ? 'FAILED' : 'PAID',
        paidAt: new Date(),
        ...(input.cardToken === 'recusar' ? { failReason: 'Cartão recusado (simulado)' } : {}),
      };
    },

    async getPaymentStatus(externalId) {
      return { externalId, status: 'PENDING' };
    },

    async refund(input) {
      return { externalId: input.externalId, status: 'REFUNDED' };
    },

    async parseWebhook() {
      // Sem assinatura para conferir, nada é aceito: um webhook falso não pode
      // marcar pedido como pago nem em desenvolvimento.
      return null;
    },
  };
}
