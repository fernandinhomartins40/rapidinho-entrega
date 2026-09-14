import { prisma } from '@rapidinho/database';
import { getStoreContext } from '@/lib/store-context';
import { EditorDeHorarios } from './editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Horários' };

export default async function HorariosPage() {
  const { store, abertura } = await getStoreContext();

  const [horarios, fechamentos] = await Promise.all([
    prisma.storeHour.findMany({
      where: { storeId: store.id },
      orderBy: { weekday: 'asc' },
      select: { weekday: true, opensAt: true, closesAt: true, isActive: true },
    }),
    prisma.storeClosure.findMany({
      where: { storeId: store.id, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true, reason: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Horários</h1>
        <p className="text-muted-foreground mt-1">
          Enquanto a loja está fechada, ela aparece no app mas não aceita pedidos.
        </p>
      </header>

      <EditorDeHorarios
        horarios={horarios}
        fechamentos={fechamentos.map((fechamento) => ({
          id: fechamento.id,
          startsAt: fechamento.startsAt.toISOString(),
          endsAt: fechamento.endsAt.toISOString(),
          reason: fechamento.reason,
        }))}
        pausa={{
          ate: store.isPausedUntil?.toISOString() ?? null,
          motivo: store.pauseReason,
        }}
        abertaAgora={abertura.isOpen}
        motivoDoFechamento={abertura.reason ?? null}
      />
    </div>
  );
}
