import { prisma } from '@rapidinho/database';
import { formatCents } from '@rapidinho/shared';
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
import { CidadeDialog } from './cidade-dialog';
import { AlternarCidade } from './alternar-cidade';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cidades' };

export default async function CidadesPage() {
  const cidades = await prisma.city.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      _count: {
        select: {
          stores: { where: { deletedAt: null } },
          neighborhoods: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cidades</h1>
          <p className="text-muted-foreground">
            Abrir uma cidade a torna visível no app. Fechar não apaga as lojas.
          </p>
        </div>
        <CidadeDialog />
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cidade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Lojas</TableHead>
                <TableHead>Bairros</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Taxa padrão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cidades.length === 0 ? (
                <TableEmpty colSpan={7}>
                  Nenhuma cidade cadastrada. Comece cadastrando a primeira.
                </TableEmpty>
              ) : (
                cidades.map((cidade) => (
                  <TableRow key={cidade.id}>
                    <TableCell>
                      <span className="font-medium">
                        {cidade.name} — {cidade.state}
                      </span>
                      <span className="text-muted-foreground block text-xs">/{cidade.slug}</span>
                    </TableCell>
                    <TableCell>
                      {cidade.isActive ? (
                        <Badge variant="success">Aberta</Badge>
                      ) : (
                        <Badge variant="secondary">Fechada</Badge>
                      )}
                    </TableCell>
                    <TableCell>{cidade._count.stores}</TableCell>
                    <TableCell>{cidade._count.neighborhoods}</TableCell>
                    <TableCell>{Number(cidade.defaultCommissionRate).toFixed(1)}%</TableCell>
                    <TableCell>{formatCents(cidade.defaultDeliveryFeeCents)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <CidadeDialog
                          cidade={{
                            id: cidade.id,
                            name: cidade.name,
                            state: cidade.state,
                            ibgeCode: cidade.ibgeCode,
                            isActive: cidade.isActive,
                            latitude: cidade.latitude,
                            longitude: cidade.longitude,
                            serviceRadiusMeters: cidade.serviceRadiusMeters,
                            defaultCommissionRate: Number(cidade.defaultCommissionRate),
                            defaultDeliveryFeeCents: cidade.defaultDeliveryFeeCents,
                            defaultPricePerKmCents: cidade.defaultPricePerKmCents,
                          }}
                        />
                        <AlternarCidade
                          id={cidade.id}
                          nome={cidade.name}
                          ativa={cidade.isActive}
                          lojas={cidade._count.stores}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
