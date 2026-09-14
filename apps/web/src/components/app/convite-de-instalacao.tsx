'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@rapidinho/ui';

/**
 * Convite para instalar o app.
 *
 * O prompt nativo do navegador só pode ser disparado a partir de um gesto do
 * usuário, então guardamos o evento e mostramos um convite nosso.
 *
 * Aparece só depois de a pessoa ter usado o app (a partir do segundo acesso),
 * e some por 30 dias se ela dispensar: pedir instalação para quem acabou de
 * chegar é o jeito mais rápido de ser ignorado.
 */

const CHAVE_DISPENSA = 'rapidinho.instalacao.dispensada';
const CHAVE_VISITAS = 'rapidinho.visitas';
const DIAS_DE_SILENCIO = 30;

interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function podeConvidar(): boolean {
  try {
    const dispensadaEm = localStorage.getItem(CHAVE_DISPENSA);

    if (dispensadaEm) {
      const dias = (Date.now() - Number(dispensadaEm)) / (1000 * 60 * 60 * 24);
      if (dias < DIAS_DE_SILENCIO) return false;
    }

    const visitas = Number(localStorage.getItem(CHAVE_VISITAS) ?? 0) + 1;
    localStorage.setItem(CHAVE_VISITAS, String(visitas));

    return visitas >= 2;
  } catch {
    // Navegador com armazenamento bloqueado: não insiste.
    return false;
  }
}

export function ConviteDeInstalacao() {
  const [evento, setEvento] = useState<EventoDeInstalacao | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const permitido = podeConvidar();

    function capturar(e: Event) {
      // Impede o banner padrão do Chrome para mostrar o nosso, no momento
      // certo e em português.
      e.preventDefault();
      setEvento(e as EventoDeInstalacao);
      if (permitido) setVisivel(true);
    }

    window.addEventListener('beforeinstallprompt', capturar);
    return () => window.removeEventListener('beforeinstallprompt', capturar);
  }, []);

  function dispensar() {
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE_DISPENSA, String(Date.now()));
    } catch {
      // Sem persistência, some só nesta sessão.
    }
  }

  if (!visivel || !evento) return null;

  return (
    <div className="pb-safe fixed inset-x-0 bottom-16 z-50 px-4">
      <div className="bg-card mx-auto flex max-w-lg items-center gap-3 rounded-2xl border p-3 shadow-lg">
        <Download className="text-primary h-6 w-6 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Instalar o Rapidinho</p>
          <p className="text-muted-foreground text-sm">Abre mais rápido e funciona sem internet.</p>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            await evento.prompt();
            await evento.userChoice;
            setVisivel(false);
          }}
        >
          Instalar
        </Button>
        <Button variant="ghost" size="icon" aria-label="Agora não" onClick={dispensar}>
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
