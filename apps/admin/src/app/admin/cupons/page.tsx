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
import { CupomDialog } from './cupom-dialog';
import { AlternarCupom } from './alternar-cupom';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cupons' };

function descreverDesconto(cupom: {
  discountType: string;
  discountValue: number;
  maxDiscountCents: number | null;
}) {
  if (cupom.discountType === 'FREE_DELIVERY') return 'Frete grátis';
  if (cupom.discountType === 'PERCENTAGE') {
    const teto = cupom.maxDiscountCents ? ` (até ${formatCents(cupom.maxDiscountCents)})` : '';
    return `${cupom.discountValue}%${teto}`;
  }
  return formatCents(cupom.discountValue);
}

export default async function CuponsPage() {
  const [cupons, cidades] = await Promise.all([
    prisma.coupon.findMany({
      where: { scope: 'PLATFORM' },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        city: { select: { name: true, state: true } },
        _count: { select: { redemptions: true } },
      },
    }),
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, state: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cupons da plataforma</h1>
          <p className="text-muted-foreground">
            O desconto destes cupons sai da plataforma, não do lojista.
          </p>
        </div>
        <CupomDialog cidades={cidades} />
      </header>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Regras</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cupons.length === 0 ? (
                <TableEmpty colSpan={7}>
                  Nenhum cupom da plataforma. Crie um para campanhas de aquisição.
                </TableEmpty>
              ) : (
                cupons.map((cupom) => (
                  <TableRow key={cupom.id} className={cupom.isActive ? undefined : 'opacity-60'}>
                    <TableCell>
                      <span className="font-mono font-semibold">{cupom.code}</span>
                      {cupom.description ? (
                        <span className="text-muted-foreground block text-xs">
                          {cupom.description}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {descreverDesconto(cupom)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {cupom.minOrderCents > 0 ? (
                        <span className="block">Mínimo {formatCents(cupom.minOrderCents)}</span>
                      ) : null}
                      {cupom.firstOrderOnly ? <span className="block">Só no 1º pedido</span> : null}
                      {cupom.usagePerUser ? (
                        <span className="text-muted-foreground block text-xs">
                          {cupom.usagePerUser}x por cliente
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {cupom.city ? `${cupom.city.name} — ${cupom.city.state}` : 'Todas'}
                    </TableCell>
                    <TableCell>
                      {cupom._count.redemptions}
                      {cupom.usageLimit ? (
                        <span className="text-muted-foreground text-xs"> / {cupom.usageLimit}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {cupom.endsAt ? cupom.endsAt.toLocaleDateString('pt-BR') : 'Sem prazo'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {cupom.isActive ? (
                          <Badge variant="success">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                        <AlternarCupom id={cupom.id} codigo={cupom.code} ativo={cupom.isActive} />
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
