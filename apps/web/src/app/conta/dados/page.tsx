import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@rapidinho/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { MeusDados } from './painel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meus dados e privacidade' };

export default async function DadosPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/entrar?destino=/conta/dados');

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 py-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Meus dados</h1>
        <p className="text-muted-foreground mt-1">
          A LGPD garante que você veja, leve e apague o que guardamos sobre você.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>O que guardamos</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            <strong className="text-foreground">Para você entrar:</strong> seu telefone. É o que
            substitui a senha.
          </p>
          <p>
            <strong className="text-foreground">Para entregar:</strong> seus endereços e o ponto de
            referência. A loja e o entregador do pedido veem esses dados.
          </p>
          <p>
            <strong className="text-foreground">Para o histórico:</strong> seus pedidos, com o que
            foi comprado e quanto custou.
          </p>
          <p>
            Não vendemos seus dados nem os usamos para anúncio de terceiros.{' '}
            <Link href="/privacidade" className="underline">
              Política completa
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <MeusDados />
    </main>
  );
}
