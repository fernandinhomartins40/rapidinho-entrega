'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@rapidinho/database';
import { capturarErro, clientIpFromHeaders, consumeRateLimit } from '@rapidinho/services';
import { normalizePhoneBR, slugify } from '@rapidinho/shared';
import { UFS } from '@/lib/ufs';

/**
 * "Traga o Rapidinho para minha cidade".
 *
 * Cidade pequena não entra no radar das grandes plataformas porque ninguém
 * sabe se ali tem demanda. Aqui a demanda se declara: quem quer pedir, quem
 * quer vender e quem quer entregar deixam o WhatsApp, e a cidade que junta
 * os três é a próxima a abrir.
 */

const entradaSchema = z.object({
  cidade: z.string().trim().min(2, 'Qual é a sua cidade?').max(80),
  uf: z.enum(UFS, { message: 'Escolha o estado' }),
  perfil: z.enum(['CUSTOMER', 'STORE', 'COURIER']),
  nome: z.string().trim().min(2, 'Como te chamam?').max(60),
  whatsapp: z.string().trim().min(8, 'Informe o WhatsApp'),
  negocio: z.string().trim().max(80).optional(),
});

export type EstadoDoPedidoDeCidade = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Quantas pessoas já pediram esta cidade, contando com esta. */
  naFila?: number;
  cidade?: string;
};

export async function pedirMinhaCidade(
  _estado: EstadoDoPedidoDeCidade,
  formData: FormData,
): Promise<EstadoDoPedidoDeCidade> {
  const leitura = entradaSchema.safeParse({
    cidade: formData.get('cidade'),
    uf: formData.get('uf'),
    perfil: formData.get('perfil'),
    nome: formData.get('nome'),
    whatsapp: formData.get('whatsapp'),
    negocio: formData.get('negocio') || undefined,
  });

  if (!leitura.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of leitura.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: 'Confira os campos destacados.', fieldErrors };
  }

  const dados = leitura.data;
  const telefone = normalizePhoneBR(dados.whatsapp);
  if (!telefone) {
    return { ok: false, fieldErrors: { whatsapp: 'WhatsApp inválido' } };
  }

  try {
    // Formulário público: sem limite, vira porta de spam.
    const ip = clientIpFromHeaders(await headers());
    const limite = await consumeRateLimit(`minha-cidade:${ip}`, 8, 3600);
    if (!limite.allowed) {
      return { ok: false, message: 'Muitos envios daqui. Tente de novo mais tarde.' };
    }

    const cityKey = `${slugify(dados.cidade)}-${dados.uf.toLowerCase()}`;

    // Mesma pessoa, mesma cidade, mesmo perfil: atualiza em vez de duplicar.
    await prisma.cityInterest.upsert({
      where: {
        cityKey_phone_profile: { cityKey, phone: telefone, profile: dados.perfil },
      },
      update: { name: dados.nome, businessName: dados.negocio ?? null },
      create: {
        cityKey,
        cityName: dados.cidade,
        state: dados.uf,
        profile: dados.perfil,
        name: dados.nome,
        phone: telefone,
        businessName: dados.negocio ?? null,
      },
    });

    const naFila = await prisma.cityInterest.count({ where: { cityKey } });
    return { ok: true, naFila, cidade: `${dados.cidade}/${dados.uf}` };
  } catch (error) {
    void capturarErro(error, { origem: 'minha-cidade' });
    return { ok: false, message: 'Não foi possível enviar agora. Tente de novo.' };
  }
}
