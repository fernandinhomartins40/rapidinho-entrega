'use server';

import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { notificarUsuario } from '@rapidinho/services';
import { isValidDocument, normalizePhoneBR, slugify } from '@rapidinho/shared';
import { runAction, type ActionResult } from '@/lib/action';

/**
 * Cadastro de loja.
 *
 * Aberto a quem não tem conta: exigir login antes seria pedir que o lojista
 * entenda a plataforma para poder se cadastrar nela. A conta é criada junto, e
 * ele entra depois pelo mesmo telefone.
 *
 * A loja nasce em PENDING_APPROVAL e não aparece para ninguém até a plataforma
 * aprovar — é o gargalo que impede cadastro falso de virar loja no ar.
 */

const cadastroSchema = z.object({
  nome: z.string().min(2, 'Informe o nome da loja').max(120),
  documento: z.string().refine(isValidDocument, 'CPF ou CNPJ inválido'),
  telefone: z.string().min(10, 'Informe o telefone'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  responsavel: z.string().min(3, 'Informe seu nome').max(120),
  cityId: z.string().min(1, 'Escolha a cidade'),
  categoryId: z.string().optional(),
  rua: z.string().min(3, 'Informe a rua'),
  numero: z.string().max(20).optional(),
  bairro: z.string().min(2, 'Informe o bairro'),
  referencia: z.string().max(200).optional(),
});

/** Slug único: o nome da loja pode repetir entre cidades. */
async function slugDisponivel(nome: string): Promise<string> {
  const base = slugify(nome);

  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const candidato = tentativa === 0 ? base : `${base}-${tentativa + 1}`;
    const existe = await prisma.store.findUnique({
      where: { slug: candidato },
      select: { id: true },
    });

    if (!existe) return candidato;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function cadastrarLoja(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const dados = cadastroSchema.parse(Object.fromEntries(formData.entries()));

    const telefone = normalizePhoneBR(dados.telefone);

    if (!telefone) {
      return {
        ok: false,
        message: 'Telefone inválido.',
        fieldErrors: { telefone: 'Confira o número com DDD' },
      };
    }

    const cidade = await prisma.city.findFirst({
      where: { id: dados.cityId, isActive: true },
      select: { id: true },
    });

    if (!cidade) return { ok: false, message: 'Cidade indisponível.' };

    const documento = dados.documento.replace(/\D/g, '');

    const duplicada = await prisma.store.findFirst({
      where: { document: documento, deletedAt: null },
      select: { id: true, status: true },
    });

    if (duplicada) {
      return {
        ok: false,
        message:
          duplicada.status === 'PENDING_APPROVAL'
            ? 'Já recebemos um cadastro com este documento. Estamos analisando.'
            : 'Já existe uma loja com este CPF/CNPJ. Entre com seu telefone para acessá-la.',
      };
    }

    // O usuário é criado (ou reaproveitado) junto: o lojista entra depois com
    // o mesmo telefone, sem precisar de um segundo cadastro.
    const usuario = await prisma.user.upsert({
      where: { phone: telefone },
      update: { name: dados.responsavel },
      create: {
        phone: telefone,
        name: dados.responsavel,
        email: dados.email || null,
        role: 'STORE_OWNER',
        acceptedTermsAt: new Date(),
        acceptedPrivacyAt: new Date(),
      },
      select: { id: true, role: true },
    });

    const planoPadrao = await prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true, trialDays: true },
    });

    const loja = await prisma.$transaction(async (tx) => {
      const criada = await tx.store.create({
        data: {
          name: dados.nome,
          slug: await slugDisponivel(dados.nome),
          cityId: cidade.id,
          categoryId: dados.categoryId || null,
          document: documento,
          documentType: documento.length === 11 ? 'CPF' : 'CNPJ',
          phone: telefone,
          whatsapp: telefone,
          email: dados.email || null,
          street: dados.rua,
          number: dados.numero || null,
          neighborhood: dados.bairro,
          referencePoint: dados.referencia || null,
          // Nasce fechada e aguardando análise. Só a plataforma aprova.
          status: 'PENDING_APPROVAL',
          staff: {
            create: { userId: usuario.id, role: 'OWNER', isActive: true },
          },
          ...(planoPadrao
            ? {
                subscription: {
                  create: {
                    planId: planoPadrao.id,
                    status: planoPadrao.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(
                      Date.now() + (planoPadrao.trialDays || 30) * 24 * 3600 * 1000,
                    ),
                  },
                },
              }
            : {}),
        },
        select: { id: true, name: true },
      });

      // Promove quem já era cliente; nunca rebaixa um admin que se cadastrou
      // como lojista para testar.
      if (usuario.role === 'CUSTOMER') {
        await tx.user.update({ where: { id: usuario.id }, data: { role: 'STORE_OWNER' } });
      }

      return criada;
    });

    await notificarUsuario({
      userId: usuario.id,
      title: 'Cadastro recebido!',
      body: `Recebemos o cadastro da ${loja.name}. Avisamos assim que for aprovado — costuma levar até um dia útil.`,
      canais: ['WHATSAPP'],
      entity: { type: 'Store', id: loja.id },
    });

    return {
      ok: true,
      message:
        'Cadastro enviado! Avisamos no seu WhatsApp assim que a loja for aprovada. Depois é só entrar com este telefone.',
    };
  });
}
