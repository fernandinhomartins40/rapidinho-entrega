'use client';

import { useActionState, useEffect, useState } from 'react';
import { Ban, CheckCircle2, LogIn, RotateCcw, XCircle } from 'lucide-react';
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
  Label,
  Textarea,
} from '@rapidinho/ui';
import { alternarSuspensao, decidirCadastro, entrarComoLojista } from '../actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface AcoesDaLojaProps {
  loja: {
    id: string;
    nome: string;
    status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
    donoId: string | null;
    donoNome: string | null;
  };
}

export function AcoesDaLoja({ loja }: AcoesDaLojaProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {loja.status === 'PENDING_APPROVAL' ? (
        <>
          <AprovarCadastro loja={loja} />
          <RecusarCadastro loja={loja} />
        </>
      ) : null}

      {loja.status === 'ACTIVE' || loja.status === 'SUSPENDED' ? (
        <SuspenderLoja loja={loja} />
      ) : null}

      {loja.donoId && loja.status !== 'REJECTED' ? <EntrarComoLojista loja={loja} /> : null}
    </div>
  );
}

function AprovarCadastro({ loja }: AcoesDaLojaProps) {
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(decidirCadastro, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="success">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          Aprovar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aprovar {loja.nome}?</DialogTitle>
          <DialogDescription>
            A loja passa a aparecer no app imediatamente e pode receber pedidos.
          </DialogDescription>
        </DialogHeader>

        {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

        <form action={enviar}>
          <input type="hidden" name="storeId" value={loja.id} />
          <input type="hidden" name="approved" value="true" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="success" isLoading={enviando}>
              Aprovar e publicar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecusarCadastro({ loja }: AcoesDaLojaProps) {
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(decidirCadastro, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <XCircle className="h-5 w-5" aria-hidden />
          Recusar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recusar o cadastro de {loja.nome}?</DialogTitle>
          <DialogDescription>
            O motivo fica registrado — é o que a equipe vai usar para responder quando o lojista
            ligar.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          <input type="hidden" name="storeId" value={loja.id} />
          <input type="hidden" name="approved" value="false" />

          <div>
            <Label htmlFor="reason" required>
              Motivo da recusa
            </Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Ex.: documento ilegível, CNPJ não confere com o nome da loja"
              error={state.fieldErrors?.reason}
              required
            />
          </div>

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" isLoading={enviando}>
              Recusar cadastro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SuspenderLoja({ loja }: AcoesDaLojaProps) {
  const suspensa = loja.status === 'SUSPENDED';
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(alternarSuspensao, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant={suspensa ? 'success' : 'outline'}>
          {suspensa ? (
            <RotateCcw className="h-5 w-5" aria-hidden />
          ) : (
            <Ban className="h-5 w-5" aria-hidden />
          )}
          {suspensa ? 'Reativar' : 'Suspender'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {suspensa ? `Reativar ${loja.nome}?` : `Suspender ${loja.nome}?`}
          </DialogTitle>
          <DialogDescription>
            {suspensa
              ? 'A loja volta a aparecer no app e a equipe recupera o acesso ao painel.'
              : 'A loja sai do ar e a equipe é desconectada do painel na hora.'}
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          <input type="hidden" name="storeId" value={loja.id} />

          {suspensa ? null : (
            <div>
              <Label htmlFor="reason" required>
                Motivo da suspensão
              </Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="Ex.: reclamações recorrentes de pedido não entregue"
                error={state.fieldErrors?.reason}
                required
              />
            </div>
          )}

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={suspensa ? 'success' : 'destructive'}
              isLoading={enviando}
            >
              {suspensa ? 'Reativar loja' : 'Suspender loja'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EntrarComoLojista({ loja }: AcoesDaLojaProps) {
  const [aberto, setAberto] = useState(false);
  const [state, enviar, enviando] = useActionState(entrarComoLojista, ACTION_IDLE);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <LogIn className="h-5 w-5" aria-hidden />
          Entrar como lojista
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acessar o painel de {loja.nome}</DialogTitle>
          <DialogDescription>
            Você vai operar como {loja.donoNome ?? 'o dono da loja'}. O acesso fica registrado na
            auditoria com o motivo e expira em 1 hora.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          <input type="hidden" name="userId" value={loja.donoId ?? ''} />
          <input type="hidden" name="storeId" value={loja.id} />

          <div>
            <Label htmlFor="reason" required>
              Motivo do acesso
            </Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Ex.: lojista pediu ajuda por telefone para configurar a taxa de entrega"
              error={state.fieldErrors?.reason}
              required
            />
          </div>

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={enviando}>
              Entrar no painel da loja
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
