'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Alert, Button, Input, Label } from '@rapidinho/ui';
import { ACTION_IDLE } from '@/lib/action-state';
import { salvarChaveDoGoogleMaps } from './actions';

export function FormularioDoGoogleMaps({ final }: { final: string | null }) {
  const [state, enviar, enviando] = useActionState(salvarChaveDoGoogleMaps, ACTION_IDLE);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={enviar} className="space-y-4">
      <div>
        <Label htmlFor="chave" required>
          {final ? 'Trocar a chave' : 'Chave da API'}
        </Label>
        <Input
          id="chave"
          name="chave"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza..."
          required
        />
        {state.fieldErrors?.chave ? (
          <p className="text-destructive mt-1.5 text-sm">{state.fieldErrors.chave}</p>
        ) : (
          <p className="text-muted-foreground mt-1.5 text-sm">
            {final ? `A chave atual termina em ${final}.` : 'Nenhuma chave cadastrada ainda.'}
          </p>
        )}
      </div>

      {state.message ? (
        <Alert variant={state.ok ? 'success' : 'destructive'}>{state.message}</Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={enviando}>
          Salvar chave
        </Button>
        {final ? (
          <Button
            type="submit"
            variant="outline"
            name="remover"
            value="1"
            formNoValidate
            disabled={enviando}
          >
            Remover chave
          </Button>
        ) : null}
      </div>
    </form>
  );
}
