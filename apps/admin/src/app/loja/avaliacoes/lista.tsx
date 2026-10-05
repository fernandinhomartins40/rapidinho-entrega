'use client';

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { Button, Card, CardContent, cn } from '@rapidinho/ui';
import { responderAvaliacao } from './actions';

export interface AvaliacaoNaTela {
  id: string;
  nota: number;
  comentario: string | null;
  resposta: string | null;
  respondidaEm: string | null;
  /** Comentário ocultado pela plataforma (ofensa): não aparece na loja. */
  oculta: boolean;
  criadaEm: string;
  pedido: string;
  cliente: string;
  itens: string[];
}

const LIMITE = 500;

/**
 * Começos de resposta por faixa de nota: um toque, e o texto continua
 * editável. Nota baixa pede desculpa e caminho; nota alta, agradecimento.
 */
function respostasProntas(nota: number, cliente: string): string[] {
  if (nota <= 3) {
    return [
      `Sentimos muito, ${cliente}. Já conversamos com a equipe para não se repetir.`,
      `Obrigado pelo retorno, ${cliente}. Chame a gente no WhatsApp para resolvermos.`,
    ];
  }
  return [
    `Obrigado, ${cliente}! Ficamos felizes que gostou. Volte sempre!`,
    `Valeu pela avaliação, ${cliente}! Até o próximo pedido.`,
  ];
}

export function ListaDeAvaliacoes({
  avaliacoes,
  vazio,
}: {
  avaliacoes: AvaliacaoNaTela[];
  vazio: string;
}) {
  if (avaliacoes.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground pt-6">{vazio}</CardContent>
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {avaliacoes.map((avaliacao) => (
        <li key={avaliacao.id} className="min-w-0">
          <CartaoDeAvaliacao avaliacao={avaliacao} />
        </li>
      ))}
    </ul>
  );
}

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Nota ${nota} de 5`} role="img">
      {[1, 2, 3, 4, 5].map((posicao) => (
        <Star
          key={posicao}
          className={cn(
            'h-4 w-4',
            posicao <= nota ? 'fill-primary text-primary' : 'text-muted-foreground/40',
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  });
}

function CartaoDeAvaliacao({ avaliacao }: { avaliacao: AvaliacaoNaTela }) {
  const [texto, setTexto] = useState('');
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const baixa = avaliacao.nota <= 2;

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await responderAvaliacao({ reviewId: avaliacao.id, texto: texto.trim() });
      if (!resultado.ok) setErro(resultado.message ?? 'Não foi possível enviar.');
    });
  }

  return (
    <Card className={cn('h-full', baixa && !avaliacao.resposta && 'border-destructive/60')}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Estrelas nota={avaliacao.nota} />
          <span className="text-muted-foreground text-xs">
            {avaliacao.cliente} · pedido #{avaliacao.pedido} · {dataCurta(avaliacao.criadaEm)}
          </span>
        </div>

        {avaliacao.itens.length > 0 ? (
          <p className="text-muted-foreground truncate text-xs">
            Pediu: {avaliacao.itens.join(', ')}
          </p>
        ) : null}

        {avaliacao.oculta ? (
          <p className="text-warning-text text-xs font-semibold">
            Comentário ocultado pela plataforma: não aparece na página da loja.
          </p>
        ) : null}
        {avaliacao.comentario ? (
          <p className="text-sm">“{avaliacao.comentario}”</p>
        ) : (
          <p className="text-muted-foreground text-sm italic">Sem comentário.</p>
        )}

        {avaliacao.resposta ? (
          <div className="bg-secondary rounded-lg px-3 py-2 text-sm">
            <p className="text-muted-foreground text-xs font-semibold">
              Sua resposta{avaliacao.respondidaEm ? ` · ${dataCurta(avaliacao.respondidaEm)}` : ''}
            </p>
            <p className="mt-0.5">{avaliacao.resposta}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {respostasProntas(avaliacao.nota, avaliacao.cliente).map((pronta) => (
                <button
                  key={pronta}
                  type="button"
                  onClick={() => setTexto(pronta)}
                  aria-pressed={texto === pronta}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-left text-xs font-medium',
                    texto === pronta ? 'border-primary bg-accent' : 'border-input',
                  )}
                >
                  {pronta}
                </button>
              ))}
            </div>
            <label htmlFor={`resposta-${avaliacao.id}`} className="sr-only">
              Resposta para {avaliacao.cliente}
            </label>
            <textarea
              id={`resposta-${avaliacao.id}`}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              maxLength={LIMITE}
              rows={2}
              placeholder="Escreva uma resposta — o cliente recebe no celular."
              className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2"
            />
            {erro ? <p className="text-destructive text-sm font-medium">{erro}</p> : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">
                {texto.length}/{LIMITE}
              </span>
              <Button
                size="sm"
                disabled={pendente || texto.trim().length < 3}
                isLoading={pendente}
                onClick={enviar}
              >
                Responder
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
