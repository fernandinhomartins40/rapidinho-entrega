'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, Label, cn } from '@rapidinho/ui';
import { excluirCategoria, reordenarCategorias, salvarCategoria } from '../produtos/actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Categoria {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  produtos: number;
}

/**
 * Reordenação do cardápio.
 *
 * Tem arrastar no desktop E setas em toda parte, de propósito: o HTML5 drag
 * and drop simplesmente não dispara em navegador de celular, e o lojista
 * costuma mexer no cardápio pelo telefone. As setas também são o único caminho
 * para quem navega por teclado.
 */
export function GerenciadorDeCategorias({ categorias }: { categorias: Categoria[] }) {
  const [ordem, setOrdem] = useState(categorias);
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const arrastando = useRef<number | null>(null);

  // A lista vem do servidor a cada revalidação; sem isto a tela ficaria com a
  // ordem antiga depois de criar ou excluir uma categoria.
  useEffect(() => setOrdem(categorias), [categorias]);

  function salvarOrdem(nova: Categoria[]) {
    setOrdem(nova);
    setErro(null);

    iniciarTransicao(async () => {
      const resultado = await reordenarCategorias({ ids: nova.map((c) => c.id) });
      if (!resultado.ok) {
        setErro(resultado.message ?? 'Não foi possível salvar a ordem.');
        setOrdem(categorias);
      }
    });
  }

  function mover(de: number, para: number) {
    if (para < 0 || para >= ordem.length) return;

    const nova = [...ordem];
    const [item] = nova.splice(de, 1);
    if (item) nova.splice(para, 0, item);
    salvarOrdem(nova);
  }

  return (
    <div className="space-y-6">
      <NovaCategoria />

      {erro ? <p className="text-destructive text-sm font-medium">{erro}</p> : null}

      {ordem.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6">
            Nenhuma categoria ainda. Sem categorias o cardápio vira uma lista só — o que funciona
            para uma loja pequena, mas atrapalha quando passa de umas 20 opções.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {ordem.map((categoria, indice) => (
            <li
              key={categoria.id}
              draggable
              onDragStart={() => {
                arrastando.current = indice;
              }}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={() => {
                const origem = arrastando.current;
                arrastando.current = null;
                if (origem != null && origem !== indice) mover(origem, indice);
              }}
            >
              <Card className={cn(!categoria.isActive && 'opacity-60')}>
                <CardContent className="flex items-center gap-2 py-3">
                  <GripVertical
                    className="text-muted-foreground hidden h-5 w-5 cursor-grab sm:block"
                    aria-hidden
                  />

                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={pendente || indice === 0}
                      onClick={() => mover(indice, indice - 1)}
                      aria-label={`Mover ${categoria.name} para cima`}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={pendente || indice === ordem.length - 1}
                      onClick={() => mover(indice, indice + 1)}
                      aria-label={`Mover ${categoria.name} para baixo`}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{categoria.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {categoria.produtos} {categoria.produtos === 1 ? 'produto' : 'produtos'}
                      {categoria.description ? ` · ${categoria.description}` : ''}
                    </p>
                  </div>

                  {!categoria.isActive ? <Badge variant="warning">Oculta</Badge> : null}

                  <BotaoExcluir categoria={categoria} onErro={setErro} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NovaCategoria() {
  const [estado, acao, pendente] = useActionState(salvarCategoria, ACTION_IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formRef.current?.reset();
  }, [estado]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={acao} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor="name">Nova categoria</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Ex.: Bebidas"
              error={estado.fieldErrors?.name}
            />
          </div>
          <div className="min-w-48 flex-1">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input id="description" name="description" placeholder="Aparece abaixo do título" />
          </div>
          <input type="hidden" name="isActive" value="on" />
          <Button type="submit" disabled={pendente}>
            <Plus className="h-5 w-5" aria-hidden />
            Criar
          </Button>
          {estado.message ? (
            <p
              role="status"
              className={cn(
                'w-full text-sm font-medium',
                estado.ok ? 'text-success' : 'text-destructive',
              )}
            >
              {estado.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function BotaoExcluir({
  categoria,
  onErro,
}: {
  categoria: Categoria;
  onErro: (mensagem: string | null) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();

  if (!confirmando) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Excluir ${categoria.name}`}
        onClick={() => setConfirmando(true)}
      >
        <Trash2 className="h-5 w-5" aria-hidden />
      </Button>
    );
  }

  return (
    <div className="flex gap-1">
      <Button
        variant="destructive"
        size="sm"
        disabled={pendente}
        onClick={() =>
          iniciarTransicao(async () => {
            const resultado = await excluirCategoria(categoria.id);
            if (!resultado.ok) onErro(resultado.message ?? 'Não foi possível excluir.');
            setConfirmando(false);
          })
        }
      >
        Excluir
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
        Não
      </Button>
    </div>
  );
}
