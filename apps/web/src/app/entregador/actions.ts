'use server';

import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { notificarUsuario } from '@rapidinho/services';
import { isValidCPF, normalizePhoneBR } from '@rapidinho/shared';
import { runAction, type ActionResult } from '@/lib/action';

/**
 * Cadastro de entregador na frota da plataforma.
 *
 * Nasce em PENDING_APPROVAL: a plataforma responde por quem entra na casa do
 * cliente, então o documento é conferido antes de o cadastro valer.
 */

const cadastroSchema = z.object({
  nome: z.string().min(3, 'Informe seu nome completo').max(120),
  telefone: z.string().min(10, 'Informe o telefone'),
  documento: z.string().refine(isValidCPF, 'CPF inválido'),
  cityId: z.string().min(1, 'Escolha a cidade'),
  veiculo: z.enum(['MOTORCYCLE', 'BICYCLE', 'CAR', 'ON_FOOT']),
  placa: z.string().max(10).optional(),
  pixKey: z.string().max(140).optional(),
});

export async function cadastrarEntregador(
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

    const usuario = await prisma.user.upsert({
      where: { phone: telefone },
      update: { name: dados.nome },
      create: {
        phone: telefone,
        name: dados.nome,
        role: 'COURIER',
        acceptedTermsAt: new Date(),
        acceptedPrivacyAt: new Date(),
      },
      select: { id: true, role: true },
    });

    const jaCadastrado = await prisma.courier.findUnique({
      where: { userId: usuario.id },
      select: { status: true },
    });

    if (jaCadastrado) {
      return {
        ok: false,
        message:
          jaCadastrado.status === 'PENDING_APPROVAL'
            ? 'Você já tem um cadastro em análise. Avisamos assim que aprovarmos.'
            : 'Você já é entregador aqui. Entre com seu telefone.',
      };
    }

    const entregador = await prisma.courier.create({
      data: {
        userId: usuario.id,
        cityId: cidade.id,
        type: 'PLATFORM',
        // Aguardando conferência do documento: a plataforma responde por quem
        // entra na casa do cliente.
        status: 'PENDING_APPROVAL',
        document: dados.documento.replace(/\D/g, ''),
        documentType: 'CPF',
        vehicleType: dados.veiculo,
        vehiclePlate: dados.placa || null,
        pixKey: dados.pixKey || null,
      },
      select: { id: true },
    });

    if (usuario.role === 'CUSTOMER') {
      await prisma.user.update({ where: { id: usuario.id }, data: { role: 'COURIER' } });
    }

    await notificarUsuario({
      userId: usuario.id,
      title: 'Cadastro recebido!',
      body: 'Vamos conferir seus dados e avisamos por aqui quando estiver aprovado.',
      canais: ['WHATSAPP'],
      entity: { type: 'Courier', id: entregador.id },
    });

    return {
      ok: true,
      message:
        'Cadastro enviado! Avisamos no seu WhatsApp quando for aprovado. Depois é só entrar com este telefone.',
    };
  });
}
