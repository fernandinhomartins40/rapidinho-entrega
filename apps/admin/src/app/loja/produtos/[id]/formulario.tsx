'use client';

import { useActionState, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ImageUploader,
  Input,
  Label,
  SwitchField,
} from '@rapidinho/ui';
import { centsToInput } from '@rapidinho/shared';
import { atualizarProduto } from '../actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Props {
  produto: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    compareAtPriceCents: number | null;
    categoryId: string | null;
    imageId: string | null;
    imagemUrl: string | null;
    sellingUnit: string;
    weightStepGrams: number | null;
    minWeightGrams: number | null;
    sku: string | null;
    barcode: string | null;
    isAvailable: boolean;
    isFeatured: boolean;
    stockQuantity: number | null;
    sortOrder: number;
    gruposSelecionados: string[];
  };
  categorias: { id: string; name: string }[];
  gruposDeComplemento: { id: string; name: string; isRequired: boolean }[];
}

export function FormularioDeProduto({ produto, categorias, gruposDeComplemento }: Props) {
  const [estado, acao, pendente] = useActionState(atualizarProduto, ACTION_IDLE);
  const [imagemId, setImagemId] = useState<string | null>(produto.imageId);
  const [porPeso, setPorPeso] = useState(produto.sellingUnit === 'WEIGHT_KG');

  return (
    <form action={acao} className="space-y-6">
      <input type="hidden" name="id" value={produto.id} />
      <input type="hidden" name="imageId" value={imagemId ?? ''} />
      <input type="hidden" name="sellingUnit" value={porPeso ? 'WEIGHT_KG' : 'UNIT'} />

      <Card>
        <CardHeader>
          <CardTitle>O essencial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <ImageUploader
            context="PRODUCT"
            value={imagemId}
            previewUrl={produto.imagemUrl}
            onChange={setImagemId}
            label="Foto do produto"
          />

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                defaultValue={produto.name}
                required
                error={estado.fieldErrors?.name}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="priceCents">{porPeso ? 'Preço do quilo' : 'Preço'}</Label>
                <Input
                  id="priceCents"
                  name="priceCents"
                  inputMode="decimal"
                  defaultValue={centsToInput(produto.priceCents)}
                  required
                  error={estado.fieldErrors?.priceCents}
                />
              </div>
              <div>
                <Label htmlFor="compareAtPriceCents">Preço &quot;de&quot; (riscado)</Label>
                <Input
                  id="compareAtPriceCents"
                  name="compareAtPriceCents"
                  inputMode="decimal"
                  defaultValue={
                    produto.compareAtPriceCents ? centsToInput(produto.compareAtPriceCents) : ''
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input id="description" name="description" defaultValue={produto.description ?? ''} />
            </div>

            <div>
              <Label htmlFor="categoryId">Categoria</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={produto.categoryId ?? ''}
                className="border-input min-h-touch w-full rounded-lg border px-3"
              >
                <option value="">Sem categoria</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Venda e estoque</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchField
            name="isAvailable"
            defaultChecked={produto.isAvailable}
            label="Disponível para venda"
          />
          <SwitchField
            name="isFeatured"
            defaultChecked={produto.isFeatured}
            label="Destacar no cardápio"
          />

          <div className="border-t pt-4">
            <SwitchField
              checked={porPeso}
              onCheckedChange={setPorPeso}
              label="Vendido por peso (açougue, frios, granel)"
            />

            {porPeso ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="weightStepGrams">Vender de quantos em quantos gramas</Label>
                  <Input
                    id="weightStepGrams"
                    name="weightStepGrams"
                    type="number"
                    min={10}
                    step={10}
                    defaultValue={produto.weightStepGrams ?? 100}
                  />
                </div>
                <div>
                  <Label htmlFor="minWeightGrams">Peso mínimo (gramas)</Label>
                  <Input
                    id="minWeightGrams"
                    name="minWeightGrams"
                    type="number"
                    min={10}
                    step={10}
                    defaultValue={produto.minWeightGrams ?? 100}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="stockQuantity">Estoque</Label>
              <Input
                id="stockQuantity"
                name="stockQuantity"
                type="number"
                min={0}
                defaultValue={produto.stockQuantity ?? ''}
                placeholder="Deixe vazio para não controlar"
              />
            </div>
            <div>
              <Label htmlFor="sku">Código interno</Label>
              <Input id="sku" name="sku" defaultValue={produto.sku ?? ''} />
            </div>
            <div>
              <Label htmlFor="barcode">Código de barras</Label>
              <Input id="barcode" name="barcode" defaultValue={produto.barcode ?? ''} />
            </div>
          </div>
        </CardContent>
      </Card>

      {gruposDeComplemento.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Complementos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-sm">
              Marque os grupos que aparecem quando o cliente escolhe este produto.
            </p>
            <ul className="space-y-2">
              {gruposDeComplemento.map((grupo) => (
                <li key={grupo.id}>
                  <label className="min-h-touch flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="complementGroupIds"
                      value={grupo.id}
                      defaultChecked={produto.gruposSelecionados.includes(grupo.id)}
                      className="h-5 w-5"
                    />
                    <span>
                      {grupo.name}
                      {grupo.isRequired ? (
                        <span className="text-muted-foreground text-sm"> (obrigatório)</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <input type="hidden" name="sortOrder" value={produto.sortOrder} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pendente}>
          {pendente ? 'Salvando…' : 'Salvar alterações'}
        </Button>
        {estado.message ? (
          <p
            role="status"
            className={estado.ok ? 'text-success font-medium' : 'text-destructive font-medium'}
          >
            {estado.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
