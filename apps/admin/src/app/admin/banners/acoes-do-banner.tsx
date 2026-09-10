'use client';

import { useActionState, useEffect, useState } from 'react';
import { Power, PowerOff, Trash2 } from 'lucide-react';
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
} from '@rapidinho/ui';
import { alternarBanner, excluirBanner } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function AcoesDoBanner({
  id,
  titulo,
  ativo,
}: {
  id: string;
  titulo: string;
  ativo: boolean;
}) {
  const [, alternar, alternando] = useActionState(alternarBanner, ACTION_IDLE);
  const [excluirState, excluir, excluindo] = useActionState(excluirBanner, ACTION_IDLE);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (excluirState.ok) setConfirmando(false);
  }, [excluirState]);

  return (
    <div className="flex gap-2">
      <form action={alternar} className="flex-1">
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline" size="sm" block disabled={alternando}>
          {ativo ? (
            <>
              <PowerOff className="h-4 w-4" aria-hidden />
              Tirar do ar
            </>
          ) : (
            <>
              <Power className="h-4 w-4" aria-hidden />
              Colocar no ar
            </>
          )}
        </Button>
      </form>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Excluir banner ${titulo}`}>
            <Trash2 className="text-destructive h-4 w-4" aria-hidden />
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir “{titulo}”?</DialogTitle>
            <DialogDescription>
              O banner e suas métricas somem. Se quiser só pausar, use “Tirar do ar”.
            </DialogDescription>
          </DialogHeader>

          {excluirState.message && !excluirState.ok ? (
            <Alert variant="destructive">{excluirState.message}</Alert>
          ) : null}

          <form action={excluir}>
            <input type="hidden" name="id" value={id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" isLoading={excluindo}>
                Excluir banner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
