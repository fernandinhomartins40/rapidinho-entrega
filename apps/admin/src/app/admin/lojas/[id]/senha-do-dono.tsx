'use client';

import { useActionState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@rapidinho/ui';
import { gerarSenhaProvisoria } from '../../usuarios/actions';
import { ACTION_IDLE } from '@/lib/action-state';

/**
 * Dono de loja sem senha não entra no painel. Acontece quando quem cadastrou
 * a loja já tinha conta de cliente: o cadastro anônimo não define senha numa
 * conta existente (seria tomada de conta por quem soubesse o telefone). A tela
 * de aprovação é onde o super admin passa a senha, com o e-mail do cadastro.
 */
export function SenhaDoDono({
  dono,
  emailDoCadastro,
}: {
  dono: { id: string; nome: string | null };
  emailDoCadastro: string | null;
}) {
  const [estado, gerar, gerando] = useActionState(gerarSenhaProvisoria, ACTION_IDLE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acesso do dono ao painel</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={gerar} className="space-y-3">
          <p className="text-muted-foreground text-sm">
            {dono.nome ?? 'O dono'} ainda não tem senha e não consegue entrar no painel. Gere uma
            senha provisória e envie para ele junto com o e-mail.
          </p>
          <input type="hidden" name="userId" value={dono.id} />
          <div>
            <Label htmlFor="email-do-dono">E-mail de acesso</Label>
            <Input
              id="email-do-dono"
              name="email"
              type="email"
              defaultValue={emailDoCadastro ?? ''}
              required
              error={estado.fieldErrors?.email}
            />
          </div>

          {estado.message ? (
            <Alert variant={estado.ok ? 'success' : 'destructive'}>
              <span className="select-all">{estado.message}</span>
            </Alert>
          ) : null}

          <Button type="submit" variant="outline" isLoading={gerando}>
            Gerar senha provisória
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
