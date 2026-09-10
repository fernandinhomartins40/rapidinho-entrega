import { prisma } from '@rapidinho/database';
import { BOOST_PLACEMENT_LABEL, formatCents } from '@rapidinho/shared';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@rapidinho/ui';
import { PacoteDialog } from './pacote-dialog';
import { AlternarPacote } from './alternar-pacote';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Impulsionamento' };

export default async function ImpulsionamentoPage() {
  const agora = new Date();

  const [pacotes, ativos, receita] = await Promise.all([
    prisma.boostPackage.findMany({
      orderBy: [{ isActive: 'desc' }, { priority: 'desc' }],
      include: { _count: { select: { boosts: true } } },
    }),
    prisma.storeBoost.findMany({
      where: { status: 'ACTIVE', endsAt: { gt: agora } },
      orderBy: { endsAt: 'asc' },
      include: {
        store: { select: { id: true, name: true } },
        package: { select: { name: true, placement: true } },
      },
    }),
    prisma.storeBoost.aggregate({ _sum: { paidCents: true } }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Impulsionamento</h1>
          <p className="text-muted-foreground">
            Pacotes de destaque que o lojista compra, e o que está no ar agora.
          </p>
        </div>
        <PacoteDialog />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pacotes à venda</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pacote</TableHead>
                <TableHead>Posição</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pacotes.length === 0 ? (
                <TableEmpty colSpan={7}>
                  Nenhum pacote cadastrado. Sem pacote, o lojista não tem o que comprar.
                </TableEmpty>
              ) : (
                pacotes.map((pacote) => (
                  <TableRow key={pacote.id} className={pacote.isActive ? undefined : 'opacity-60'}>
                    <TableCell>
                      <span className="font-medium">{pacote.name}</span>
                      {pacote.description ? (
                        <span className="text-muted-foreground block text-xs">
                          {pacote.description}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{BOOST_PLACEMENT_LABEL[pacote.placement]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatCents(pacote.priceCents)}</TableCell>
                    <TableCell>{pacote.durationDays} dias</TableCell>
                    <TableCell>{pacote.priority}</TableCell>
                    <TableCell>{pacote._count.boosts}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <PacoteDialog
                          pacote={{
                            id: pacote.id,
                            name: pacote.name,
                            description: pacote.description,
                            placement: pacote.placement,
                            priceCents: pacote.priceCents,
                            durationDays: pacote.durationDays,
                            priority: pacote.priority,
                            isActive: pacote.isActive,
                          }}
                        />
                        <AlternarPacote id={pacote.id} nome={pacote.name} ativo={pacote.isActive} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>No ar agora</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead>Pacote</TableHead>
                <TableHead>Termina em</TableHead>
                <TableHead>Impressões</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>Conversões</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ativos.length === 0 ? (
                <TableEmpty colSpan={6}>Nenhum impulsionamento ativo no momento.</TableEmpty>
              ) : (
                ativos.map((boost) => {
                  const taxaClique =
                    boost.impressions > 0 ? (boost.clicks / boost.impressions) * 100 : 0;

                  return (
                    <TableRow key={boost.id}>
                      <TableCell className="font-medium">{boost.store.name}</TableCell>
                      <TableCell>{boost.package.name}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {boost.endsAt.toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>{boost.impressions}</TableCell>
                      <TableCell>
                        {boost.clicks}
                        <span className="text-muted-foreground text-xs">
                          {' '}
                          ({taxaClique.toFixed(1)}%)
                        </span>
                      </TableCell>
                      <TableCell>{boost.conversions}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Receita acumulada com impulsionamento:{' '}
        <strong className="text-foreground">{formatCents(receita._sum.paidCents ?? 0)}</strong>
      </p>
    </div>
  );
}
