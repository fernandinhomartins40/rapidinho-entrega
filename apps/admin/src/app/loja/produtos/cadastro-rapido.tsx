'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, CardContent, ImageUploader, Input, Label } from '@rapidinho/ui';
import { criarProdutoRapido } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

/**
 * Cadastro em menos de 30 segundos.
 *
 * Três campos visíveis — nome, preço e foto — porque é o mínimo que o cliente
 * precisa ver para comprar. Categoria e descrição ficam recolhidas: quem quer
 * usa, quem não quer não é atrapalhado.
 *
 * O formulário não fecha depois de salvar, e o foco volta para o nome: quem
 * está cadastrando raramente cadastra um item só.
 */
export function CadastroRapido({ categorias }: { categorias: { id: string; name: string }[] }) {
  const [estado, acao, pendente] = useActionState(criarProdutoRapido, ACTION_IDLE);
  const [imagemId, setImagemId] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estado.ok) {
      formRef.current?.reset();
      setImagemId(null);
      nomeRef.current?.focus();
    }
  }, [estado]);

  return (
    <Card>
      <CardContent className="pt-5">
        <form ref={formRef} action={acao} className="space-y-4">
          <input type="hidden" name="imageId" value={imagemId ?? ''} />

          <div className="grid gap-4 sm:grid-cols-[8rem_1fr_10rem]">
            <ImageUploader
              context="PRODUCT"
              value={imagemId}
              onChange={setImagemId}
              label="Foto"
              helperText="Opcional"
            />

            <div>
              <Label htmlFor="name">Nome do produto</Label>
              <Input
                ref={nomeRef}
                id="name"
                name="name"
                required
                autoComplete="off"
                placeholder="Ex.: Arroz 5 kg"
                error={estado.fieldErrors?.name}
              />
            </div>

            <div>
              <Label htmlFor="priceCents">Preço</Label>
              <Input
                id="priceCents"
                name="priceCents"
                required
                inputMode="decimal"
                placeholder="0,00"
                error={estado.fieldErrors?.priceCents}
              />
            </div>
          </div>

          {detalhes ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="categoryId">Categoria</Label>
                <select
                  id="categoryId"
                  name="categoryId"
                  className="border-input min-h-touch w-full rounded-lg border px-3"
                  defaultValue=""
                >
                  <option value="">Sem categoria</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Aparece na página do produto"
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pendente} size="lg">
              <Plus className="h-5 w-5" aria-hidden />
              {pendente ? 'Salvando…' : 'Adicionar ao cardápio'}
            </Button>

            <button
              type="button"
              onClick={() => setDetalhes((aberto) => !aberto)}
              className="text-muted-foreground text-sm underline"
            >
              {detalhes ? 'Esconder categoria e descrição' : 'Categoria e descrição'}
            </button>

            {estado.message ? (
              <p
                role="status"
                className={
                  estado.ok
                    ? 'text-success text-sm font-medium'
                    : 'text-destructive text-sm font-medium'
                }
              >
                {estado.message}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
