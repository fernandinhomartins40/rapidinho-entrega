'use client';

import { useRef, useState, useTransition } from 'react';
import { Button, Input, Label } from '@rapidinho/ui';
import { enviarCodigoDeCadastro } from '@/lib/confirmacao-de-telefone';

/**
 * Telefone com confirmação por SMS, para os cadastros públicos. O formulário
 * só é aceito com o código: sem ele, qualquer pessoa cadastrava com o número
 * de outra (R3-060, R3-061).
 */
export function CampoDeTelefoneConfirmado({
  rotulo,
  erroDoTelefone,
  erroDoCodigo,
}: {
  rotulo: string;
  erroDoTelefone?: string;
  erroDoCodigo?: string;
}) {
  const telefoneRef = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  const enviar = () =>
    iniciar(async () => {
      const resultado = await enviarCodigoDeCadastro(telefoneRef.current?.value ?? '');
      setAviso({
        ok: resultado.ok,
        texto:
          resultado.ok && resultado.devCode
            ? `${resultado.message} (desenvolvimento: ${resultado.devCode})`
            : resultado.message,
      });
    });

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="telefone" required>
          {rotulo}
        </Label>
        <div className="flex gap-2">
          <Input
            ref={telefoneRef}
            id="telefone"
            name="telefone"
            inputMode="tel"
            placeholder="(44) 99999-0000"
            required
            error={erroDoTelefone}
          />
          <Button type="button" variant="outline" onClick={enviar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar código'}
          </Button>
        </div>
        {aviso ? (
          <p
            role="status"
            className={aviso.ok ? 'text-success mt-1 text-sm' : 'text-destructive mt-1 text-sm'}
          >
            {aviso.texto}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="codigo" required>
          Código recebido por SMS
        </Label>
        <Input
          id="codigo"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          error={erroDoCodigo}
        />
      </div>
    </div>
  );
}
