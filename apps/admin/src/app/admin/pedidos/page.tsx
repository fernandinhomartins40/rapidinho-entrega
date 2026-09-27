import Link from 'next/link';
import { AlertTriangle, Clock, ShoppingBag, TrendingUp, XCircle } from 'lucide-react';
import { prisma, type Prisma } from '@rapidinho/database';
import {
  formatCents,
  formatPhoneBR,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  type OrderStatus,
  inicioDoDia,
} from '@rapidinho/shared';
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
import { Indicador } from '@/components/indicador';
import {
  dataHora,
  estaAtrasado,
  STATUS_EM_ANDAMENTO,
  tempoDecorrido,
  VARIANTE_DO_STATUS,
} from './formatos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedidos' };

const POR_PAGINA = 50;

const ABAS = [
  { valor: 'andamento', rotulo: 'Em andamento' },
  { valor: 'atrasados', rotulo: 'Atrasados' },
  { valor: 'entregues', rotulo: 'Entregues' },
  { valor: 'cancelados', rotulo: 'Cancelados' },
  { valor: 'todos', rotulo: 'Todos' },
] as const;
type Aba = (typeof ABAS)[number]['valor'];

const PERIODOS = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
  { valor: 'tudo', rotulo: 'Tudo' },
] as const;
type Periodo = (typeof PERIODOS)[number]['valor'];

/** Meia-noite de hoje em Brasília. */
function inicioDeHoje(): Date {
  return inicioDoDia();
}

function inicioDoPeriodo(periodo: Periodo): Date | null {
  const hoje = inicioDeHoje();
  if (periodo === 'hoje') return hoje;
  if (periodo === '7d') return new Date(hoje.getTime() - 6 * 86_400_000);
  if (periodo === '30d') return new Date(hoje.getTime() - 29 * 86_400_000);
  return null;
}

async function indicadoresDeHoje() {
  const desde = inicioDeHoje();
  const [total, andamento, cancelados, faturamento, ativos] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: desde } } }),
    prisma.order.count({ where: { status: { in: STATUS_EM_ANDAMENTO } } }),
    prisma.order.count({
      where: { createdAt: { gte: desde }, status: { in: ['CANCELLED', 'REJECTED'] } },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: desde }, status: 'DELIVERED' },
      _sum: { totalCents: true, commissionCents: true },
    }),
    prisma.order.findMany({
      where: { status: { in: STATUS_EM_ANDAMENTO } },
      select: { status: true, createdAt: true, estimatedPrepMinutes: true },
    }),
  ]);

  return {
    total,
    andamento,
    atrasados: ativos.filter((pedido) => estaAtrasado(pedido)).length,
    cancelados,
    faturamentoCents: faturamento._sum.totalCents ?? 0,
    comissaoCents: faturamento._sum.commissionCents ?? 0,
  };
}

function montarLink(
  atual: Record<string, string | undefined>,
  mudar: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries({ ...atual, ...mudar })) {
    if (valor) params.set(chave, valor);
  }
  const texto = params.toString();
  return texto ? `/admin/pedidos?${texto}` : '/admin/pedidos';
}

export default async function PedidosDaPlataformaPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    periodo?: string;
    busca?: string;
    cidade?: string;
    loja?: string;
    pagina?: string;
  }>;
}) {
  const params = await searchParams;
  const aba: Aba = ABAS.some((item) => item.valor === params.aba)
    ? (params.aba as Aba)
    : 'andamento';
  const periodo: Periodo = PERIODOS.some((item) => item.valor === params.periodo)
    ? (params.periodo as Periodo)
    : '7d';
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const busca = params.busca?.trim();
  // Em andamento é por definição agora: o período não se aplica.
  const usaPeriodo = aba !== 'andamento' && aba !== 'atrasados';
  const desde = usaPeriodo ? inicioDoPeriodo(periodo) : null;
  const digitos = busca?.replace(/\D/g, '') ?? '';

  const where: Prisma.OrderWhereInput = {
    ...(aba === 'andamento' || aba === 'atrasados' ? { status: { in: STATUS_EM_ANDAMENTO } } : {}),
    ...(aba === 'entregues' ? { status: 'DELIVERED' } : {}),
    ...(aba === 'cancelados' ? { status: { in: ['CANCELLED', 'REJECTED'] } } : {}),
    ...(desde ? { createdAt: { gte: desde } } : {}),
    ...(params.cidade ? { cityId: params.cidade } : {}),
    ...(params.loja ? { storeId: params.loja } : {}),
    ...(busca
      ? {
          OR: [
            ...(digitos ? [{ number: { contains: digitos } }] : []),
            ...(digitos.length >= 4 ? [{ customerPhone: { contains: digitos } }] : []),
            { customerName: { contains: busca, mode: 'insensitive' as const } },
            { store: { name: { contains: busca, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const selecao = {
    id: true,
    number: true,
    status: true,
    type: true,
    createdAt: true,
    estimatedPrepMinutes: true,
    customerName: true,
    customerPhone: true,
    totalCents: true,
    store: { select: { id: true, name: true } },
    city: { select: { name: true } },
    payment: { select: { method: true } },
  } satisfies Prisma.OrderSelect;

  // "Atrasados" depende do preparo de cada loja, que o banco não compara
  // sozinho; como só entram pedidos em andamento, filtrar aqui é barato.
  const [linhas, total, cidades, lojaFiltrada, indicadores] = await Promise.all([
    aba === 'atrasados'
      ? prisma.order
          .findMany({ where, orderBy: { createdAt: 'asc' }, select: selecao })
          .then((pedidos) => pedidos.filter((pedido) => estaAtrasado(pedido)))
      : prisma.order.findMany({
          where,
          // Em andamento: o mais antigo primeiro, que é o que está esperando mais.
          orderBy: { createdAt: aba === 'andamento' ? 'asc' : 'desc' },
          skip: (pagina - 1) * POR_PAGINA,
          take: POR_PAGINA,
          select: selecao,
        }),
    aba === 'atrasados' ? Promise.resolve(0) : prisma.order.count({ where }),
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    params.loja
      ? prisma.store.findUnique({ where: { id: params.loja }, select: { name: true } })
      : Promise.resolve(null),
    indicadoresDeHoje(),
  ]);

  const totalDeLinhas = aba === 'atrasados' ? linhas.length : total;
  const paginas = Math.max(1, Math.ceil(totalDeLinhas / POR_PAGINA));
  const atual = {
    aba,
    periodo: usaPeriodo ? periodo : undefined,
    busca,
    cidade: params.cidade,
    loja: params.loja,
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-muted-foreground">
          Todos os pedidos da plataforma, de todas as lojas. Os números do topo são de hoje.
        </p>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="Indicadores de hoje"
      >
        <Indicador titulo="Pedidos hoje" valor={String(indicadores.total)} icone={ShoppingBag} />
        <Indicador titulo="Em andamento" valor={String(indicadores.andamento)} icone={Clock} />
        <Indicador
          titulo="Atrasados"
          valor={String(indicadores.atrasados)}
          icone={AlertTriangle}
          detalhe="Passaram do preparo previsto + 30 min"
        />
        <Indicador
          titulo="Cancelados hoje"
          valor={String(indicadores.cancelados)}
          icone={XCircle}
        />
        <Indicador
          titulo="Faturamento hoje"
          valor={formatCents(indicadores.faturamentoCents)}
          icone={TrendingUp}
          detalhe={`Comissão: ${formatCents(indicadores.comissaoCents)}`}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Filtrar por situação">
          {ABAS.map((item) => {
            const ativo = aba === item.valor;
            return (
              <Link
                key={item.valor}
                href={montarLink(atual, { aba: item.valor, pagina: undefined })}
                aria-current={ativo ? 'page' : undefined}
                className={
                  ativo
                    ? 'bg-primary text-primary-foreground rounded-full px-4 py-2 text-sm font-semibold'
                    : 'hover:bg-accent rounded-full border px-4 py-2 text-sm font-medium'
                }
              >
                {item.rotulo}
                {item.valor === 'atrasados' && indicadores.atrasados > 0 ? (
                  <span className="bg-destructive text-destructive-foreground ml-2 rounded-full px-2 text-xs">
                    {indicadores.atrasados}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <form className="ml-auto flex flex-wrap items-center gap-2" action="/admin/pedidos">
          <input type="hidden" name="aba" value={aba} />
          {params.loja ? <input type="hidden" name="loja" value={params.loja} /> : null}
          {usaPeriodo ? (
            <select
              name="periodo"
              defaultValue={periodo}
              aria-label="Período"
              className="border-input bg-background h-11 rounded-lg border-2 px-3"
            >
              {PERIODOS.map((item) => (
                <option key={item.valor} value={item.valor}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          ) : null}
          {cidades.length > 1 ? (
            <select
              name="cidade"
              defaultValue={params.cidade ?? ''}
              aria-label="Cidade"
              className="border-input bg-background h-11 rounded-lg border-2 px-3"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((cidade) => (
                <option key={cidade.id} value={cidade.id}>
                  {cidade.name}
                </option>
              ))}
            </select>
          ) : null}
          <input
            type="search"
            name="busca"
            defaultValue={busca}
            placeholder="Nº do pedido, cliente, telefone ou loja"
            aria-label="Buscar pedido"
            className="border-input bg-background h-11 w-72 max-w-full rounded-lg border-2 px-3"
          />
          <button
            type="submit"
            className="bg-primary text-primary-foreground h-11 rounded-lg px-4 text-sm font-semibold"
          >
            Filtrar
          </button>
        </form>
      </div>

      {lojaFiltrada ? (
        <p className="text-sm">
          Mostrando só os pedidos de <strong>{lojaFiltrada.name}</strong>.{' '}
          <Link
            href={montarLink(atual, { loja: undefined, pagina: undefined })}
            className="underline"
          >
            Ver de todas as lojas
          </Link>
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Feito</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 ? (
                <TableEmpty colSpan={6}>
                  {aba === 'andamento'
                    ? 'Nenhum pedido em andamento agora.'
                    : aba === 'atrasados'
                      ? 'Nenhum pedido atrasado. Tudo em dia!'
                      : 'Nenhum pedido encontrado com esse filtro.'}
                </TableEmpty>
              ) : (
                linhas.map((pedido) => {
                  const atrasado = estaAtrasado(pedido);
                  const status = pedido.status as OrderStatus;
                  return (
                    <TableRow key={pedido.id}>
                      <TableCell>
                        <Link
                          href={`/admin/pedidos/${pedido.id}`}
                          className="text-primary-text font-semibold hover:underline"
                        >
                          #{pedido.number}
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          {pedido.type === 'PICKUP' ? 'Retirada' : 'Entrega'}
                          {cidades.length > 1 ? ` · ${pedido.city.name}` : ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={montarLink(atual, { loja: pedido.store.id, pagina: undefined })}
                          className="hover:underline"
                          title="Ver só os pedidos desta loja"
                        >
                          {pedido.store.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{pedido.customerName}</span>
                        <span className="text-muted-foreground block text-xs">
                          {formatPhoneBR(pedido.customerPhone)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatCents(pedido.totalCents)}
                        <span className="text-muted-foreground block text-xs">
                          {pedido.payment ? PAYMENT_METHOD_LABEL[pedido.payment.method] : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={VARIANTE_DO_STATUS[status]}>
                          {ORDER_STATUS_LABEL[status]}
                        </Badge>
                        {atrasado ? (
                          <Badge variant="destructive" className="ml-1">
                            Atrasado
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {dataHora(pedido.createdAt)}
                        <span
                          className={`block text-xs ${atrasado ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
                        >
                          {tempoDecorrido(pedido.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {aba !== 'atrasados' && paginas > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Paginação">
          <span className="text-muted-foreground">
            {totalDeLinhas} pedidos · página {pagina} de {paginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 ? (
              <Link
                href={montarLink(atual, { pagina: String(pagina - 1) })}
                className="hover:bg-accent rounded-lg border px-4 py-2 font-medium"
              >
                Anterior
              </Link>
            ) : null}
            {pagina < paginas ? (
              <Link
                href={montarLink(atual, { pagina: String(pagina + 1) })}
                className="hover:bg-accent rounded-lg border px-4 py-2 font-medium"
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
