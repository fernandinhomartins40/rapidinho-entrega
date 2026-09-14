import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { prisma } from '@rapidinho/database';
import { getCurrentUser } from '@rapidinho/auth';
import { Button, Card, CardContent } from '@rapidinho/ui';
import { carregarCarrinho } from '@/lib/cart';
import { ListaDoCarrinho } from './lista';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carrinho' };

/**
 * Carrinho do cliente.
 *
 * Como há um carrinho por loja, esta tela mostra todos e deixa o cliente
 * escolher qual fechar. Somar itens de lojas diferentes num pedido só não
 * existe: cada loja prepara e despacha o seu.
 */
export default async function CarrinhoPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/entrar?destino=/carrinho');

  const carrinhos = await prisma.cart.findMany({
    where: { userId: user.id, items: { some: {} } },
    orderBy: { updatedAt: 'desc' },
    select: { storeId: true, store: { select: { city: { select: { slug: true } } } } },
  });

  const resolvidos = (
    await Promise.all(carrinhos.map((carrinho) => carregarCarrinho(user.id, carrinho.storeId)))
  ).filter((carrinho) => carrinho != null && carrinho.itens.length > 0);

  if (resolvidos.length === 0) {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-5 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Seu carrinho</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ShoppingBag className="text-muted-foreground h-10 w-10" aria-hidden />
            <p className="font-semibold">Seu carrinho está vazio.</p>
            <p className="text-muted-foreground">
              Escolha uma loja e monte seu pedido. Dá para pedir de várias lojas — um pedido para
              cada.
            </p>
            <Button asChild>
              <Link href="/">Ver lojas</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Seu carrinho</h1>

      {resolvidos.map((carrinho, indice) => (
        <ListaDoCarrinho
          key={carrinho!.id}
          carrinho={carrinho!}
          cidadeSlug={carrinhos[indice]?.store.city.slug ?? ''}
        />
      ))}
    </main>
  );
}
