import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { MapPin, Search, ShoppingBag } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { Badge, Button, Card, CardContent } from '@rapidinho/ui';
import { APP_NAME, STORE_SEGMENT_LABEL } from '@rapidinho/shared';

/**
 * Renderizada sob demanda, não no build: a imagem Docker é construída sem
 * banco disponível, então pré-renderizar aqui quebraria o deploy. O custo é
 * absorvido pelo cache de dados abaixo, que consulta o Postgres no máximo uma
 * vez por minuto.
 */
export const dynamic = 'force-dynamic';

const getActiveCities = unstable_cache(
  async () =>
    prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        state: true,
        _count: { select: { stores: { where: { status: 'ACTIVE', deletedAt: null } } } },
      },
    }),
  ['home-active-cities'],
  { revalidate: 60, tags: ['cities'] },
);

export default async function HomePage() {
  const cities = await getActiveCities();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-10 text-center">
        <div className="bg-primary text-primary-foreground mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
          <ShoppingBag className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{APP_NAME}</h1>
        <p className="text-muted-foreground mt-2">
          Mercado, farmácia e restaurante da sua cidade, entregues na sua porta.
        </p>
      </header>

      <section aria-labelledby="cidades">
        <h2 id="cidades" className="mb-3 flex items-center gap-2 text-lg font-bold">
          <MapPin className="text-primary h-5 w-5" aria-hidden />
          Escolha sua cidade
        </h2>

        {cities.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center">
              <p className="font-medium">Ainda não abrimos nenhuma cidade por aqui.</p>
              <p className="mt-1 text-sm">Volte em breve — estamos chegando.</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {cities.map((city) => (
              <li key={city.id}>
                <Link
                  href={`/${city.slug}`}
                  className="border-input bg-card hover:border-primary hover:bg-accent flex items-center justify-between rounded-xl border-2 p-4 transition-colors"
                >
                  <span>
                    <span className="block text-lg font-semibold">
                      {city.name} — {city.state}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {city._count.stores === 1
                        ? '1 loja disponível'
                        : `${city._count.stores} lojas disponíveis`}
                    </span>
                  </span>
                  <Badge variant="secondary">Entrar</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="segmentos">
        <h2 id="segmentos" className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Search className="text-primary h-5 w-5" aria-hidden />O que você encontra
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(STORE_SEGMENT_LABEL).map((label) => (
            <Badge key={label} variant="outline" className="text-sm">
              {label}
            </Badge>
          ))}
        </div>
      </section>

      <footer className="text-muted-foreground mt-12 border-t pt-6 text-center text-sm">
        <p>Tem um comércio na cidade?</p>
        <Button asChild variant="outline" className="mt-3">
          <Link href="/cadastro-loja">Cadastre sua loja</Link>
        </Button>
      </footer>
    </main>
  );
}
