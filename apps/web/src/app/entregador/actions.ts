'use server';

import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { notificarUsuario } from '@rapidinho/services';
import { isValidCPF, normalizePhoneBR } from '@rapidinho/shared';
import { runAction, type ActionResult } from '@/lib/action';
import { conferirTelefoneDoCadastro, TELEFONE_JA_TEM_CONTA } from '@/lib/telefone-confirmado';

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
  codigo: z.string().trim().default(''),
});

export async function cadastrarEntregador(
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

    const cidade = await prisma.city.findFirst({
      where: { id: dados.cityId, isActive: true },
      select: { id: true },
    });

    if (!cidade) return { ok: false, message: 'Cidade indisponível.' };

    // Só grava com o telefone confirmado por SMS (decisão 11).
    const posse = await conferirTelefoneDoCadastro(telefone, dados.codigo);
    if (!posse.ok) {
      return { ok: false, message: posse.message, fieldErrors: { codigo: posse.message } };
    }

    // Formulário público nunca escreve em conta que já existe: nome, papel e
    // Pix eram trocados por quem soubesse o telefone (R3-018, R3-061).
    const existente = await prisma.user.findUnique({
      where: { phone: telefone },
      select: { id: true },
    });
    if (existente) return { ok: false, message: TELEFONE_JA_TEM_CONTA };

    const usuario = await prisma.user.create({
      data: {
        phone: telefone,
        phoneVerified: new Date(),
        name: dados.nome,
        role: 'COURIER',
        acceptedTermsAt: new Date(),
        acceptedPrivacyAt: new Date(),
      },
      select: { id: true },
    });

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
