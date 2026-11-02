import { Button, Card, CardContent } from '@rapidinho/ui';
import { sair } from '../actions';

export const metadata = { title: 'Sem loja vinculada' };

/**
 * Destino de quem entra com senha mas não tem loja acessível: funcionário
 * desligado, ou dono cuja loja foi encerrada. Antes caía num 404.
 */
export default function SemLojaPage() {
  const site = (process.env.NEXT_PUBLIC_WEB_URL ?? '').replace(/\/$/, '');

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-4 pt-6">
          <h1 className="text-xl font-bold">Sua conta não está ligada a nenhuma loja</h1>
          <p className="text-muted-foreground text-sm">
            Se você trabalha numa loja, peça ao dono para te adicionar de novo. Se quer vender no
            Rapidinho, cadastre sua loja.
          </p>
          <Button asChild block>
            <a href={`${site}/cadastro-loja`}>Cadastrar minha loja</a>
          </Button>
          <form action={sair}>
            <Button type="submit" variant="outline" block>
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
