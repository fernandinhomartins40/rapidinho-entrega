import { z } from 'zod';

/**
 * Segmentação de campanha de notificação.
 *
 * Mandar para todo mundo é o jeito mais rápido de fazer o cliente desligar as
 * notificações — e uma vez desligadas, não voltam. Por isso o padrão aqui é
 * restringir: a campanha escolhe cidade, papel e tempo de inatividade, e a
 * contagem de destinatários aparece antes do envio.
 */

export const PUBLICOS = ['CUSTOMERS', 'STORE_OWNERS', 'COURIERS'] as const;
export type Publico = (typeof PUBLICOS)[number];

export const PUBLICO_LABEL: Record<Publico, string> = {
  CUSTOMERS: 'Clientes',
  STORE_OWNERS: 'Lojistas',
  COURIERS: 'Entregadores',
};

export const notificationSegmentSchema = z.object({
  publico: z.enum(PUBLICOS).default('CUSTOMERS'),
  /** Vazio = todas as cidades atendidas. */
  cityIds: z.array(z.string().min(1)).default([]),
  /**
   * Só quem não pede há tantos dias. Serve para campanha de retorno, que é
   * onde push realmente compensa: quem pediu ontem não precisa de lembrete.
   */
  inativoHaDias: z.number().int().min(0).max(365).optional(),
  /** Só quem já fez ao menos um pedido — não incomoda quem só espiou. */
  apenasComPedido: z.boolean().default(false),
});

export type NotificationSegment = z.infer<typeof notificationSegmentSchema>;

export const notificationCampaignSchema = z.object({
  title: z.string().trim().min(3, 'Escreva um título').max(60, 'Máximo de 60 caracteres'),
  body: z.string().trim().min(3, 'Escreva a mensagem').max(180, 'Máximo de 180 caracteres'),
  /**
   * Caminho interno, nunca URL completa: um link externo numa notificação da
   * plataforma é exatamente o formato que um golpe imitaria.
   */
  linkUrl: z
    .string()
    .trim()
    .regex(/^\/[^/]/, 'Use um caminho do app, começando com / (ex.: /palmital-pr)')
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  segment: notificationSegmentSchema,
});

export type NotificationCampaignInput = z.infer<typeof notificationCampaignSchema>;

/** Descrição em uma linha, para a lista de campanhas e a confirmação de envio. */
export function descreverSegmento(segmento: NotificationSegment, cidades: string[] = []): string {
  const partes: string[] = [PUBLICO_LABEL[segmento.publico]];

  partes.push(cidades.length > 0 ? cidades.join(', ') : 'todas as cidades');

  if (segmento.apenasComPedido) partes.push('com pedido');
  if (segmento.inativoHaDias) partes.push(`parados há ${segmento.inativoHaDias} dias`);

  return partes.join(' · ');
}

/**
 * Papéis de usuário, repetidos aqui de propósito.
 *
 * O enum real mora no Prisma, e este pacote não depende do banco — ele roda
 * também no navegador. São quatro literais estáveis; o custo de repeti-los é
 * menor que o de arrastar o cliente do Prisma para o bundle do cliente.
 */
export type PapelDeUsuario = 'CUSTOMER' | 'STORE_OWNER' | 'STORE_STAFF' | 'COURIER';

/** Papéis que cada público abrange. */
export function papeisDoPublico(publico: Publico): PapelDeUsuario[] {
  switch (publico) {
    case 'STORE_OWNERS':
      return ['STORE_OWNER', 'STORE_STAFF'];
    case 'COURIERS':
      return ['COURIER'];
    case 'CUSTOMERS':
    default:
      return ['CUSTOMER'];
  }
}

/** Data-limite de inatividade; `null` quando o filtro não se aplica. */
export function limiteDeInatividade(
  segmento: NotificationSegment,
  agora: Date = new Date(),
): Date | null {
  if (!segmento.inativoHaDias) return null;

  return new Date(agora.getTime() - segmento.inativoHaDias * 24 * 60 * 60 * 1000);
}
