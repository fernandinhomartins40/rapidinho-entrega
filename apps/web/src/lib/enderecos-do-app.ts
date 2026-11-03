import { z } from 'zod';
import { listarEnderecos, paraEnderecoDoApp } from '@rapidinho/services/regras';
import { addressSchema, type AddressInput } from '@rapidinho/shared';
import type { Endereco } from '@rapidinho/shared/app-api';
import { lerCorpo, naoEncontrado } from './api-do-app';

const entradaSchema = z.object({
  rotulo: z.string().optional(),
  rua: z.string(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string(),
  bairroId: z.string().optional(),
  referencia: z.string(),
  cep: z.string().optional(),
  cidadeId: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  padrao: z.boolean().optional(),
});

/** Nomes do contrato para os do schema, que segue sendo quem valida. */
export async function lerEndereco(request: Request): Promise<AddressInput> {
  const dados = await lerCorpo(request, entradaSchema);

  return addressSchema.parse({
    label: dados.rotulo,
    street: dados.rua,
    number: dados.numero,
    complement: dados.complemento,
    neighborhood: dados.bairro,
    neighborhoodId: dados.bairroId,
    referencePoint: dados.referencia,
    zipCode: dados.cep,
    cityId: dados.cidadeId,
    latitude: dados.latitude,
    longitude: dados.longitude,
    isDefault: dados.padrao,
  });
}

export async function enderecosDoApp(userId: string): Promise<Endereco[]> {
  return (await listarEnderecos(userId)).map(paraEnderecoDoApp);
}

export async function paraEnderecoSalvo(userId: string, id: string): Promise<Endereco> {
  const endereco = (await enderecosDoApp(userId)).find((candidato) => candidato.id === id);
  if (!endereco) throw naoEncontrado('Endereço não encontrado.');
  return endereco;
}
