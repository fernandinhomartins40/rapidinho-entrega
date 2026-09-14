'use server';

import { revalidatePath } from 'next/cache';
import { AUDIT_ACTIONS, prisma } from '@rapidinho/database';
import { contarDestinatarios, enfileirarCampanha } from '@rapidinho/services';
import { notificationCampaignSchema, notificationSegmentSchema } from '@rapidinho/shared';
import { runAdminAction } from '@/lib/admin-action';
import type { ActionResult } from '@/lib/action-state';

/**
 * Envio de campanha.
 *
 * O envio propriamente dito é do worker: mil notificações levam minutos e o
 * navegador desiste antes. Aqui a campanha é criada e enfileirada — o que
 * demora um piscar de olhos e é o que o usuário espera ver confirmado.
 */

function segmentoDoFormulario(formData: FormData) {
  const inativo = formData.get('inativoHaDias');

  return notificationSegmentSchema.parse({
    publico: formData.get('publico') ?? 'CUSTOMERS',
    // Um `select` múltiplo manda uma entrada por opção escolhida.
    cityIds: formData.getAll('cityIds').map(String).filter(Boolean),
    ...(inativo && inativo !== '' ? { inativoHaDias: Number(inativo) } : {}),
    apenasComPedido: formData.get('apenasComPedido') === 'on',
  });
}

export async function enviarCampanha(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const dados = notificationCampaignSchema.parse({
      title: formData.get('title'),
      body: formData.get('body'),
      linkUrl: formData.get('linkUrl') || undefined,
      segment: segmentoDoFormulario(formData),
    });

    const destinatarios = await contarDestinatarios(dados.segment);

    if (destinatarios === 0) {
      // Criar uma campanha vazia só sujaria o histórico, e o motivo mais
      // comum é filtro apertado demais — que é o que a mensagem aponta.
      return {
        result: {
          ok: false,
          message:
            'Nenhum destinatário com esse filtro. Lembre que a campanha só alcança quem aceitou receber novidades e tem o app instalado.',
        },
      };
    }

    const campanha = await prisma.notificationCampaign.create({
      data: {
        title: dados.title,
        body: dados.body,
        linkUrl: dados.linkUrl ?? null,
        channel: 'PUSH',
        segment: dados.segment,
        recipientCount: destinatarios,
      },
    });

    await enfileirarCampanha({ campaignId: campanha.id });

    revalidatePath('/admin/notificacoes');

    return {
      result: {
        ok: true,
        message: `Campanha na fila para ${destinatarios} ${destinatarios === 1 ? 'pessoa' : 'pessoas'}.`,
      },
      audit: {
        action: AUDIT_ACTIONS.campaignSent,
        entityType: 'NotificationCampaign',
        entityId: campanha.id,
        after: { title: campanha.title, segment: dados.segment, destinatarios },
      },
    };
  });
}

/** Prévia do alcance, para o admin ver antes de enviar. */
export async function contarAlcance(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(async () => {
    const total = await contarDestinatarios(segmentoDoFormulario(formData));

    return {
      result: {
        ok: true,
        message:
          total === 0
            ? 'Nenhuma pessoa com esse filtro.'
            : `${total} ${total === 1 ? 'pessoa receberia' : 'pessoas receberiam'} esta campanha.`,
      },
    };
  });
}
