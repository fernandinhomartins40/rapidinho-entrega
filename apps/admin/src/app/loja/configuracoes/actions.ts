'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { isValidDocument, normalizePhoneBR } from '@rapidinho/shared';
import { runStoreOwnerAction, type ActionResult } from '@/lib/store-action';
import { boolFromForm } from '@/lib/admin-action';

/**
 * Dados cadastrais, contato, pagamento e operação da loja.
 *
 * Restrito ao dono: um funcionário do balcão não muda a chave Pix nem o CNPJ.
 */

const perfilSchema = z.object({
  name: z.string().min(2, 'Informe o nome da loja').max(120),
  description: z.string().max(1000).optional(),
  phone: z.string().min(10, 'Informe o telefone'),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  document: z.string().refine(isValidDocument, 'CPF ou CNPJ inválido'),
  legalName: z.string().max(160).optional(),
  street: z.string().min(2, 'Informe a rua'),
  number: z.string().max(20).optional(),
  neighborhood: z.string().min(2, 'Informe o bairro'),
  referencePoint: z.string().max(200).optional(),
  zipCode: z.string().max(12).optional(),
});

export async function salvarPerfilDaLoja(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreOwnerAction(async (access) => {
    const bruto = Object.fromEntries(
      [...formData.entries()].filter(([, valor]) => typeof valor === 'string'),
    );

    const dados = perfilSchema.parse(bruto);

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

    const whatsapp = dados.whatsapp ? normalizePhoneBR(dados.whatsapp) : null;

    const documento = dados.document.replace(/\D/g, '');

    await prisma.store.update({
      where: { id: access.storeId },
      data: {
        name: dados.name,
        description: dados.description ?? null,
        phone: telefone,
        whatsapp,
        email: dados.email || null,
        document: documento,
        // 11 dígitos é CPF (MEI sem CNPJ); 14 é CNPJ.
        documentType: documento.length === 11 ? 'CPF' : 'CNPJ',
        legalName: dados.legalName ?? null,
        street: dados.street,
        number: dados.number ?? null,
        neighborhood: dados.neighborhood,
        referencePoint: dados.referencePoint ?? null,
        zipCode: dados.zipCode ?? null,
      },
    });

    revalidatePath('/loja/configuracoes');
    revalidatePath('/loja');

    return {
      result: { ok: true, message: 'Dados da loja salvos.' },
      audit: { action: 'store.profile_updated', entityType: 'Store', entityId: access.storeId },
    };
  });
}

const pagamentoSchema = z
  .object({
    acceptsPix: z.boolean(),
    acceptsCardOnline: z.boolean(),
    acceptsCashOnDelivery: z.boolean(),
    acceptsCardOnDelivery: z.boolean(),
    pixKey: z.string().max(140).optional(),
  })
  .refine(
    (dados) =>
      dados.acceptsPix ||
      dados.acceptsCardOnline ||
      dados.acceptsCashOnDelivery ||
      dados.acceptsCardOnDelivery,
    {
      // Sem forma de pagamento a loja fica aberta e não fecha venda nenhuma —
      // um jeito silencioso de perder o dia inteiro.
      message: 'Escolha pelo menos uma forma de pagamento',
      path: ['acceptsPix'],
    },
  );

export async function salvarPagamentos(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreOwnerAction(async (access) => {
    const dados = pagamentoSchema.parse({
      acceptsPix: boolFromForm(formData.get('acceptsPix')),
      acceptsCardOnline: boolFromForm(formData.get('acceptsCardOnline')),
      acceptsCashOnDelivery: boolFromForm(formData.get('acceptsCashOnDelivery')),
      acceptsCardOnDelivery: boolFromForm(formData.get('acceptsCardOnDelivery')),
      pixKey: formData.get('pixKey')?.toString() || undefined,
    });

    await prisma.store.update({
      where: { id: access.storeId },
      data: { ...dados, pixKey: dados.pixKey ?? null },
    });

    revalidatePath('/loja/configuracoes');
    return {
      result: { ok: true, message: 'Formas de pagamento salvas.' },
      audit: { action: 'store.payments_updated', entityType: 'Store', entityId: access.storeId },
    };
  });
}

const operacaoSchema = z.object({
  soundAlertEnabled: z.boolean(),
  autoAcceptOrders: z.boolean(),
});

export async function salvarOperacao(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runStoreOwnerAction(async (access) => {
    const dados = operacaoSchema.parse({
      soundAlertEnabled: boolFromForm(formData.get('soundAlertEnabled')),
      autoAcceptOrders: boolFromForm(formData.get('autoAcceptOrders')),
    });

    await prisma.store.update({ where: { id: access.storeId }, data: dados });

    revalidatePath('/loja/configuracoes');
    revalidatePath('/loja/pedidos');
    return { result: { ok: true, message: 'Preferências salvas.' } };
  });
}

const imagemSchema = z.object({
  logoId: z.string().nullable(),
  coverId: z.string().nullable(),
});

export async function salvarImagensDaLoja(entrada: unknown): Promise<ActionResult> {
  return runStoreOwnerAction(async (access) => {
    const dados = imagemSchema.parse(entrada);

    await prisma.store.update({
      where: { id: access.storeId },
      data: { logoId: dados.logoId, coverId: dados.coverId },
    });

    revalidatePath('/loja/configuracoes');
    return { result: { ok: true, message: 'Imagens salvas.' } };
  });
}
