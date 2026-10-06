'use client';

import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button } from '@rapidinho/ui';

/**
 * Link que abre o app gateway já configurado. O token fica escondido até
 * alguém pedir: a página pode estar aberta numa tela que outros veem.
 */
export function TokenDoGateway({ servidor, token }: { servidor: string; token: string }) {
  const [mostrar, setMostrar] = useState(false);
  const link = `rapidinhosms://configurar?servidor=${encodeURIComponent(servidor)}&token=${encodeURIComponent(token)}`;

  return (
    <div className="space-y-3">
      <Button asChild size="lg" block className="h-auto whitespace-normal py-3 text-center">
        <a href={link}>
          <Smartphone className="h-5 w-5" aria-hidden />
          Configurar o app neste celular
        </a>
      </Button>
      <div className="bg-secondary space-y-1 rounded-lg p-3">
        <p>
          Servidor: <code className="break-all">{servidor}</code>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          Token: <code className="break-all">{mostrar ? token : '•'.repeat(16)}</code>
          <button type="button" className="underline" onClick={() => setMostrar((v) => !v)}>
            {mostrar ? 'Esconder' : 'Mostrar'}
          </button>
        </p>
      </div>
    </div>
  );
}
