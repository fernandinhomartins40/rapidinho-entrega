import Link from 'next/link';
import { prisma } from '@rapidinho/database';
import { formatPhoneBR } from '@rapidinho/shared';
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

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Auditoria' };

const POR_PAGINA = 50;

/** Rótulos das ações registradas. Ação sem rótulo aparece com o código cru. */
const ACAO_LABEL: Record<string, string> = {
  'store.approved': 'Aprovou loja',
  'store.rejected': 'Recusou loja',
  'store.suspended': 'Suspendeu loja',
  'store.reactivated': 'Reativou loja',
  'store.updated': 'Editou loja',
  'user.blocked': 'Bloqueou usuário',
  'user.unblocked': 'Desbloqueou usuário',
  'user.role_changed': 'Alterou papel',
  'courier.approved': 'Aprovou entregador',
  'courier.rejected': 'Recusou entregador',
  'plan.created': 'Criou plano',
  'plan.updated': 'Editou plano',
  'plan.deleted': 'Removeu plano',
  'city.created': 'Criou cidade',
  'city.updated': 'Editou cidade',
  'coupon.created': 'Criou cupom',
  'coupon.updated': 'Editou cupom',
  'boost.created': 'Alterou impulsionamento',
  'impersonation.started': 'Entrou como outro usuário',
  'impersonation.ended': 'Saiu do modo lojista',
  'payout.created': 'Gerou repasse',
  'payout.paid': 'Confirmou repasse',
  'lgpd.data_exported': 'Exportou dados (LGPD)',
  'lgpd.data_deleted': 'Excluiu dados (LGPD)',
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { pagina } = await searchParams;
  const paginaAtual = Math.max(1, Number(pagina ?? 1) || 1);

  const [registros, total, impersonations] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (paginaAtual - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { actor: { select: { name: true, phone: true } } },
    }),
    prisma.auditLog.count(),
    prisma.impersonationLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        impersonator: { select: { name: true } },
        impersonated: { select: { name: true } },
      },
    }),
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Auditoria</h1>
        <p className="text-muted-foreground">
          Todas as ações administrativas, com quem fez, quando e de onde.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Acessos como outro usuário</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quem entrou</TableHead>
                <TableHead>Como quem</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impersonations.length === 0 ? (
                <TableEmpty colSpan={5}>Nenhum acesso registrado.</TableEmpty>
              ) : (
                impersonations.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell className="font-medium">
                      {registro.impersonator.name ?? 'Administrador'}
                    </TableCell>
                    <TableCell>{registro.impersonated.name ?? 'Usuário'}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {registro.reason ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {registro.startedAt.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      {registro.endedAt ? (
                        <Badge variant="secondary">Encerrado</Badge>
                      ) : (
                        <Badge variant="warning">Em andamento</Badge>
                      )}
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
          <CardTitle>Histórico de ações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.length === 0 ? (
                <TableEmpty colSpan={5}>
                  Nenhuma ação registrada ainda. O log é preenchido conforme a equipe opera.
                </TableEmpty>
              ) : (
                registros.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {registro.createdAt.toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{registro.actor?.name ?? 'Sistema'}</span>
                      {registro.actor?.phone ? (
                        <span className="text-muted-foreground block text-xs">
                          {formatPhoneBR(registro.actor.phone)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{ACAO_LABEL[registro.action] ?? registro.action}</TableCell>
                    <TableCell className="text-sm">
                      {registro.entityType}
                      {registro.entityId ? (
                        <span className="text-muted-foreground block font-mono text-xs">
                          {registro.entityId.slice(0, 12)}…
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {registro.ipAddress ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPaginas > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Paginação">
          <span className="text-muted-foreground text-sm">
            Página {paginaAtual} de {totalPaginas} · {total} registros
          </span>
          <div className="flex gap-2">
            {paginaAtual > 1 ? (
              <Link
                href={`/admin/auditoria?pagina=${paginaAtual - 1}`}
                className="hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Anterior
              </Link>
            ) : null}
            {paginaAtual < totalPaginas ? (
              <Link
                href={`/admin/auditoria?pagina=${paginaAtual + 1}`}
                className="hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Próxima
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
