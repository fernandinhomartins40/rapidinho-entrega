import Link from 'next/link';
import { prisma, type Prisma, type StoreStatus } from '@rapidinho/database';
import { formatDocument, formatPhoneBR, STORE_SEGMENT_LABEL } from '@rapidinho/shared';
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

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Lojas' };

const STATUS_LABEL: Record<
  StoreStatus,
  { texto: string; variante: 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  ACTIVE: { texto: 'Ativa', variante: 'success' },
  PENDING_APPROVAL: { texto: 'Aguardando aprovação', variante: 'warning' },
  SUSPENDED: { texto: 'Suspensa', variante: 'destructive' },
  REJECTED: { texto: 'Recusada', variante: 'secondary' },
};

const FILTROS = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'PENDING_APPROVAL', rotulo: 'Aguardando' },
  { valor: 'ACTIVE', rotulo: 'Ativas' },
  { valor: 'SUSPENDED', rotulo: 'Suspensas' },
  { valor: 'REJECTED', rotulo: 'Recusadas' },
] as const;

export default async function LojasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; busca?: string }>;
}) {
  const { status, busca } = await searchParams;

  const statusValido =
    FILTROS.some((filtro) => filtro.valor === status) && status
      ? (status as StoreStatus)
      : undefined;

  const where: Prisma.StoreWhereInput = {
    deletedAt: null,
    ...(statusValido ? { status: statusValido } : {}),
    ...(busca
      ? {
          OR: [
            { name: { contains: busca, mode: 'insensitive' } },
            { document: { contains: busca.replace(/\D/g, '') } },
          ],
        }
      : {}),
  };

  const lojas = await prisma.store.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    include: {
      city: { select: { name: true, state: true } },
      category: { select: { name: true } },
      _count: { select: { products: true, orders: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Lojas</h1>
        <p className="text-muted-foreground">
          Aprovar, suspender e acompanhar o cadastro de cada comércio.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filtrar por situação">
          {FILTROS.map((filtro) => {
            const ativo = (status ?? '') === filtro.valor;
            return (
              <Link
                key={filtro.rotulo}
                href={filtro.valor ? `/admin/lojas?status=${filtro.valor}` : '/admin/lojas'}
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

        <form className="ml-auto flex gap-2" action="/admin/lojas">
          {statusValido ? <input type="hidden" name="status" value={statusValido} /> : null}
          <input
            type="search"
            name="busca"
            defaultValue={busca}
            placeholder="Buscar por nome ou CNPJ"
            aria-label="Buscar loja"
            className="border-input bg-background h-11 rounded-lg border-2 px-3"
          />
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Pedidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lojas.length === 0 ? (
                <TableEmpty colSpan={6}>
                  {busca || statusValido
                    ? 'Nenhuma loja encontrada com esse filtro.'
                    : 'Nenhuma loja cadastrada ainda.'}
                </TableEmpty>
              ) : (
                lojas.map((loja) => {
                  const situacao = STATUS_LABEL[loja.status];

                  return (
                    <TableRow key={loja.id}>
                      <TableCell>
                        <Link
                          href={`/admin/lojas/${loja.id}`}
                          className="font-medium hover:underline"
                        >
                          {loja.name}
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          {loja.category?.name ?? STORE_SEGMENT_LABEL[loja.segment]} ·{' '}
                          {formatPhoneBR(loja.phone)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {loja.city.name} — {loja.city.state}
                      </TableCell>
                      <TableCell>
                        <Badge variant={situacao.variante}>{situacao.texto}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDocument(loja.document)}
                      </TableCell>
                      <TableCell>{loja._count.products}</TableCell>
                      <TableCell>{loja._count.orders}</TableCell>
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
