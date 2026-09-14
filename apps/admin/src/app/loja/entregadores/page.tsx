import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { EquipeDeEntregadores } from './equipe';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entregadores' };

export default async function EntregadoresPage() {
  const { store, access } = await getStoreContext();

  const entregadores = await prisma.courier.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      vehicleType: true,
      isOnline: true,
      deliveryCount: true,
      ratingAverage: true,
      user: { select: { name: true, phone: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Entregadores da loja</h1>
        <p className="text-muted-foreground mt-1">
          Sua equipe própria. A frota da plataforma atende separado e não aparece aqui.
        </p>
      </header>

      <EquipeDeEntregadores
        entregadores={entregadores.map((entregador) => ({
          id: entregador.id,
          nome: entregador.user.name,
          telefone: entregador.user.phone,
          status: entregador.status,
          veiculo: entregador.vehicleType,
          online: entregador.isOnline,
          entregas: entregador.deliveryCount,
          nota: Number(entregador.ratingAverage),
        }))}
        podeEditar={access.staffRole === 'OWNER' || access.isPlatformAdmin}
      />
    </div>
  );
}
