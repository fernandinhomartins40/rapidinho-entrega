'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Alert, Button, Input, Label } from '@rapidinho/ui';
import { ACTION_IDLE } from '@/lib/action-state';
import { trocarSenha } from './actions';

export function FormularioDeSenha({ email, temSenha }: { email: string; temSenha: boolean }) {
  const [state, enviar, enviando] = useActionState(trocarSenha, ACTION_IDLE);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  const erro = (campo: string) =>
    state.fieldErrors?.[campo] ? (
      <p className="text-destructive mt-1.5 text-sm">{state.fieldErrors[campo]}</p>
    ) : null;

  return (
    <form ref={form} action={enviar} className="space-y-4">
      {/* Diz ao gerenciador de senhas de qual conta é a senha nova. */}
      <input type="email" name="username" autoComplete="username" value={email} hidden readOnly />

      {temSenha ? (
        <div>
          <Label htmlFor="atual" required>
            Senha atual
          </Label>
          <Input id="atual" name="atual" type="password" autoComplete="current-password" required />
          {erro('atual')}
        </div>
      ) : null}

      <div>
        <Label htmlFor="nova" required>
          Nova senha
        </Label>
        <Input id="nova" name="nova" type="password" autoComplete="new-password" required />
        {erro('nova') ?? (
          <p className="text-muted-foreground mt-1.5 text-sm">Pelo menos 8 caracteres.</p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmacao" required>
          Repita a nova senha
        </Label>
        <Input
          id="confirmacao"
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          required
        />
        {erro('confirmacao')}
      </div>

      {state.message ? (
        <Alert variant={state.ok ? 'success' : 'destructive'}>{state.message}</Alert>
      ) : null}

      <Button type="submit" isLoading={enviando}>
        {temSenha ? 'Trocar senha' : 'Criar senha'}
      </Button>
    </form>
  );
}
