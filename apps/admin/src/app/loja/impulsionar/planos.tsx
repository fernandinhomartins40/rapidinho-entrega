'use client';

import { useState, useTransition } from 'react';
import { Check, Megaphone, TrendingUp } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from '@rapidinho/ui';
import { BOOST_PLACEMENT_LABEL, formatCents } from '@rapidinho/shared';
import { contratarImpulsionamento, contratarPlano } from './actions';

interface Plano {
  id: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  commissionRate: number;
  maxProducts: number | null;
  maxPhotos: number | null;
  features: string[];
  trialDays: number;
}

interface Pacote {
  id: string;
  name: string;
  description: string | null;
  placement: string;
  priceCents: number;
  durationDays: number;
}

interface Boost {
  id: string;
  status: string;
  nome: string;
  posicao: string;
  inicio: string;
  fim: string;
  impressoes: number;
  cliques: number;
  conversoes: number;
}

export function Planos({
  planos,
  pacotes,
  assinatura,
  boosts,
  podeContratar,
}: {
  planos: Plano[];
  pacotes: Pacote[];
  assinatura: { planId: string; status: string; fimDoPeriodo: string | null } | null;
  boosts: Boost[];
  podeContratar: boolean;
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);

  function executar(acao: () => Promise<{ ok: boolean; message?: string }>) {
    setMensagem(null);
    iniciarTransicao(async () => {
      const resultado = await acao();
      setMensagem({ texto: resultado.message ?? '', erro: !resultado.ok });
    });
  }

  return (
    <div className="space-y-8">
      {mensagem ? (
        <p
          role="status"
          className={mensagem.erro ? 'text-destructive font-medium' : 'text-success font-medium'}
        >
          {mensagem.texto}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-bold">Planos</h2>
        <ul className="grid gap-4 lg:grid-cols-3">
          {planos.map((plano) => {
            const atual = assinatura?.planId === plano.id;

            return (
              <li key={plano.id}>
                <Card className={cn('h-full', atual && 'border-primary border-2')}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      {plano.name}
                      {atual ? <Badge variant="success">Seu plano</Badge> : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-2xl font-bold">
                      {plano.monthlyPriceCents === 0 ? (
                        'Grátis'
                      ) : (
                        <>
                          {formatCents(plano.monthlyPriceCents)}
                          <span className="text-muted-foreground text-base font-normal">/mês</span>
                        </>
                      )}
                    </p>

                    {/* A comissão é o número que mais importa para o lojista e
                        costuma ficar escondido em letra miúda. Aqui não. */}
                    <p className="font-semibold">{plano.commissionRate}% de comissão por pedido</p>

                    {plano.description ? (
                      <p className="text-muted-foreground text-sm">{plano.description}</p>
                    ) : null}

                    <ul className="space-y-1.5 text-sm">
                      <li className="flex gap-2">
                        <Check className="text-success h-4 w-4 shrink-0" aria-hidden />
                        {plano.maxProducts
                          ? `Até ${plano.maxProducts} produtos`
                          : 'Produtos ilimitados'}
                      </li>
                      <li className="flex gap-2">
                        <Check className="text-success h-4 w-4 shrink-0" aria-hidden />
                        {plano.maxPhotos ? `Até ${plano.maxPhotos} fotos` : 'Fotos ilimitadas'}
                      </li>
                      {plano.features.map((recurso) => (
                        <li key={recurso} className="flex gap-2">
                          <Check className="text-success h-4 w-4 shrink-0" aria-hidden />
                          {recurso}
                        </li>
                      ))}
                    </ul>

                    {plano.trialDays > 0 && !atual ? (
                      <p className="text-success text-sm font-medium">
                        {plano.trialDays} dias grátis para testar
                      </p>
                    ) : null}

                    {podeContratar && !atual ? (
                      <Button
                        block
                        disabled={pendente}
                        onClick={() => executar(() => contratarPlano({ planId: plano.id }))}
                      >
                        Escolher este plano
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      {boosts.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">Seus impulsionamentos</h2>
          <ul className="space-y-2">
            {boosts.map((boost) => (
              <li key={boost.id}>
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {boost.nome}{' '}
                          <Badge variant={boost.status === 'ACTIVE' ? 'success' : 'secondary'}>
                            {boost.status === 'ACTIVE' ? 'No ar' : 'Agendado'}
                          </Badge>
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {BOOST_PLACEMENT_LABEL[
                            boost.posicao as keyof typeof BOOST_PLACEMENT_LABEL
                          ] ?? boost.posicao}{' '}
                          · até {new Date(boost.fim).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {/* Métricas cruas, sem maquiagem: se o impulsionamento não
                        está dando retorno, o lojista precisa ver isso. */}
                    <dl className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Vezes exibida</dt>
                        <dd className="text-lg font-bold">{boost.impressoes}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Cliques</dt>
                        <dd className="text-lg font-bold">{boost.cliques}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Pedidos</dt>
                        <dd className="text-lg font-bold">{boost.conversoes}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Megaphone className="h-5 w-5" aria-hidden />
          Aparecer em destaque
        </h2>

        {pacotes.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground pt-6">
              Nenhum pacote disponível no momento.
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pacotes.map((pacote) => (
              <li key={pacote.id}>
                <Card className="h-full">
                  <CardContent className="space-y-3 pt-5">
                    <p className="font-semibold">{pacote.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {BOOST_PLACEMENT_LABEL[
                        pacote.placement as keyof typeof BOOST_PLACEMENT_LABEL
                      ] ?? pacote.placement}
                    </p>
                    {pacote.description ? (
                      <p className="text-muted-foreground text-sm">{pacote.description}</p>
                    ) : null}
                    <p className="text-xl font-bold">{formatCents(pacote.priceCents)}</p>
                    <p className="text-muted-foreground text-sm">
                      por {pacote.durationDays} {pacote.durationDays === 1 ? 'dia' : 'dias'}
                    </p>

                    {podeContratar ? (
                      <Button
                        block
                        variant="outline"
                        disabled={pendente}
                        onClick={() =>
                          executar(() => contratarImpulsionamento({ packageId: pacote.id }))
                        }
                      >
                        <TrendingUp className="h-5 w-5" aria-hidden />
                        Contratar
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
