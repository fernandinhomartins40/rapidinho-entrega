import { redirect } from 'next/navigation';
import { AuthorizationError, requireSuperAdmin } from '@rapidinho/auth';
import { lerChaveDoGoogleMaps } from '@rapidinho/services';
import { Alert, Card, CardContent, CardHeader, CardTitle } from '@rapidinho/ui';
import { FormularioDoGoogleMaps } from './formulario';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Google Maps' };

/**
 * Chave do Google Maps dos mapas do app (acompanhar o entregador no pedido).
 * Vem do banco a cada abertura de tela: trocar aqui não pede versão nova.
 */
export default async function GoogleMapsPage() {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) redirect('/admin');
    throw error;
  }

  const chave = await lerChaveDoGoogleMaps();

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Google Maps</h1>
        <p className="text-muted-foreground">
          Com a chave, o cliente acompanha o entregador num mapa dentro da tela do pedido. Sem ela,
          o app mostra o botão que abre o Google Maps por fora.
        </p>
      </header>

      {!chave ? (
        <Alert variant="warning" title="Mapa desligado">
          Cadastre a chave abaixo para ligar o mapa no app.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Chave da API</CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioDoGoogleMaps final={chave ? chave.slice(-4) : null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como criar a chave</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Em console.cloud.google.com, crie ou escolha um projeto e ative a cobrança (o Google
              pede cartão, mas dá uma cota mensal gratuita).
            </li>
            <li>
              Em &quot;APIs e serviços&quot; › &quot;Biblioteca&quot;, ative a{' '}
              <strong>Maps JavaScript API</strong>.
            </li>
            <li>
              Em &quot;Credenciais&quot;, crie uma <strong>chave de API</strong>.
            </li>
            <li>
              Na chave, em &quot;Restrições do aplicativo&quot;, escolha <strong>Sites</strong> e
              adicione <code>https://rapidinhoentrega.com.br/*</code>.
            </li>
            <li>
              Em &quot;Restrições de API&quot;, deixe só a <strong>Maps JavaScript API</strong>.
            </li>
            <li>Copie a chave e cole no campo acima.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
