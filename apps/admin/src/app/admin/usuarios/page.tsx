import Link from 'next/link';
import { prisma, type Prisma } from '@rapidinho/database';
import { formatPhoneBR, USER_ROLE_LABEL, type UserRole } from '@rapidinho/shared';
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
import { AcoesDoUsuario } from './acoes-do-usuario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Usuários' };

const FILTROS = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'CUSTOMER', rotulo: 'Clientes' },
  { valor: 'STORE_OWNER', rotulo: 'Lojistas' },
  { valor: 'COURIER', rotulo: 'Entregadores' },
  { valor: 'ADMIN', rotulo: 'Equipe' },
] as const;

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ papel?: string; busca?: string }>;
}) {
  const { papel, busca } = await searchParams;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(papel === 'ADMIN'
      ? { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }
      : papel
        ? { role: papel as UserRole }
        : {}),
    ...(busca
      ? {
          OR: [
            { name: { contains: busca, mode: 'insensitive' } },
            { phone: { contains: busca.replace(/\D/g, '') } },
            { email: { contains: busca, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const usuarios = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { orders: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">
          Contas de clientes, lojistas, entregadores e equipe da plataforma.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filtrar por papel">
          {FILTROS.map((filtro) => {
            const ativo = (papel ?? '') === filtro.valor;
            return (
              <Link
                key={filtro.rotulo}
                href={filtro.valor ? `/admin/usuarios?papel=${filtro.valor}` : '/admin/usuarios'}
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

        <form className="ml-auto" action="/admin/usuarios">
          {papel ? <input type="hidden" name="papel" value={papel} /> : null}
          <input
            type="search"
            name="busca"
            defaultValue={busca}
            placeholder="Nome, telefone ou e-mail"
            aria-label="Buscar usuário"
            className="border-input bg-background h-11 rounded-lg border-2 px-3"
          />
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.length === 0 ? (
                <TableEmpty colSpan={6}>Nenhum usuário encontrado com esse filtro.</TableEmpty>
              ) : (
                usuarios.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell>
                      <span className="font-medium">{usuario.name ?? 'Sem nome'}</span>
                      <span className="text-muted-foreground block text-xs">
                        {usuario.phone ? formatPhoneBR(usuario.phone) : (usuario.email ?? '—')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{USER_ROLE_LABEL[usuario.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      {usuario.status === 'ACTIVE' ? (
                        <Badge variant="success">Ativo</Badge>
                      ) : (
                        <Badge variant="destructive">Bloqueado</Badge>
                      )}
                    </TableCell>
                    <TableCell>{usuario._count.orders}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {usuario.lastLoginAt
                        ? usuario.lastLoginAt.toLocaleDateString('pt-BR')
                        : 'Nunca entrou'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <AcoesDoUsuario
                          usuario={{
                            id: usuario.id,
                            nome: usuario.name,
                            papel: usuario.role,
                            bloqueado: usuario.status !== 'ACTIVE',
                          }}
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
