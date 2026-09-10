'use client';

import { useActionState, useEffect, useState } from 'react';
import { FileCheck2, Settings2 } from 'lucide-react';
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
import { alternarSuspensaoEntregador, decidirEntregador } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface EntregadorResumo {
  id: string;
  nome: string;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  documentos: { id: string; label: string; aprovado: boolean | null }[];
}

export function AcoesDoEntregador({ entregador }: { entregador: EntregadorResumo }) {
  const [aberto, setAberto] = useState(false);
  const [decisao, decidir, decidindo] = useActionState(decidirEntregador, ACTION_IDLE);
  const [suspensao, suspender, suspendendo] = useActionState(
    alternarSuspensaoEntregador,
    ACTION_IDLE,
  );

  useEffect(() => {
    if (decisao.ok || suspensao.ok) setAberto(false);
  }, [decisao, suspensao]);

  const pendente = entregador.status === 'PENDING_APPROVAL';
  const suspenso = entregador.status === 'SUSPENDED';

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          variant={pendente ? 'default' : 'ghost'}
          size={pendente ? 'sm' : 'icon'}
          aria-label={`Gerenciar ${entregador.nome}`}
        >
          {pendente ? (
            <>
              <FileCheck2 className="h-4 w-4" aria-hidden />
              Revisar
            </>
          ) : (
            <Settings2 className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entregador.nome}</DialogTitle>
          <DialogDescription>
            {pendente
              ? 'Confira os documentos antes de liberar. Entregador aprovado passa a receber corridas.'
              : 'Suspender tira o entregador da fila de corridas imediatamente.'}
          </DialogDescription>
        </DialogHeader>

        <section>
          <h3 className="mb-2 text-sm font-semibold">Documentos enviados</h3>
          {entregador.documentos.length === 0 ? (
            <Alert variant="warning">
              Nenhum documento enviado. Aprovar sem documento é decisão sua.
            </Alert>
          ) : (
            <ul className="divide-y text-sm">
              {entregador.documentos.map((documento) => (
                <li key={documento.id} className="flex items-center justify-between py-2">
                  <span>{documento.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {documento.aprovado == null
                      ? 'A revisar'
                      : documento.aprovado
                        ? 'Aprovado'
                        : 'Recusado'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {pendente ? (
          <form action={decidir} className="space-y-4 border-t pt-4">
            <input type="hidden" name="courierId" value={entregador.id} />

            <div>
              <Label htmlFor={`reason-${entregador.id}`}>Motivo (obrigatório ao recusar)</Label>
              <Textarea
                id={`reason-${entregador.id}`}
                name="reason"
                rows={2}
                placeholder="Ex.: foto da CNH ilegível"
                error={decisao.fieldErrors?.reason}
              />
            </div>

            {decisao.message && !decisao.ok ? (
              <Alert variant="destructive">{decisao.message}</Alert>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                name="approved"
                value="false"
                variant="outline"
                isLoading={decidindo}
              >
                Recusar
              </Button>
              <Button
                type="submit"
                name="approved"
                value="true"
                variant="success"
                isLoading={decidindo}
              >
                Aprovar
              </Button>
            </DialogFooter>
          </form>
        ) : entregador.status === 'REJECTED' ? null : (
          <form action={suspender} className="border-t pt-4">
            <input type="hidden" name="courierId" value={entregador.id} />

            {suspensao.message && !suspensao.ok ? (
              <Alert variant="destructive">{suspensao.message}</Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
                Fechar
              </Button>
              <Button
                type="submit"
                variant={suspenso ? 'success' : 'destructive'}
                isLoading={suspendendo}
              >
                {suspenso ? 'Reativar entregador' : 'Suspender entregador'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
