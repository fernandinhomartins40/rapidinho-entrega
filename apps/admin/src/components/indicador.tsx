import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@rapidinho/ui';

/** Cartão de métrica, usado nos dois painéis (plataforma e loja). */
export function Indicador({
  titulo,
  valor,
  detalhe,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{titulo}</p>
          <p className="mt-1 truncate text-2xl font-bold">{valor}</p>
          {detalhe ? <p className="text-muted-foreground mt-0.5 text-xs">{detalhe}</p> : null}
        </div>
        <Icone className="text-primary h-6 w-6 shrink-0" aria-hidden />
      </CardContent>
    </Card>
  );
}
