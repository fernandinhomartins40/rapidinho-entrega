'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, Button, Label } from '@rapidinho/ui';
import { ACTION_IDLE, type ActionResult } from '@/lib/action-state';
import { CampoDeSenha, CamposDeSenhaNova } from './campos-de-senha';

/** Usado em /admin/senha e /loja/senha; cada um passa a própria action. */
export function FormularioDeSenha({
  email,
  temSenha,
  acao,
}: {
  email: string;
  temSenha: boolean;
  acao: (anterior: ActionResult, formData: FormData) => Promise<ActionResult>;
}) {
  const [state, enviar, enviando] = useActionState(acao, ACTION_IDLE);
  const form = useRef<HTMLFormElement>(null);
  // Os campos novos guardam o texto no estado: o reset do form não os limpa,
  // então eles são recriados.
  const [limpezas, setLimpezas] = useState(0);

  useEffect(() => {
    if (!state.ok) return;
    form.current?.reset();
    setLimpezas((atual) => atual + 1);
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
          <CampoDeSenha id="atual" name="atual" autoComplete="current-password" required />
          {erro('atual')}
        </div>
      ) : null}

      <CamposDeSenhaNova
        key={limpezas}
        rotulo="Nova senha"
        rotuloDaRepeticao="Repita a nova senha"
        erroDaNova={state.fieldErrors?.nova}
        erroDaRepeticao={state.fieldErrors?.confirmacao}
      />

      {state.message ? (
        <Alert variant={state.ok ? 'success' : 'destructive'}>{state.message}</Alert>
      ) : null}

      <Button type="submit" isLoading={enviando}>
        {temSenha ? 'Trocar senha' : 'Criar senha'}
      </Button>
    </form>
  );
}
