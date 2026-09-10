import { prisma } from '@rapidinho/database';
import { formatCents } from '@rapidinho/shared';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { PlanoDialog } from './plano-dialog';
import { AlternarPlano } from './alternar-plano';
import { RECURSOS_DO_PLANO } from './recursos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Planos' };

export default async function PlanosPage() {
  const planos = await prisma.plan.findMany({
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { monthlyPriceCents: 'asc' }],
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Planos</h1>
          <p className="text-muted-foreground">
            Preço, comissão, limites e recursos de cada plano. Tudo editável aqui.
          </p>
        </div>
        <PlanoDialog />
      </header>

      {planos.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center">
            Nenhum plano cadastrado. Crie ao menos um e marque-o como padrão para que lojas novas
            tenham onde entrar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {planos.map((plano) => {
            const recursos = (plano.features ?? {}) as Record<string, boolean>;

            return (
              <Card key={plano.id} className={plano.isActive ? undefined : 'opacity-60'}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{plano.name}</CardTitle>
                      <p className="text-muted-foreground mt-1 text-sm">{plano.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {plano.isDefault ? <Badge>Padrão</Badge> : null}
                      {plano.isActive ? null : <Badge variant="secondary">Inativo</Badge>}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <p className="text-2xl font-bold">
                      {plano.monthlyPriceCents === 0
                        ? 'Grátis'
                        : `${formatCents(plano.monthlyPriceCents)}/mês`}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {Number(plano.commissionRate).toFixed(1)}% de comissão por pedido
                      {plano.trialDays > 0 ? ` · ${plano.trialDays} dias grátis` : ''}
                    </p>
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <dt className="text-muted-foreground text-xs">Produtos</dt>
                      <dd className="font-semibold">{plano.maxProducts ?? 'Ilimitado'}</dd>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <dt className="text-muted-foreground text-xs">Fotos</dt>
                      <dd className="font-semibold">{plano.maxPhotos ?? 'Ilimitado'}</dd>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <dt className="text-muted-foreground text-xs">Equipe</dt>
                      <dd className="font-semibold">{plano.maxStaff ?? 'Ilimitado'}</dd>
                    </div>
                  </dl>

                  <ul className="space-y-1 text-sm">
                    {RECURSOS_DO_PLANO.map((recurso) => (
                      <li key={recurso.chave} className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={
                            recursos[recurso.chave]
                              ? 'bg-success h-2 w-2 shrink-0 rounded-full'
                              : 'bg-muted-foreground/30 h-2 w-2 shrink-0 rounded-full'
                          }
                        />
                        <span className={recursos[recurso.chave] ? '' : 'text-muted-foreground'}>
                          {recurso.rotulo}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-muted-foreground text-sm">
                    {plano._count.subscriptions}{' '}
                    {plano._count.subscriptions === 1 ? 'loja assinante' : 'lojas assinantes'}
                  </p>

                  <div className="flex gap-2 border-t pt-3">
                    <PlanoDialog
                      plano={{
                        id: plano.id,
                        name: plano.name,
                        description: plano.description,
                        monthlyPriceCents: plano.monthlyPriceCents,
                        commissionRate: Number(plano.commissionRate),
                        maxProducts: plano.maxProducts,
                        maxPhotos: plano.maxPhotos,
                        maxStaff: plano.maxStaff,
                        features: recursos,
                        trialDays: plano.trialDays,
                        isActive: plano.isActive,
                        isDefault: plano.isDefault,
                      }}
                    />
                    <AlternarPlano
                      id={plano.id}
                      nome={plano.name}
                      ativo={plano.isActive}
                      assinantes={plano._count.subscriptions}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
