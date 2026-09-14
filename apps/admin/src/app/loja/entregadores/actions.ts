'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { isValidCPF, normalizePhoneBR } from '@rapidinho/shared';
import { runStoreOwnerAction, type ActionResult } from '@/lib/store-action';

/**
 * Entregadores próprios da loja.
 *
 * A plataforma também tem frota (Courier sem storeId). Aqui a loja só mexe nos
 * seus: um entregador da frota compartilhada não pode ser editado por uma loja
 * qualquer, e é por isso que toda query filtra por storeId.
 */

const entregadorSchema = z.object({
  name: z.string().min(3, 'Informe o nome').max(120),
  phone: z.string().min(10, 'Informe o telefone'),
  // CPF é exigido pela plataforma para o repasse e para responder por quem
  // entra na casa do cliente. Validado de verdade, não só pelo tamanho.
  document: z.string().refine(isValidCPF, 'CPF inválido'),
  vehicleType: z.enum(['MOTORCYCLE', 'BICYCLE', 'CAR', 'ON_FOOT']),
});

export async function convidarEntregador(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreOwnerAction(async (access) => {
    const dados = entregadorSchema.parse({
      name: formData.get('name'),
      phone: formData.get('phone'),
      document: formData.get('document'),
      vehicleType: formData.get('vehicleType'),
    });

    const telefone = normalizePhoneBR(dados.phone);

    if (!telefone) {
      return {
        result: {
          ok: false,
          message: 'Telefone inválido.',
          fieldErrors: { phone: 'Confira o número' },
        },
      };
    }

    const loja = await prisma.store.findUniqueOrThrow({
      where: { id: access.storeId },
      select: { cityId: true },
    });

    // O entregador entra pelo mesmo login por telefone dos outros papéis: o
    // usuário é criado agora e, quando ele pedir o código, a conta já existe
    // com o papel certo.
    const usuario = await prisma.user.upsert({
      where: { phone: telefone },
      update: { name: dados.name },
      create: {
        phone: telefone,
        name: dados.name,
        role: 'COURIER',
        acceptedTermsAt: new Date(),
        acceptedPrivacyAt: new Date(),
      },
      select: { id: true, role: true },
    });

    const jaExiste = await prisma.courier.findUnique({
      where: { userId: usuario.id },
      select: { id: true, storeId: true },
    });

    if (jaExiste) {
      if (jaExiste.storeId === access.storeId) {
        return { result: { ok: false, message: 'Esse entregador já está na sua equipe.' } };
      }
      return {
        result: {
          ok: false,
          message:
            'Esse telefone já é de um entregador cadastrado em outra loja ou na frota da plataforma.',
        },
      };
    }

    const entregador = await prisma.courier.create({
      data: {
        userId: usuario.id,
        storeId: access.storeId,
        cityId: loja.cityId,
        document: dados.document.replace(/\D/g, ''),
        documentType: 'CPF',
        type: 'STORE_OWNED',
        vehicleType: dados.vehicleType,
        // Entregador da própria loja não passa pela aprovação da plataforma:
        // quem responde por ele é o lojista que o cadastrou.
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
      select: { id: true },
    });

    revalidatePath('/loja/entregadores');

    return {
      result: { ok: true, message: `${dados.name} entrou na sua equipe.` },
      audit: { action: 'courier.invited', entityType: 'Courier', entityId: entregador.id },
    };
  });
}

export async function alternarEntregador(id: string, ativo: boolean): Promise<ActionResult> {
  return runStoreOwnerAction(async (access) => {
    const { count } = await prisma.courier.updateMany({
      where: { id, storeId: access.storeId },
      data: { status: ativo ? 'ACTIVE' : 'SUSPENDED' },
    });

    if (count === 0) {
      return { result: { ok: false, message: 'Entregador não encontrado na sua equipe.' } };
    }

    revalidatePath('/loja/entregadores');
    return {
      result: { ok: true, message: ativo ? 'Entregador reativado.' : 'Entregador suspenso.' },
    };
  });
}
