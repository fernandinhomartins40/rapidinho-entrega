'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent } from '@rapidinho/ui';
import { CamposDeSenhaNova } from '@/components/campos-de-senha';
import { ACTION_IDLE } from '@/lib/action-state';
import { salvarSenhaNova } from '../esqueci/actions';

export function FormularioDaSenhaNova() {
  const [state, enviar, enviando] = useActionState(salvarSenhaNova, ACTION_IDLE);
  const [token, setToken] = useState<string | null>(null);

  // Lê o token do fragmento e o tira da barra de endereço (e do histórico).
  useEffect(() => {
    setToken(window.location.hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  if (state.ok) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-5">
          <Alert variant="success">{state.message}</Alert>
          <Button asChild block>
            <Link href="/entrar">Ir para o login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (token === '') {
    return (
      <Card>
        <CardContent className="space-y-4 pt-5">
          <Alert variant="destructive">Link incompleto. Abra de novo o link do e-mail.</Alert>
          <Button asChild variant="outline" block>
            <Link href="/entrar/esqueci">Pedir outro link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={enviar} className="space-y-4">
          <input type="hidden" name="token" value={token ?? ''} />

          <CamposDeSenhaNova
            autoFocus
            erroDaNova={state.fieldErrors?.nova}
            erroDaRepeticao={state.fieldErrors?.confirmacao}
          />

          {state.message ? (
            <Alert variant="destructive">
              {state.message}{' '}
              <Link href="/entrar/esqueci" className="underline">
                Pedir outro link
              </Link>
            </Alert>
          ) : null}

          <Button type="submit" block isLoading={enviando} disabled={!token}>
            Salvar senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
