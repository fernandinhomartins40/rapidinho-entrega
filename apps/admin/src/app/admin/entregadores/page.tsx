import Link from 'next/link';
import { prisma, type CourierStatus, type Prisma } from '@rapidinho/database';
import { formatDocument, formatPhoneBR, VEHICLE_TYPE_LABEL } from '@rapidinho/shared';
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@rapidinho/ui';
import { AcoesDoEntregador } from './acoes-do-entregador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Entregadores' };

const SITUACAO: Record<
  CourierStatus,
  { texto: string; variante: 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  ACTIVE: { texto: 'Ativo', variante: 'success' },
  PENDING_APPROVAL: { texto: 'Aguardando aprovação', variante: 'warning' },
  SUSPENDED: { texto: 'Suspenso', variante: 'destructive' },
  REJECTED: { texto: 'Recusado', variante: 'secondary' },
};

const FILTROS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'PENDING_APPROVAL', rotulo: 'Aguardando' },
  { valor: 'ACTIVE', rotulo: 'Ativos' },
  { valor: 'SUSPENDED', rotulo: 'Suspensos' },
] as const;

export default async function EntregadoresPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const statusValido =
    status && FILTROS.some((filtro) => filtro.valor === status)
      ? (status as CourierStatus)
      : undefined;

  const where: Prisma.CourierWhereInput = statusValido ? { status: statusValido } : {};

  const entregadores = await prisma.courier.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      user: { select: { name: true, phone: true } },
      city: { select: { name: true, state: true } },
      store: { select: { name: true } },
      documents: {
        select: { id: true, label: true, isApproved: true, file: { select: { mediumKey: true } } },
      },
      _count: { select: { deliveries: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Entregadores</h1>
        <p className="text-muted-foreground">
          Aprovação de cadastro e documentos. Entregador aprovado já pode aceitar corridas.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por situação">
        {FILTROS.map((filtro) => {
          const ativo = (status ?? '') === filtro.valor;
          return (
            <Link
              key={filtro.rotulo}
              href={
                filtro.valor ? `/admin/entregadores?status=${filtro.valor}` : '/admin/entregadores'
              }
              aria-current={ativo ? 'page' : undefined}
              className={
                ativo
                  ? 'bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold'
                  : 'hover:bg-accent rounded-full border px-4 py-2 text-sm font-medium'
              }
            >
              {filtro.rotulo}
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entregador</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Vínculo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Entregas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entregadores.length === 0 ? (
                <TableEmpty colSpan={7}>Nenhum entregador com esse filtro.</TableEmpty>
              ) : (
                entregadores.map((entregador) => {
                  const situacao = SITUACAO[entregador.status];
                  const pendentes = entregador.documents.filter(
                    (documento) => documento.isApproved == null,
                  ).length;

                  return (
                    <TableRow key={entregador.id}>
                      <TableCell>
                        <span className="font-medium">{entregador.user.name ?? 'Sem nome'}</span>
                        <span className="text-muted-foreground block text-xs">
                          {entregador.user.phone ? formatPhoneBR(entregador.user.phone) : '—'} ·{' '}
                          {formatDocument(entregador.document)}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {VEHICLE_TYPE_LABEL[entregador.vehicleType]}
                          {entregador.vehiclePlate ? ` · ${entregador.vehiclePlate}` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {entregador.city.name} — {entregador.city.state}
                      </TableCell>
                      <TableCell>
                        {entregador.store ? (
                          <span className="text-sm">{entregador.store.name}</span>
                        ) : (
                          <Badge variant="secondary">Frota da plataforma</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={situacao.variante}>{situacao.texto}</Badge>
                        {entregador.isOnline ? (
                          <span className="text-success mt-1 block text-xs font-medium">
                            Online agora
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entregador.documents.length === 0 ? (
                          <span className="text-muted-foreground">Nenhum enviado</span>
                        ) : pendentes > 0 ? (
                          <span className="text-warning font-medium">{pendentes} a revisar</span>
                        ) : (
                          <span className="text-muted-foreground">
                            {entregador.documents.length} conferidos
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{entregador._count.deliveries}</TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <AcoesDoEntregador
                            entregador={{
                              id: entregador.id,
                              nome: entregador.user.name ?? 'Entregador',
                              status: entregador.status,
                              documentos: entregador.documents.map((documento) => ({
                                id: documento.id,
                                label: documento.label,
                                aprovado: documento.isApproved,
                              })),
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
