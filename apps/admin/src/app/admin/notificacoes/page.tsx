import { prisma } from '@rapidinho/database';
import { descreverSegmento, type NotificationSegment } from '@rapidinho/shared';
import { Badge, Card, CardContent } from '@rapidinho/ui';
import { FormularioDeCampanha } from './formulario-de-campanha';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notificações' };

export default async function NotificacoesPage() {
  const [cidades, campanhas, comOptIn] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, state: true },
      orderBy: { name: 'asc' },
    }),
    prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.user.count({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        marketingOptIn: true,
        pushSubscriptions: { some: {} },
      },
    }),
  ]);

  const nomePorCidade = new Map(cidades.map((c) => [c.id, `${c.name} — ${c.state}`]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Notificações</h1>
        <p className="text-muted-foreground">
          Campanhas por push para quem aceitou receber novidades. Hoje são {comOptIn}{' '}
          {comOptIn === 1 ? 'pessoa alcançável' : 'pessoas alcançáveis'} no total.
        </p>
      </header>

      <FormularioDeCampanha cidades={cidades} />

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Campanhas enviadas</h2>

        {campanhas.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center">
              Nenhuma campanha enviada ainda.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {campanhas.map((campanha) => {
              const segmento = campanha.segment as unknown as NotificationSegment;
              const nomes = (segmento.cityIds ?? [])
                .map((id) => nomePorCidade.get(id))
                .filter((nome): nome is string => Boolean(nome));

              return (
                <li key={campanha.id}>
                  <Card>
                    <CardContent className="space-y-2 pt-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold">{campanha.title}</p>
                        {campanha.sentAt ? (
                          <Badge variant="success">
                            Enviada em {campanha.sentAt.toLocaleDateString('pt-BR')}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Na fila</Badge>
                        )}
                      </div>

                      <p className="text-muted-foreground text-sm">{campanha.body}</p>

                      <p className="text-muted-foreground text-xs">
                        {descreverSegmento(segmento, nomes)} · {campanha.recipientCount}{' '}
                        {campanha.recipientCount === 1 ? 'destinatário' : 'destinatários'}
                        {campanha.linkUrl ? ` · abre ${campanha.linkUrl}` : ''}
                      </p>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
