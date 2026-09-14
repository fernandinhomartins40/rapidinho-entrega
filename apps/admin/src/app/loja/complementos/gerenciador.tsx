'use client';

import { useActionState, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Label, SwitchField } from '@rapidinho/ui';
import { centsToInput, formatCents, parseCurrencyToCents } from '@rapidinho/shared';
import { excluirGrupoDeComplementos, salvarGrupoDeComplementos } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Opcao {
  id?: string;
  name: string;
  description?: string | null;
  priceCents: number;
  isAvailable: boolean;
}

interface Grupo {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  minChoices: number;
  maxChoices: number;
  allowRepeat: boolean;
  isActive: boolean;
  produtos: number;
  options: Opcao[];
}

export function GerenciadorDeComplementos({ grupos }: { grupos: Grupo[] }) {
  const [editando, setEditando] = useState<Grupo | 'novo' | null>(null);

  if (editando) {
    return (
      <EditorDeGrupo
        grupo={editando === 'novo' ? null : editando}
        onFechar={() => setEditando(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditando('novo')} size="lg">
        <Plus className="h-5 w-5" aria-hidden />
        Novo grupo
      </Button>

      {grupos.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6">
            Nenhum grupo ainda. Se você vende hambúrguer, pizza ou marmita, é aqui que entram as
            escolhas que o cliente faz antes de adicionar ao carrinho.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {grupos.map((grupo) => (
            <li key={grupo.id}>
              <Card>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {grupo.name}
                        {grupo.isRequired ? (
                          <Badge variant="warning" className="ml-2">
                            Obrigatório
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Escolhe de {grupo.minChoices} a {grupo.maxChoices} · {grupo.produtos}{' '}
                        {grupo.produtos === 1 ? 'produto' : 'produtos'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditando(grupo)}>
                        Editar
                      </Button>
                      <BotaoExcluirGrupo grupo={grupo} />
                    </div>
                  </div>

                  <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {grupo.options.map((opcao) => (
                      <li key={opcao.id}>
                        {opcao.name}
                        {opcao.priceCents > 0 ? ` +${formatCents(opcao.priceCents)}` : ''}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const OPCAO_VAZIA: Opcao = { name: '', priceCents: 0, isAvailable: true };

function EditorDeGrupo({ grupo, onFechar }: { grupo: Grupo | null; onFechar: () => void }) {
  const [estado, acao, pendente] = useActionState(salvarGrupoDeComplementos, ACTION_IDLE);

  const [nome, setNome] = useState(grupo?.name ?? '');
  const [descricao, setDescricao] = useState(grupo?.description ?? '');
  const [obrigatorio, setObrigatorio] = useState(grupo?.isRequired ?? false);
  const [minimo, setMinimo] = useState(grupo?.minChoices ?? 0);
  const [maximo, setMaximo] = useState(grupo?.maxChoices ?? 1);
  const [permiteRepetir, setPermiteRepetir] = useState(grupo?.allowRepeat ?? false);
  const [opcoes, setOpcoes] = useState<Opcao[]>(grupo?.options ?? [{ ...OPCAO_VAZIA }]);

  function alterarOpcao(indice: number, mudanca: Partial<Opcao>) {
    setOpcoes((atual) =>
      atual.map((opcao, i) => (i === indice ? { ...opcao, ...mudanca } : opcao)),
    );
  }

  // O grupo inteiro vai num campo JSON: a lista de opções é dinâmica, e
  // inventar nomes tipo `opcao[3][preco]` no FormData seria pior de ler.
  const payload = JSON.stringify({
    name: nome,
    description: descricao || undefined,
    isRequired: obrigatorio,
    minChoices: obrigatorio ? Math.max(1, minimo) : minimo,
    maxChoices: maximo,
    allowRepeat: permiteRepetir,
    isActive: true,
    options: opcoes
      .filter((opcao) => opcao.name.trim() !== '')
      .map((opcao) => ({
        ...(opcao.id ? { id: opcao.id } : {}),
        name: opcao.name.trim(),
        description: opcao.description || undefined,
        priceCents: opcao.priceCents,
        isAvailable: opcao.isAvailable,
      })),
  });

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={acao} className="space-y-5">
          {grupo ? <input type="hidden" name="id" value={grupo.id} /> : null}
          <input type="hidden" name="payload" value={payload} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nome">Nome do grupo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(evento) => setNome(evento.target.value)}
                required
                placeholder="Ex.: Adicionais"
                error={estado.fieldErrors?.name}
              />
            </div>
            <div>
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(evento) => setDescricao(evento.target.value)}
                placeholder="Aparece acima das opções"
              />
            </div>
          </div>

          <SwitchField
            checked={obrigatorio}
            onCheckedChange={setObrigatorio}
            label="O cliente é obrigado a escolher"
            description="Use para coisas como o ponto da carne, onde não existe pedido sem resposta."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="minimo">Mínimo de escolhas</Label>
              <Input
                id="minimo"
                type="number"
                min={obrigatorio ? 1 : 0}
                max={maximo}
                value={minimo}
                onChange={(evento) => setMinimo(Number(evento.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="maximo">Máximo de escolhas</Label>
              <Input
                id="maximo"
                type="number"
                min={1}
                value={maximo}
                onChange={(evento) => setMaximo(Number(evento.target.value))}
                error={estado.fieldErrors?.maxChoices}
              />
            </div>
          </div>

          <SwitchField
            checked={permiteRepetir}
            onCheckedChange={setPermiteRepetir}
            label="Permitir repetir a mesma opção"
            description="Ex.: 2x bacon no mesmo lanche."
          />

          <div>
            <p className="mb-2 font-semibold">Opções</p>
            <ul className="space-y-2">
              {opcoes.map((opcao, indice) => (
                <li key={opcao.id ?? indice} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1">
                    <Label htmlFor={`opcao-${indice}`}>Nome</Label>
                    <Input
                      id={`opcao-${indice}`}
                      value={opcao.name}
                      onChange={(evento) => alterarOpcao(indice, { name: evento.target.value })}
                      placeholder="Ex.: Bacon"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`preco-${indice}`}>Preço a mais</Label>
                    <Input
                      id={`preco-${indice}`}
                      inputMode="decimal"
                      defaultValue={centsToInput(opcao.priceCents)}
                      onChange={(evento) =>
                        alterarOpcao(indice, {
                          priceCents: parseCurrencyToCents(evento.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover opção ${opcao.name || indice + 1}`}
                    onClick={() => setOpcoes((atual) => atual.filter((_, i) => i !== indice))}
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => setOpcoes((atual) => [...atual, { ...OPCAO_VAZIA }])}
            >
              <Plus className="h-5 w-5" aria-hidden />
              Adicionar opção
            </Button>
          </div>

          {estado.message ? (
            <p
              role="status"
              className={estado.ok ? 'text-success font-medium' : 'text-destructive font-medium'}
            >
              {estado.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" size="lg" disabled={pendente}>
              {pendente ? 'Salvando…' : 'Salvar grupo'}
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

function BotaoExcluirGrupo({ grupo }: { grupo: Grupo }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!confirmando) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Excluir ${grupo.name}`}
        onClick={() => setConfirmando(true)}
      >
        <Trash2 className="h-5 w-5" aria-hidden />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {erro ? <span className="text-destructive text-sm">{erro}</span> : null}
      <Button
        variant="destructive"
        size="sm"
        onClick={async () => {
          const resultado = await excluirGrupoDeComplementos(grupo.id);
          if (!resultado.ok) setErro(resultado.message ?? 'Falhou');
          else setConfirmando(false);
        }}
      >
        Excluir
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
        Não
      </Button>
    </div>
  );
}
