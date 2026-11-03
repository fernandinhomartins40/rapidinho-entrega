'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  definirEnderecoPadrao,
  excluirEnderecoDoCliente,
  salvarEnderecoDoCliente,
} from '@rapidinho/services/regras';
import { addressSchema } from '@rapidinho/shared';
import { runAuthedAction, type ActionResult } from '@/lib/action';

/**
 * Endereços do cliente.
 *
 * Sem CEP e sem número são casos NORMAIS no interior, não exceções — só rua,
 * bairro e ponto de referência são exigidos. O ponto de referência é
 * obrigatório aqui mesmo sendo opcional no banco: é ele que faz o entregador
 * achar a casa quando o endereço é "Rua X, perto da igreja".
 */

export async function salvarEndereco(
  _anterior: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const id = formData.get('id');

    const dados = addressSchema.parse({
      label: formData.get('label') || undefined,
      street: formData.get('street'),
      number: formData.get('number') || undefined,
      complement: formData.get('complement') || undefined,
      neighborhood: formData.get('neighborhood'),
      referencePoint: formData.get('referencePoint'),
      zipCode: formData.get('zipCode') || undefined,
      cityId: formData.get('cityId'),
      isDefault: formData.get('isDefault') === 'on',
    });

    const resultado = await salvarEnderecoDoCliente(
      user.id,
      dados,
      typeof id === 'string' ? id : null,
    );

    if (resultado.ok) {
      revalidatePath('/enderecos');
      revalidatePath('/checkout');
    }

    return resultado;
  });
}

const idSchema = z.object({ id: z.string() });

export async function definirPadrao(entrada: unknown): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const { id } = idSchema.parse(entrada);

    const resultado = await definirEnderecoPadrao(user.id, id);

    if (resultado.ok) {
      revalidatePath('/enderecos');
      revalidatePath('/checkout');
    }

    return resultado;
  });
}

export async function excluirEndereco(id: string): Promise<ActionResult> {
  return runAuthedAction(async (user) => {
    const resultado = await excluirEnderecoDoCliente(user.id, id);
    if (resultado.ok) revalidatePath('/enderecos');
    return resultado;
  });
}
