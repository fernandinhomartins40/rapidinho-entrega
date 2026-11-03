'use server';

import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { notificarUsuario } from '@rapidinho/services';
import { COMISSAO_HABILITADA, isValidDocument, normalizePhoneBR, slugify } from '@rapidinho/shared';
import { gerarHashDeSenha } from '@rapidinho/shared/senha';
import { runAction, type ActionResult } from '@/lib/action';
import { conferirTelefoneDoCadastro, TELEFONE_JA_TEM_CONTA } from '@/lib/telefone-confirmado';

/**
 * Cadastro de loja.
 *
 * Aberto a quem não tem conta: exigir login antes seria pedir que o lojista
 * entenda a plataforma para poder se cadastrar nela. A conta é criada junto,
 * com e-mail e senha, que é como o lojista entra no painel.
 *
 * O telefone é provado por código SMS antes de qualquer gravação, e o
 * formulário só cria conta nova: se o número já tem conta, nada é alterado e a
 * equipe liga a loja à conta existente (decisão 11 do dono).
 *
 * A loja nasce em PENDING_APPROVAL e não aparece para ninguém até a plataforma
 * aprovar — é o gargalo que impede cadastro falso de virar loja no ar.
 */

const cadastroSchema = z.object({
  nome: z.string().min(2, 'Informe o nome da loja').max(120),
  documento: z.string().refine(isValidDocument, 'CPF ou CNPJ inválido'),
  telefone: z.string().min(10, 'Informe o telefone'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(8, 'Use pelo menos 8 caracteres'),
  confirmacao: z.string(),
  responsavel: z.string().min(3, 'Informe seu nome').max(120),
  cityId: z.string().min(1, 'Escolha a cidade'),
  categoryId: z.string().optional(),
  rua: z.string().min(3, 'Informe a rua'),
  numero: z.string().max(20).optional(),
  bairro: z.string().min(2, 'Informe o bairro'),
  referencia: z.string().max(200).optional(),
  codigo: z.string().trim().default(''),
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
  return runAction(async (): Promise<ActionResult> => {
    const dados = cadastroSchema.parse(Object.fromEntries(formData.entries()));

    const telefone = normalizePhoneBR(dados.telefone);

    if (!telefone) {
      return {
        ok: false,
        message: 'Telefone inválido.',
        fieldErrors: { telefone: 'Confira o número com DDD' },
      };
    }

    if (dados.senha !== dados.confirmacao) {
      return {
        ok: false,
        message: 'Confira os campos destacados.',
        fieldErrors: { confirmacao: 'As senhas não são iguais' },
      };
    }

    const cidade = await prisma.city.findFirst({
      where: { id: dados.cityId, isActive: true },
      select: { id: true },
    });

    if (!cidade) return { ok: false, message: 'Cidade indisponível.' };

    // Nada é consultado nem gravado antes do código por SMS (decisão 11): sem
    // isso, o formulário dizia a um anônimo quais e-mails e documentos existem.
    const posse = await conferirTelefoneDoCadastro(telefone, dados.codigo);
    if (!posse.ok) {
      return { ok: false, message: posse.message, fieldErrors: { codigo: posse.message } };
    }

    const existente = await prisma.user.findUnique({
      where: { phone: telefone },
      select: { id: true },
    });

    // Conta existente não é alterada por formulário: antes, nome e papel eram
    // trocados e a loja nascia em nome de quem sabia o telefone (R3-060, R3-061).
    if (existente) return { ok: false, message: TELEFONE_JA_TEM_CONTA };

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
            : 'Já existe uma loja com este CPF/CNPJ. Entre no painel com seu e-mail e senha.',
      };
    }

    const emailEmUso = await prisma.user.findUnique({
      where: { email: dados.email },
      select: { id: true },
    });
    if (emailEmUso) {
      return {
        ok: false,
        message: 'Confira os campos destacados.',
        fieldErrors: { email: 'Este e-mail já tem conta. Use outro.' },
      };
    }

    // O usuário é criado junto, sem segundo cadastro, com o telefone já provado.
    const dadosDoUsuario = {
      phone: telefone,
      phoneVerified: new Date(),
      name: dados.responsavel,
      email: dados.email,
      passwordHash: gerarHashDeSenha(dados.senha),
      role: 'STORE_OWNER' as const,
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
    };

    // O segmento vem da categoria escolhida. Sem isto toda loja nascia como
    // "outros": o restaurante ficava fora do "Tô com fome" e no plano errado.
    const categoria = dados.categoryId
      ? await prisma.storeCategory.findFirst({
          where: { id: dados.categoryId, isActive: true },
          select: { segment: true },
        })
      : null;
    const segmento = categoria?.segment ?? 'OTHER';

    // Plano de entrada do segmento. Com a comissão desligada, o plano grátis
    // não renderia nada: loja nova entra no primeiro plano pago, com o teste
    // gratuito dele. Lojas que já estão no grátis ficam onde estão.
    const planoPadrao = await prisma.plan.findFirst({
      where: {
        isActive: true,
        OR: [{ segments: { has: segmento } }, { segments: { isEmpty: true } }],
        ...(COMISSAO_HABILITADA ? {} : { monthlyPriceCents: { gt: 0 } }),
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      select: { id: true, trialDays: true },
    });

    const { loja, usuario } = await prisma.$transaction(async (tx) => {
      const usuario = await tx.user.create({ data: dadosDoUsuario, select: { id: true } });
      const criada = await tx.store.create({
        data: {
          name: dados.nome,
          slug: await slugDisponivel(dados.nome),
          cityId: cidade.id,
          categoryId: dados.categoryId || null,
          segment: segmento,
          document: documento,
          documentType: documento.length === 11 ? 'CPF' : 'CNPJ',
          phone: telefone,
          whatsapp: telefone,
          email: dados.email,
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

      return { loja: criada, usuario };
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
        'Cadastro enviado! Avisamos no seu WhatsApp assim que a loja for aprovada. Depois é só entrar no painel com seu e-mail e senha.',
    };
  });
}
