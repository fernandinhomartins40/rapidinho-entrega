'use client';

import { useActionState, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@rapidinho/ui';
import { centsToInput, formatCents, parseCurrencyToCents } from '@rapidinho/shared';
import {
  excluirExtra,
  excluirSabor,
  excluirTamanho,
  salvarExtra,
  salvarRegraDePreco,
  salvarSabor,
  salvarTamanho,
} from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Tamanho {
  id: string;
  name: string;
  description: string | null;
  maxFlavors: number;
  slices: number | null;
}

interface Sabor {
  id: string;
  name: string;
  description: string | null;
  groupName: string | null;
  prices: { sizeId: string; priceCents: number }[];
}

interface Extra {
  id: string;
  name: string;
  kind: string;
  priceCents: number;
}

export function GerenciadorDePizzas({
  tamanhos,
  sabores,
  extras,
  regraDePreco,
}: {
  tamanhos: Tamanho[];
  sabores: Sabor[];
  extras: Extra[];
  regraDePreco: 'HIGHEST_PRICE' | 'AVERAGE_PRICE';
}) {
  return (
    <div className="space-y-6">
      <RegraDePreco atual={regraDePreco} />
      <Tamanhos tamanhos={tamanhos} />
      {tamanhos.length > 0 ? <Sabores sabores={sabores} tamanhos={tamanhos} /> : null}
      <Extras extras={extras} />
    </div>
  );
}

function RegraDePreco({ atual }: { atual: 'HIGHEST_PRICE' | 'AVERAGE_PRICE' }) {
  const [pendente, iniciarTransicao] = useTransition();
  const [regra, setRegra] = useState(atual);

  const opcoes = [
    {
      valor: 'HIGHEST_PRICE' as const,
      titulo: 'Cobrar o sabor mais caro',
      texto: 'Meia calabresa (R$ 40) e meia portuguesa (R$ 50) custam R$ 50.',
    },
    {
      valor: 'AVERAGE_PRICE' as const,
      titulo: 'Cobrar a média dos sabores',
      texto: 'Meia calabresa (R$ 40) e meia portuguesa (R$ 50) custam R$ 45.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pizza com mais de um sabor</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            disabled={pendente}
            aria-pressed={regra === opcao.valor}
            onClick={() => {
              setRegra(opcao.valor);
              iniciarTransicao(() =>
                salvarRegraDePreco({ rule: opcao.valor }).then(() => undefined),
              );
            }}
            className={`min-h-touch rounded-xl border-2 p-4 text-left transition-colors ${
              regra === opcao.valor
                ? 'border-primary bg-accent'
                : 'border-input hover:border-primary'
            }`}
          >
            <span className="block font-semibold">{opcao.titulo}</span>
            <span className="text-muted-foreground mt-0.5 block text-sm">{opcao.texto}</span>
          </button>
        ))}
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
        <CardTitle>Tamanhos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={acao} className="flex flex-wrap items-end gap-3">
          <div className="min-w-36 flex-1">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Ex.: Grande"
              error={estado.fieldErrors?.name}
            />
          </div>
          <div className="w-32">
            <Label htmlFor="maxFlavors">Máx. sabores</Label>
            <Input
              id="maxFlavors"
              name="maxFlavors"
              type="number"
              min={1}
              max={8}
              defaultValue={2}
            />
          </div>
          <div className="w-28">
            <Label htmlFor="slices">Pedaços</Label>
            <Input id="slices" name="slices" type="number" min={1} placeholder="Opcional" />
          </div>
          <input type="hidden" name="isActive" value="on" />
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
            Cadastre os tamanhos primeiro — é neles que os preços dos sabores se apoiam.
          </p>
        ) : (
          <ul className="space-y-2">
            {tamanhos.map((tamanho) => (
              <li
                key={tamanho.id}
                className="flex items-center justify-between gap-3 border-b pb-2"
              >
                <div>
                  <p className="font-medium">{tamanho.name}</p>
                  <p className="text-muted-foreground text-sm">
                    Até {tamanho.maxFlavors} {tamanho.maxFlavors === 1 ? 'sabor' : 'sabores'}
                    {tamanho.slices ? ` · ${tamanho.slices} pedaços` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removendo}
                  aria-label={`Remover ${tamanho.name}`}
                  onClick={() =>
                    iniciarTransicao(() => excluirTamanho(tamanho.id).then(() => undefined))
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

function Sabores({ sabores, tamanhos }: { sabores: Sabor[]; tamanhos: Tamanho[] }) {
  const [editando, setEditando] = useState<Sabor | 'novo' | null>(null);
  const [removendo, iniciarTransicao] = useTransition();

  if (editando) {
    return (
      <EditorDeSabor
        sabor={editando === 'novo' ? null : editando}
        tamanhos={tamanhos}
        onFechar={() => setEditando(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sabores</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => setEditando('novo')}>
          <Plus className="h-5 w-5" aria-hidden />
          Novo sabor
        </Button>

        {sabores.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum sabor cadastrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {sabores.map((sabor) => (
              <li key={sabor.id} className="flex items-center justify-between gap-3 border-b pb-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {sabor.name}
                    {sabor.groupName ? (
                      <Badge variant="secondary" className="ml-2">
                        {sabor.groupName}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {sabor.prices
                      .map((preco) => {
                        const tamanho = tamanhos.find((t) => t.id === preco.sizeId);
                        return tamanho ? `${tamanho.name}: ${formatCents(preco.priceCents)}` : null;
                      })
                      .filter(Boolean)
                      .join(' · ') || 'Sem preço definido'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setEditando(sabor)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removendo}
                    aria-label={`Remover ${sabor.name}`}
                    onClick={() =>
                      iniciarTransicao(() => excluirSabor(sabor.id).then(() => undefined))
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

function EditorDeSabor({
  sabor,
  tamanhos,
  onFechar,
}: {
  sabor: Sabor | null;
  tamanhos: Tamanho[];
  onFechar: () => void;
}) {
  const [estado, acao, pendente] = useActionState(salvarSabor, ACTION_IDLE);
  const [nome, setNome] = useState(sabor?.name ?? '');
  const [descricao, setDescricao] = useState(sabor?.description ?? '');
  const [grupo, setGrupo] = useState(sabor?.groupName ?? '');
  const [precos, setPrecos] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      tamanhos.map((t) => [t.id, sabor?.prices.find((p) => p.sizeId === t.id)?.priceCents ?? 0]),
    ),
  );

  const payload = JSON.stringify({
    name: nome,
    description: descricao || undefined,
    groupName: grupo || undefined,
    isAvailable: true,
    // Tamanho sem preço não entra: preço zero seria pizza de graça.
    prices: Object.entries(precos)
      .filter(([, valor]) => valor > 0)
      .map(([sizeId, priceCents]) => ({ sizeId, priceCents })),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sabor ? `Editar ${sabor.name}` : 'Novo sabor'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={acao} className="space-y-4">
          {sabor ? <input type="hidden" name="id" value={sabor.id} /> : null}
          <input type="hidden" name="payload" value={payload} />

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                required
                placeholder="Ex.: Calabresa"
              />
            </div>
            <div>
              <Label htmlFor="grupo">Grupo</Label>
              <Input
                id="grupo"
                value={grupo}
                onChange={(evento) => setGrupo(evento.target.value)}
                placeholder="Ex.: Tradicionais"
              />
            </div>
            <div>
              <Label htmlFor="descricao">Ingredientes</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Molho, mussarela, calabresa"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 font-semibold">Preço em cada tamanho</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {tamanhos.map((tamanho) => (
                <div key={tamanho.id}>
                  <Label htmlFor={`preco-${tamanho.id}`}>{tamanho.name}</Label>
                  <Input
                    id={`preco-${tamanho.id}`}
                    inputMode="decimal"
                    defaultValue={precos[tamanho.id] ? centsToInput(precos[tamanho.id]!) : ''}
                    placeholder="Vazio = não vende neste tamanho"
                    onChange={(evento) =>
                      setPrecos((atual) => ({
                        ...atual,
                        [tamanho.id]: parseCurrencyToCents(evento.target.value) || 0,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {estado.message ? (
            <p className={estado.ok ? 'text-success font-medium' : 'text-destructive font-medium'}>
              {estado.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" size="lg" disabled={pendente}>
              {pendente ? 'Salvando…' : 'Salvar sabor'}
            </Button>
            <Button type="button" variant="ghost" onClick={onFechar}>
              Voltar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Extras({ extras }: { extras: Extra[] }) {
  const [estado, acao, pendente] = useActionState(salvarExtra, ACTION_IDLE);
  const [removendo, iniciarTransicao] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bordas e massas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={acao} className="flex flex-wrap items-end gap-3">
          <div className="min-w-36 flex-1">
            <Label htmlFor="extra-name">Nome</Label>
            <Input id="extra-name" name="name" required placeholder="Ex.: Borda de catupiry" />
          </div>
          <div className="w-40">
            <Label htmlFor="kind">Tipo</Label>
            <select
              id="kind"
              name="kind"
              className="border-input min-h-touch w-full rounded-lg border px-3"
              defaultValue="EDGE"
            >
              <option value="EDGE">Borda</option>
              <option value="CRUST">Massa</option>
            </select>
          </div>
          <div className="w-32">
            <Label htmlFor="extra-preco">Preço</Label>
            <Input id="extra-preco" name="priceCents" inputMode="decimal" placeholder="0,00" />
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

        {extras.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma borda ou massa cadastrada.</p>
        ) : (
          <ul className="space-y-2">
            {extras.map((extra) => (
              <li key={extra.id} className="flex items-center justify-between gap-3 border-b pb-2">
                <p>
                  {extra.name}
                  <span className="text-muted-foreground text-sm">
                    {' '}
                    · {extra.kind === 'CRUST' ? 'Massa' : 'Borda'} · {formatCents(extra.priceCents)}
                  </span>
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removendo}
                  aria-label={`Remover ${extra.name}`}
                  onClick={() =>
                    iniciarTransicao(() => excluirExtra(extra.id).then(() => undefined))
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
