'use client';

import { useActionState, useState, useTransition } from 'react';
import { PauseCircle, PlayCircle, Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@rapidinho/ui';
import { cardapioDaSemana, centsToInput, formatCents, NOMES_DOS_DIAS } from '@rapidinho/shared';
import { pausarItem, removerItem, removerTamanho, salvarItem, salvarTamanho } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

type Papel = 'NO_PRATO' | 'MISTURA' | 'EXTRA';

interface Tamanho {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  maxMisturas: number;
}

interface Item {
  id: string;
  name: string;
  kind: Papel;
  groupName: string | null;
  priceCents: number;
  weekdays: number[];
  acabouHoje: boolean;
  noCardapioDeHoje: boolean;
}

const PAPEIS: { valor: Papel; titulo: string; texto: string }[] = [
  {
    valor: 'MISTURA',
    titulo: 'Misturas',
    texto: 'A carne do dia. O cliente escolhe até o máximo do tamanho.',
  },
  {
    valor: 'NO_PRATO',
    titulo: 'Vem no prato',
    texto: 'Arroz, feijão, salada… O cliente pode pedir sem, pouco ou mais.',
  },
  { valor: 'EXTRA', titulo: 'Extras pagos', texto: 'Ovo frito, farofa extra, refrigerante.' },
];

export function GerenciadorDeMarmitas({
  hoje,
  tamanhos,
  itens,
}: {
  hoje: number;
  tamanhos: Tamanho[];
  itens: Item[];
}) {
  const semMistura = !itens.some((item) => item.kind === 'MISTURA' && item.noCardapioDeHoje);

  return (
    <div className="space-y-6">
      <Tamanhos tamanhos={tamanhos} />
      {tamanhos.length > 0 && semMistura ? (
        <Alert
          variant="warning"
          title={`Nenhuma mistura no cardápio de hoje (${NOMES_DOS_DIAS[hoje]})`}
        >
          A marmita não aparece para o cliente até você cadastrar ou liberar uma mistura para hoje.
        </Alert>
      ) : null}
      <CardapioDaSemana hoje={hoje} itens={itens} />
      {PAPEIS.map((papel) => (
        <Itens
          key={papel.valor}
          papel={papel}
          hoje={hoje}
          itens={itens.filter((item) => item.kind === papel.valor)}
        />
      ))}
    </div>
  );
}

/** Confere a semana inteira de uma vez; os dias de cada item se mudam em "Editar". */
function CardapioDaSemana({ hoje, itens }: { hoje: number; itens: Item[] }) {
  if (itens.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cardápio da semana</CardTitle>
        <p className="text-muted-foreground text-sm">
          O cliente vê esta semana no app. Item sem dia marcado sai todo dia.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cardapioDaSemana(itens, hoje).map((dia) => (
            <li key={dia.dia} className="rounded-lg border p-3">
              <p className="mb-2 font-bold capitalize">
                {dia.hoje ? `Hoje (${dia.nome})` : dia.nome}
              </p>
              {PAPEIS.map((papel) => {
                const doPapel = dia.itens.filter((item) => item.kind === papel.valor);
                return doPapel.length ? (
                  <p key={papel.valor} className="text-sm">
                    <span className="font-semibold">{papel.titulo}: </span>
                    {doPapel.map((item) => item.name).join(', ')}
                  </p>
                ) : null;
              })}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Tamanhos({ tamanhos }: { tamanhos: Tamanho[] }) {
  const [estado, acao, pendente] = useActionState(salvarTamanho, ACTION_IDLE);
  const [removendo, iniciarTransicao] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tamanhos e preços</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={acao} className="flex flex-wrap items-end gap-3">
          <div className="min-w-36 flex-1">
            <Label htmlFor="tamanho-nome">Nome</Label>
            <Input
              id="tamanho-nome"
              name="name"
              required
              placeholder="Ex.: Média"
              error={estado.fieldErrors?.name}
            />
          </div>
          <div className="w-32">
            <Label htmlFor="tamanho-preco">Preço</Label>
            <Input
              id="tamanho-preco"
              name="priceCents"
              inputMode="decimal"
              required
              placeholder="22,00"
            />
          </div>
          <div className="w-32">
            <Label htmlFor="tamanho-misturas">Misturas</Label>
            <Input
              id="tamanho-misturas"
              name="maxMisturas"
              type="number"
              min={1}
              max={4}
              defaultValue={1}
            />
          </div>
          <div className="min-w-44 flex-1">
            <Label htmlFor="tamanho-descricao">Descrição</Label>
            <Input id="tamanho-descricao" name="description" placeholder="Ex.: Serve 1 pessoa" />
          </div>
          <Button type="submit" disabled={pendente}>
            <Plus className="h-5 w-5" aria-hidden />
            Adicionar
          </Button>
        </form>

        {estado.message ? (
          <p className={estado.ok ? 'text-success text-sm' : 'text-destructive text-sm'}>
            {estado.message}
          </p>
        ) : null}

        {tamanhos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Cadastre os tamanhos primeiro (P, M, G): o preço da marmita é o do tamanho.
          </p>
        ) : (
          <ul className="space-y-2">
            {tamanhos.map((tamanho) => (
              <li
                key={tamanho.id}
                className="flex items-center justify-between gap-3 border-b pb-2"
              >
                <div>
                  <p className="font-medium">
                    {tamanho.name} · {formatCents(tamanho.priceCents)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Até {tamanho.maxMisturas} {tamanho.maxMisturas === 1 ? 'mistura' : 'misturas'}
                    {tamanho.description ? ` · ${tamanho.description}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removendo}
                  aria-label={`Remover ${tamanho.name}`}
                  onClick={() =>
                    iniciarTransicao(() => removerTamanho(tamanho.id).then(() => undefined))
                  }
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Itens({
  papel,
  hoje,
  itens,
}: {
  papel: (typeof PAPEIS)[number];
  hoje: number;
  itens: Item[];
}) {
  const [editando, setEditando] = useState<Item | 'novo' | null>(null);
  const [mexendo, iniciarTransicao] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{papel.titulo}</CardTitle>
        <p className="text-muted-foreground text-sm">{papel.texto}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {editando ? (
          <EditorDeItem
            papel={papel.valor}
            item={editando === 'novo' ? null : editando}
            onFechar={() => setEditando(null)}
          />
        ) : (
          <Button variant="outline" onClick={() => setEditando('novo')}>
            <Plus className="h-5 w-5" aria-hidden />
            Adicionar
          </Button>
        )}

        {itens.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nada cadastrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {itens.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 border-b pb-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.name}
                    {item.groupName ? (
                      <Badge variant="secondary" className="ml-2">
                        {item.groupName}
                      </Badge>
                    ) : null}
                    {item.acabouHoje ? (
                      <Badge variant="warning" className="ml-2">
                        Acabou hoje
                      </Badge>
                    ) : !item.noCardapioDeHoje ? (
                      <Badge variant="secondary" className="ml-2">
                        Não sai hoje
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {item.weekdays.length === 0
                      ? 'Todo dia'
                      : item.weekdays.map((dia) => NOMES_DOS_DIAS[dia]).join(', ')}
                    {item.priceCents > 0
                      ? ` · ${item.kind === 'MISTURA' ? '+ ' : ''}${formatCents(item.priceCents)}`
                      : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {item.weekdays.length === 0 || item.weekdays.includes(hoje) ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={mexendo}
                      aria-label={
                        item.acabouHoje
                          ? `Voltar ${item.name} ao cardápio de hoje`
                          : `${item.name} acabou: tirar até amanhã`
                      }
                      title={item.acabouHoje ? 'Voltar ao cardápio' : 'Acabou: tirar até amanhã'}
                      onClick={() =>
                        iniciarTransicao(() =>
                          pausarItem({ id: item.id, pausar: !item.acabouHoje }).then(
                            () => undefined,
                          ),
                        )
                      }
                    >
                      {item.acabouHoje ? (
                        <PlayCircle className="h-5 w-5" aria-hidden />
                      ) : (
                        <PauseCircle className="h-5 w-5" aria-hidden />
                      )}
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => setEditando(item)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={mexendo}
                    aria-label={`Remover ${item.name}`}
                    onClick={() =>
                      iniciarTransicao(() => removerItem(item.id).then(() => undefined))
                    }
                  >
                    <Trash2 className="h-5 w-5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EditorDeItem({
  papel,
  item,
  onFechar,
}: {
  papel: Papel;
  item: Item | null;
  onFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState(salvarItem, ACTION_IDLE);
  const [dias, setDias] = useState<number[]>(item?.weekdays ?? []);
  const prefixo = `${papel}-${item?.id ?? 'novo'}`;

  return (
    <form action={acao} className="bg-muted/40 space-y-4 rounded-xl border p-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="kind" value={papel} />
      {dias.map((dia) => (
        <input key={dia} type="hidden" name="weekdays" value={dia} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${prefixo}-nome`}>Nome</Label>
          <Input
            id={`${prefixo}-nome`}
            name="name"
            required
            defaultValue={item?.name}
            placeholder={
              papel === 'MISTURA'
                ? 'Ex.: Frango grelhado'
                : papel === 'EXTRA'
                  ? 'Ex.: Ovo frito'
                  : 'Ex.: Feijão'
            }
            error={estado.fieldErrors?.name}
          />
        </div>
        {papel === 'NO_PRATO' ? (
          <div>
            <Label htmlFor={`${prefixo}-grupo`}>Grupo</Label>
            <Input
              id={`${prefixo}-grupo`}
              name="groupName"
              defaultValue={item?.groupName ?? ''}
              placeholder="Ex.: Base, Acompanhamentos, Salada"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor={`${prefixo}-preco`}>
              {papel === 'MISTURA' ? 'Acréscimo (opcional)' : 'Preço'}
            </Label>
            <Input
              id={`${prefixo}-preco`}
              name="priceCents"
              inputMode="decimal"
              required={papel === 'EXTRA'}
              defaultValue={item?.priceCents ? centsToInput(item.priceCents) : ''}
              placeholder={papel === 'MISTURA' ? 'Vazio = sem acréscimo' : '2,00'}
              error={estado.fieldErrors?.priceCents}
            />
          </div>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">Em que dias sai</legend>
        <div className="flex flex-wrap gap-2">
          {NOMES_DOS_DIAS.map((nome, dia) => {
            const marcado = dias.includes(dia);
            return (
              <button
                key={nome}
                type="button"
                aria-pressed={marcado}
                onClick={() =>
                  setDias((atual) =>
                    marcado ? atual.filter((d) => d !== dia) : [...atual, dia].sort(),
                  )
                }
                className={`min-h-touch min-w-14 rounded-lg border-2 px-3 font-semibold capitalize transition-colors ${
                  marcado ? 'border-primary bg-accent' : 'border-input hover:border-primary'
                }`}
              >
                {nome}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {dias.length === 0 || dias.length === 7
            ? 'Sai todo dia.'
            : 'Só aparece para o cliente nos dias marcados.'}
        </p>
      </fieldset>

      {estado.message ? (
        <p className={estado.ok ? 'text-success font-medium' : 'text-destructive font-medium'}>
          {estado.message}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button type="button" variant="ghost" onClick={onFechar}>
          {estado.ok ? 'Fechar' : 'Cancelar'}
        </Button>
      </div>
    </form>
  );
}
