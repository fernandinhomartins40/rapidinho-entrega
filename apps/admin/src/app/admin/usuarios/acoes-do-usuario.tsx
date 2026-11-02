'use client';

import { useActionState, useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
} from '@rapidinho/ui';
import { USER_ROLE_LABEL, USER_ROLES, type UserRole } from '@rapidinho/shared';
import { alterarPapel, alternarBloqueio, gerarSenhaProvisoria } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

/** Mesmos papéis de PAPEIS_COM_SENHA (pacote de auth, que não vai ao navegador). */
const ENTRA_COM_SENHA: readonly UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'STORE_OWNER', 'STORE_STAFF'];

export function AcoesDoUsuario({
  usuario,
  podeGerarSenha,
}: {
  usuario: {
    id: string;
    nome: string | null;
    papel: UserRole;
    bloqueado: boolean;
    email: string | null;
  };
  podeGerarSenha: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [papelState, salvarPapel, salvandoPapel] = useActionState(alterarPapel, ACTION_IDLE);
  const [bloqueioState, alternar, alternando] = useActionState(alternarBloqueio, ACTION_IDLE);
  const [senhaState, gerarSenha, gerandoSenha] = useActionState(gerarSenhaProvisoria, ACTION_IDLE);

  useEffect(() => {
    if (papelState.ok || bloqueioState.ok) setAberto(false);
  }, [papelState, bloqueioState]);

  const nome = usuario.nome ?? 'este usuário';

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Gerenciar ${nome}`}>
          <Settings2 className="h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{nome}</DialogTitle>
          <DialogDescription>
            Mudar o papel ou bloquear a conta encerra as sessões abertas.
          </DialogDescription>
        </DialogHeader>

        <form action={salvarPapel} className="space-y-3 border-b pb-4">
          <input type="hidden" name="userId" value={usuario.id} />
          <div>
            <Label htmlFor={`role-${usuario.id}`}>Papel</Label>
            <Select id={`role-${usuario.id}`} name="role" defaultValue={usuario.papel}>
              {USER_ROLES.map((papel) => (
                <option key={papel} value={papel}>
                  {USER_ROLE_LABEL[papel]}
                </option>
              ))}
            </Select>
          </div>

          {papelState.message ? (
            <Alert variant={papelState.ok ? 'success' : 'destructive'}>{papelState.message}</Alert>
          ) : null}

          <Button type="submit" variant="outline" isLoading={salvandoPapel} block>
            Salvar papel
          </Button>
        </form>

        {podeGerarSenha && ENTRA_COM_SENHA.includes(usuario.papel) ? (
          <form action={gerarSenha} className="space-y-3 border-b pb-4">
            <input type="hidden" name="userId" value={usuario.id} />
            <div>
              <Label htmlFor={`email-${usuario.id}`}>E-mail de acesso ao painel</Label>
              <Input
                id={`email-${usuario.id}`}
                name="email"
                type="email"
                defaultValue={usuario.email ?? ''}
                required
                error={senhaState.fieldErrors?.email}
              />
              <p className="text-muted-foreground mt-1.5 text-sm">
                Também serve quando a pessoa esqueceu a senha. A senha atual deixa de valer.
              </p>
            </div>

            {senhaState.message ? (
              <Alert variant={senhaState.ok ? 'success' : 'destructive'}>
                <span className="select-all">{senhaState.message}</span>
              </Alert>
            ) : null}

            <Button type="submit" variant="outline" isLoading={gerandoSenha} block>
              Gerar senha provisória
            </Button>
          </form>
        ) : null}

        <form action={alternar} className="space-y-3">
          <input type="hidden" name="userId" value={usuario.id} />

          <p className="text-muted-foreground text-sm">
            {usuario.bloqueado
              ? 'A conta está bloqueada e não consegue entrar.'
              : 'Bloquear impede o acesso e desconecta a conta imediatamente.'}
          </p>

          {bloqueioState.message && !bloqueioState.ok ? (
            <Alert variant="destructive">{bloqueioState.message}</Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Fechar
            </Button>
            <Button
              type="submit"
              variant={usuario.bloqueado ? 'success' : 'destructive'}
              isLoading={alternando}
            >
              {usuario.bloqueado ? 'Desbloquear conta' : 'Bloquear conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
