'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, CardContent, Input, Label } from '@rapidinho/ui';
import { ACTION_IDLE } from '@/lib/action-state';
import { pedirLinkDeSenha } from './actions';

export function FormularioDoEmail() {
  const [state, enviar, enviando] = useActionState(pedirLinkDeSenha, ACTION_IDLE);

  return (
    <Card>
      <CardContent className="pt-5">
        {state.ok ? (
          <Alert variant="success">{state.message}</Alert>
        ) : (
          <form action={enviar} className="space-y-4">
            <div>
              <Label htmlFor="email" required>
                E-mail
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                autoFocus
                required
              />
              {state.fieldErrors?.email ? (
                <p className="text-destructive mt-1.5 text-sm">{state.fieldErrors.email}</p>
              ) : null}
            </div>

            {state.message ? <Alert variant="destructive">{state.message}</Alert> : null}

            <Button type="submit" block isLoading={enviando}>
              Enviar link
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
