import { notFound, redirect } from 'next/navigation';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { carregarCarrinho } from '@/lib/cart';
import { calcularCheckout } from '@/lib/checkout';
import { FormularioDeCheckout } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Finalizar pedido' };

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ tipo?: string; endereco?: string; cupom?: string }>;
}) {
  const { storeId } = await params;
  const busca = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?destino=/checkout/${storeId}`);

  const [carrinho, loja, enderecos] = await Promise.all([
    carregarCarrinho(user.id, storeId),
    prisma.store.findFirst({
      where: { id: storeId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        cityId: true,
        acceptsPickup: true,
        acceptsPix: true,
        acceptsCardOnline: true,
        acceptsCashOnDelivery: true,
        acceptsCardOnDelivery: true,
        avgPrepTimeMinutes: true,
        avgDeliveryTimeMinutes: true,
        city: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.address.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        label: true,
        street: true,
        number: true,
        complement: true,
        neighborhood: true,
        referencePoint: true,
        isDefault: true,
      },
    }),
  ]);

  if (!loja) notFound();
  if (!carrinho || carrinho.itens.length === 0) redirect('/carrinho');

  const tipo = busca.tipo === 'PICKUP' && loja.acceptsPickup ? 'PICKUP' : 'DELIVERY';
  const enderecoEscolhido =
    busca.endereco ??
    enderecos.find((endereco) => endereco.isDefault)?.id ??
    enderecos[0]?.id ??
    null;

  const resumo = await calcularCheckout({
    carrinho,
    userId: user.id,
    cityId: loja.cityId,
    tipo,
    addressId: enderecoEscolhido,
    couponCode: busca.cupom ?? null,
  });

  return (
    <FormularioDeCheckout
      carrinho={carrinho}
      loja={{
        id: loja.id,
        nome: loja.name,
        slug: loja.slug,
        aceitaRetirada: loja.acceptsPickup,
        pagamentos: {
          PIX: loja.acceptsPix,
          CREDIT_CARD_ONLINE: loja.acceptsCardOnline,
          CASH_ON_DELIVERY: loja.acceptsCashOnDelivery,
          CARD_ON_DELIVERY: loja.acceptsCardOnDelivery,
        },
        tempoMin: loja.avgPrepTimeMinutes + loja.avgDeliveryTimeMinutes,
        cidadeSlug: loja.city.slug,
        cidadeId: loja.city.id,
      }}
      enderecos={enderecos}
      resumo={resumo}
      tipo={tipo}
      enderecoEscolhido={enderecoEscolhido}
      cupom={busca.cupom ?? ''}
      cliente={{ nome: user.name, telefone: user.phone }}
    />
  );
}
