import { prisma } from '@rapidinho/database';
import type { AddressInput } from '@rapidinho/shared';
import { falha, type Resultado } from './resultado';

/**
 * Endereços do cliente.
 *
 * Sem CEP e sem número são casos NORMAIS no interior, não exceções. O ponto de
 * referência é obrigatório mesmo sendo opcional no banco: é ele que faz o
 * entregador achar a casa quando o endereço é "Rua X, perto da igreja".
 */

class EnderecoAlheio extends Error {}

export const SELECT_ENDERECO = {
  id: true,
  label: true,
  street: true,
  number: true,
  complement: true,
  neighborhood: true,
  neighborhoodId: true,
  referencePoint: true,
  zipCode: true,
  latitude: true,
  longitude: true,
  isDefault: true,
  city: { select: { id: true, slug: true, name: true, state: true } },
} as const;

export async function listarEnderecos(userId: string, opcoes: { lojaId?: string } = {}) {
  return prisma.address.findMany({
    where: {
      userId,
      deletedAt: null,
      // No checkout, só os da cidade da loja: os de outra cidade não servem
      // para esta entrega e só confundem a escolha.
      ...(opcoes.lojaId ? { city: { stores: { some: { id: opcoes.lojaId } } } } : {}),
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: SELECT_ENDERECO,
  });
}

export async function salvarEnderecoDoCliente(
  userId: string,
  dados: AddressInput,
  id?: string | null,
): Promise<Resultado<{ id: string }>> {
  const cidade = await prisma.city.findFirst({
    where: { id: dados.cityId, isActive: true },
    select: { id: true },
  });

  if (!cidade) return falha('Cidade indisponível.');

  // Bairro de outra cidade daria a taxa da zona errada no modo por bairro.
  if (dados.neighborhoodId) {
    const bairro = await prisma.neighborhood.findFirst({
      where: { id: dados.neighborhoodId, cityId: dados.cityId },
      select: { id: true },
    });
    if (!bairro) return falha('Bairro não encontrado nesta cidade.', 'DADOS_INVALIDOS');
  }

  const campos = {
    label: dados.label ?? null,
    street: dados.street,
    number: dados.number ?? null,
    complement: dados.complement ?? null,
    neighborhood: dados.neighborhood,
    referencePoint: dados.referencePoint,
    zipCode: dados.zipCode || null,
    cityId: dados.cityId,
    // `undefined` deixa como está: o site não manda estes três e não pode
    // apagar o que o app gravou.
    neighborhoodId: dados.neighborhoodId,
    latitude: dados.latitude,
    longitude: dados.longitude,
  };

  try {
    const salvoId = await prisma.$transaction(async (tx) => {
      // Um padrão só: marcar o novo sem desmarcar o antigo deixaria dois, e o
      // checkout escolheria um deles ao acaso.
      if (dados.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      if (id) {
        const { count } = await tx.address.updateMany({
          where: { id, userId },
          data: { ...campos, isDefault: dados.isDefault },
        });
        // Dentro da transação: o id alheio não pode ter desmarcado o padrão.
        if (count === 0) throw new EnderecoAlheio();
        return id;
      }

      const total = await tx.address.count({ where: { userId } });
      const criado = await tx.address.create({
        data: {
          ...campos,
          userId,
          // O primeiro endereço é sempre o padrão: ninguém cadastra um endereço
          // para não usar.
          isDefault: dados.isDefault || total === 0,
        },
        select: { id: true },
      });
      return criado.id;
    });

    return { ok: true, message: 'Endereço salvo.', id: salvoId };
  } catch (erro) {
    if (erro instanceof EnderecoAlheio) return falha('Endereço não encontrado.', 'NAO_ENCONTRADO');
    throw erro;
  }
}

export async function definirEnderecoPadrao(userId: string, id: string): Promise<Resultado> {
  const endereco = await prisma.address.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!endereco) return falha('Endereço não encontrado.', 'NAO_ENCONTRADO');

  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id: endereco.id }, data: { isDefault: true } }),
  ]);

  return { ok: true, message: 'Endereço principal atualizado.' };
}

export async function excluirEnderecoDoCliente(userId: string, id: string): Promise<Resultado> {
  // Endereços aparecem em pedidos antigos, mas o pedido guarda um snapshot
  // próprio: dá para apagar sem perder o histórico.
  const { count } = await prisma.address.deleteMany({ where: { id, userId } });

  if (count === 0) return falha('Endereço não encontrado.', 'NAO_ENCONTRADO');

  return { ok: true, message: 'Endereço removido.' };
}
