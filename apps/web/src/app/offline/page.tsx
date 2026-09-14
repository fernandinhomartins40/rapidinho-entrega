import { WifiOff } from 'lucide-react';

export const metadata = { title: 'Sem conexão' };

/**
 * Tela servida pelo service worker quando não há rede.
 *
 * Estática de propósito: precisa funcionar só com o cache, sem nenhuma
 * chamada ao servidor.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
      <WifiOff className="text-muted-foreground h-12 w-12" aria-hidden />
      <h1 className="text-xl font-bold">Você está sem internet</h1>
      <p className="text-muted-foreground max-w-sm">
        As páginas que você já abriu continuam disponíveis. Para fazer um pedido é preciso conexão —
        assim a loja recebe na hora.
      </p>
    </main>
  );
}
