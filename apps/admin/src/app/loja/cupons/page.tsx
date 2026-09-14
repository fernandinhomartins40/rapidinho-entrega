import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { GerenciadorDeCupons } from './gerenciador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cupons' };

export default async function CuponsPage() {
  const { store } = await getStoreContext();

  const cupons = await prisma.coupon.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      code: true,
      description: true,
      discountType: true,
      discountValue: true,
      minOrderCents: true,
      maxDiscountCents: true,
      usageLimit: true,
      usageCount: true,
      firstOrderOnly: true,
      endsAt: true,
      isActive: true,
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Cupons da loja</h1>
        <p className="text-muted-foreground mt-1">
          O desconto sai do seu faturamento. Cupons da plataforma são outra coisa e não aparecem
          aqui.
        </p>
      </header>

      <GerenciadorDeCupons
        cupons={cupons.map((cupom) => ({
          ...cupom,
          endsAt: cupom.endsAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
