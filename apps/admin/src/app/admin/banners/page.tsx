import { prisma } from '@rapidinho/database';
import { BOOST_PLACEMENT_LABEL } from '@rapidinho/shared';
import { getStorage } from '@rapidinho/services';
import { Badge, Card, CardContent } from '@rapidinho/ui';
import { BannerDialog } from './banner-dialog';
import { AcoesDoBanner } from './acoes-do-banner';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Banners' };

export default async function BannersPage() {
  const [banners, cidades, lojas] = await Promise.all([
    prisma.banner.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        image: { select: { mediumKey: true, blurDataUrl: true } },
        city: { select: { name: true, state: true } },
        store: { select: { name: true } },
      },
    }),
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true, state: true },
      orderBy: { name: 'asc' },
    }),
    prisma.store.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  const storage = getStorage();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Banners</h1>
          <p className="text-muted-foreground">
            Campanhas da plataforma na home do app. Formato 21:9.
          </p>
        </div>
        <BannerDialog cidades={cidades} lojas={lojas} />
      </header>

      {banners.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center">
            Nenhum banner cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {banners.map((banner) => {
            const taxaClique =
              banner.impressions > 0 ? (banner.clicks / banner.impressions) * 100 : 0;

            return (
              <Card key={banner.id} className={banner.isActive ? undefined : 'opacity-60'}>
                <CardContent className="space-y-3 pt-5">
                  {banner.image.mediumKey ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={storage.getPublicUrl(banner.image.mediumKey)}
                      alt=""
                      className="aspect-[21/9] w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="bg-muted aspect-[21/9] w-full rounded-lg" />
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{banner.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {BOOST_PLACEMENT_LABEL[banner.placement]} ·{' '}
                        {banner.city
                          ? `${banner.city.name} — ${banner.city.state}`
                          : 'Todas as cidades'}
                        {banner.store ? ` · ${banner.store.name}` : ''}
                      </p>
                    </div>
                    {banner.isActive ? (
                      <Badge variant="success">No ar</Badge>
                    ) : (
                      <Badge variant="secondary">Fora do ar</Badge>
                    )}
                  </div>

                  <p className="text-muted-foreground text-sm">
                    {banner.impressions} impressões · {banner.clicks} cliques (
                    {taxaClique.toFixed(1)}%)
                    {banner.endsAt ? ` · até ${banner.endsAt.toLocaleDateString('pt-BR')}` : ''}
                  </p>

                  <div className="border-t pt-3">
                    <AcoesDoBanner id={banner.id} titulo={banner.title} ativo={banner.isActive} />
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
