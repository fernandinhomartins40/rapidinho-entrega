'use client';

import { useActionState, useRef, useState } from 'react';
import { Send, Users } from 'lucide-react';
import { Alert, Button, Card, CardContent, Input, Label, Select } from '@rapidinho/ui';
import { PUBLICO_LABEL, PUBLICOS } from '@rapidinho/shared';
import { contarAlcance, enviarCampanha } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

const LIMITE_TITULO = 60;
const LIMITE_MENSAGEM = 180;

/**
 * Composição da campanha.
 *
 * O contador de caracteres não é enfeite: o que passa do limite some na prévia
 * da notificação, e quem escreveu não tem como saber disso depois de enviar.
 *
 * O botão de alcance existe pelo mesmo motivo — push é o canal mais fácil de
 * queimar, e um filtro errado só apareceria como reclamação depois.
 */
export function FormularioDeCampanha({
  cidades,
}: {
  cidades: { id: string; name: string; state: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [estadoEnvio, enviar, enviando] = useActionState(enviarCampanha, ACTION_IDLE);
  const [estadoAlcance, contar, contando] = useActionState(contarAlcance, ACTION_IDLE);

  return (
    <Card>
      <CardContent className="pt-6">
        <form ref={formRef} action={enviar} className="space-y-5">
          <div>
            <Label htmlFor="title" required>
              Título
            </Label>
            <Input
              id="title"
              name="title"
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
              maxLength={LIMITE_TITULO}
              placeholder="Frete grátis hoje em Palmital"
              error={estadoEnvio.fieldErrors?.title}
              required
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {titulo.length}/{LIMITE_TITULO} — o que passar disso some na prévia do celular.
            </p>
          </div>

          <div>
            <Label htmlFor="body" required>
              Mensagem
            </Label>
            <textarea
              id="body"
              name="body"
              value={mensagem}
              onChange={(evento) => setMensagem(evento.target.value)}
              maxLength={LIMITE_MENSAGEM}
              rows={3}
              required
              className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2"
              placeholder="As farmácias estão sem taxa de entrega até as 22h."
            />
            <p className="text-muted-foreground mt-1 text-xs">
              {mensagem.length}/{LIMITE_MENSAGEM}
            </p>
            {estadoEnvio.fieldErrors?.body ? (
              <p className="text-destructive mt-1 text-sm">{estadoEnvio.fieldErrors.body}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="linkUrl">Abrir ao tocar</Label>
            <Input
              id="linkUrl"
              name="linkUrl"
              placeholder="/palmital-pr"
              error={estadoEnvio.fieldErrors?.linkUrl}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Caminho dentro do app. Link para fora não é aceito — é o formato que um golpe
              imitaria.
            </p>
          </div>

          <fieldset className="space-y-4 border-t pt-5">
            <legend className="sr-only">Quem recebe</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="publico">Público</Label>
                <Select id="publico" name="publico" defaultValue="CUSTOMERS">
                  {PUBLICOS.map((publico) => (
                    <option key={publico} value={publico}>
                      {PUBLICO_LABEL[publico]}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="inativoHaDias">Sem pedir há</Label>
                <Select id="inativoHaDias" name="inativoHaDias" defaultValue="">
                  <option value="">Não filtrar</option>
                  <option value="15">15 dias</option>
                  <option value="30">30 dias</option>
                  <option value="60">60 dias</option>
                  <option value="90">90 dias</option>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="cityIds">Cidades</Label>
              <Select id="cityIds" name="cityIds" multiple size={Math.min(cidades.length, 5)}>
                {cidades.map((cidade) => (
                  <option key={cidade.id} value={cidade.id}>
                    {cidade.name} — {cidade.state}
                  </option>
                ))}
              </Select>
              <p className="text-muted-foreground mt-1 text-xs">
                Nenhuma marcada = todas as cidades.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="apenasComPedido"
                className="border-input h-4 w-4 rounded border"
              />
              Só quem já fez ao menos um pedido
            </label>
          </fieldset>

          {estadoAlcance.message ? (
            <Alert variant={estadoAlcance.ok ? 'info' : 'destructive'}>
              {estadoAlcance.message}
            </Alert>
          ) : null}

          {estadoEnvio.message ? (
            <Alert variant={estadoEnvio.ok ? 'success' : 'destructive'}>
              {estadoEnvio.message}
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-3 border-t pt-5">
            <Button type="submit" disabled={enviando}>
              <Send className="h-5 w-5" aria-hidden />
              {enviando ? 'Enviando…' : 'Enviar campanha'}
            </Button>

            {/*
              `formAction` reaproveita o mesmo formulário para contar o alcance:
              os filtros são exatamente os mesmos, e duplicá-los num segundo
              formulário abriria espaço para a prévia divergir do envio.
            */}
            <Button type="submit" variant="outline" formAction={contar} disabled={contando}>
              <Users className="h-5 w-5" aria-hidden />
              {contando ? 'Contando…' : 'Ver alcance'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
