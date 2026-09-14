'use client';

import { useState, useTransition } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@rapidinho/ui';
import { definirPadrao, excluirEndereco } from './actions';

interface Endereco {
  id: string;
  label: string | null;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string;
  referencePoint: string | null;
  zipCode: string | null;
  isDefault: boolean;
  city: { name: string; state: string };
}

export function ListaDeEnderecos({
  enderecos,
}: {
  enderecos: Endereco[];
  cidades: { id: string; name: string; state: string }[];
}) {
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function executar(acao: () => Promise<{ ok: boolean; message?: string }>) {
    setErro(null);
    iniciarTransicao(async () => {
      const resultado = await acao();
      if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível concluir.');
    });
  }

  return (
    <div className="space-y-3">
      {erro ? <p className="text-destructive text-sm font-medium">{erro}</p> : null}

      {enderecos.map((endereco) => (
        <Card key={endereco.id}>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {endereco.label ?? endereco.street}
                  {endereco.isDefault ? (
                    <Badge variant="success" className="ml-2">
                      Principal
                    </Badge>
                  ) : null}
                </p>
                <p className="text-muted-foreground text-sm">
                  {[endereco.street, endereco.number].filter(Boolean).join(', ')} —{' '}
                  {endereco.neighborhood}
                </p>
                {endereco.complement ? (
                  <p className="text-muted-foreground text-sm">{endereco.complement}</p>
                ) : null}
                {endereco.referencePoint ? (
                  <p className="text-muted-foreground text-sm">
                    Referência: {endereco.referencePoint}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-sm">
                  {endereco.city.name}/{endereco.city.state}
                  {endereco.zipCode ? ` · ${endereco.zipCode}` : ''}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                {!endereco.isDefault ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Tornar principal"
                    disabled={pendente}
                    onClick={() => executar(() => definirPadrao({ id: endereco.id }))}
                  >
                    <Check className="h-5 w-5" aria-hidden />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir endereço"
                  disabled={pendente}
                  onClick={() => executar(() => excluirEndereco(endereco.id))}
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
