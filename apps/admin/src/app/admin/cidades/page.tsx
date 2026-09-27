import { prisma } from '@rapidinho/database';
import { formatCents, formatPhoneBR, whatsappLink } from '@rapidinho/shared';
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
import { CidadeDialog } from './cidade-dialog';
import { AlternarCidade } from './alternar-cidade';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cidades' };

/**
 * Demanda por cidade ainda não atendida, montada a partir de "Traga o
 * Rapidinho para sua cidade". A cidade que junta gente para pedir, loja para
 * vender e moto para entregar está pronta para abrir.
 */
async function carregarDemanda() {
  const pedidos = await prisma.cityInterest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 2000,
    select: {
      cityKey: true,
      cityName: true,
      state: true,
      profile: true,
      name: true,
      phone: true,
      businessName: true,
      createdAt: true,
    },
  });

  const porCidade = new Map<
    string,
    {
      nome: string;
      clientes: number;
      lojas: number;
      entregadores: number;
      contatos: typeof pedidos;
    }
  >();

  for (const pedido of pedidos) {
    const linha = porCidade.get(pedido.cityKey) ?? {
      nome: `${pedido.cityName}/${pedido.state}`,
      clientes: 0,
      lojas: 0,
      entregadores: 0,
      contatos: [],
    };
    if (pedido.profile === 'CUSTOMER') linha.clientes += 1;
    if (pedido.profile === 'STORE') linha.lojas += 1;
    if (pedido.profile === 'COURIER') linha.entregadores += 1;
    // Loja e entregador primeiro: são eles que tornam a abertura possível.
    if (pedido.profile !== 'CUSTOMER') linha.contatos.unshift(pedido);
    else linha.contatos.push(pedido);
    porCidade.set(pedido.cityKey, linha);
  }

  return [...porCidade.entries()]
    .map(([chave, linha]) => ({ chave, ...linha, total: linha.contatos.length }))
    .sort((a, b) => b.lojas + b.entregadores - (a.lojas + a.entregadores) || b.total - a.total)
    .slice(0, 20);
}

const PERFIL: Record<string, string> = {
  CUSTOMER: 'Quer pedir',
  STORE: 'Tem loja',
  COURIER: 'Quer entregar',
};

export default async function CidadesPage() {
  const demanda = await carregarDemanda();
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

      <Card>
        <CardHeader>
          <CardTitle>Onde abrir a seguir</CardTitle>
          <p className="text-muted-foreground text-sm">
            Pedidos de "Traga o Rapidinho para sua cidade". As cidades com loja e entregador
            interessados vêm primeiro — sem eles não há o que abrir.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {demanda.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Ninguém pediu outra cidade ainda. O formulário fica em /minha-cidade, no rodapé da
              landing e na escolha de cidade do app.
            </p>
          ) : (
            demanda.map((cidade) => (
              <details key={cidade.chave} className="rounded-xl border p-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-semibold">{cidade.nome}</span>
                  <Badge variant="secondary">{cidade.clientes} querem pedir</Badge>
                  <Badge variant={cidade.lojas > 0 ? 'success' : 'secondary'}>
                    {cidade.lojas} {cidade.lojas === 1 ? 'loja' : 'lojas'}
                  </Badge>
                  <Badge variant={cidade.entregadores > 0 ? 'success' : 'secondary'}>
                    {cidade.entregadores}{' '}
                    {cidade.entregadores === 1 ? 'entregador' : 'entregadores'}
                  </Badge>
                </summary>
                <ul className="mt-3 divide-y text-sm">
                  {cidade.contatos.slice(0, 30).map((contato) => (
                    <li
                      key={`${contato.phone}-${contato.profile}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span>
                        <span className="font-medium">{contato.name}</span>
                        {contato.businessName ? (
                          <span className="text-muted-foreground"> · {contato.businessName}</span>
                        ) : null}
                        <span className="text-muted-foreground block text-xs">
                          {PERFIL[contato.profile]} ·{' '}
                          {contato.createdAt.toLocaleDateString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                          })}
                        </span>
                      </span>
                      <a
                        href={whatsappLink(
                          contato.phone,
                          `Olá, ${contato.name}! Aqui é do Rapidinho Entrega, sobre levar o app para ${cidade.nome}.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-text font-semibold hover:underline"
                      >
                        {formatPhoneBR(contato.phone)}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
