'use client';

import { useActionState, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ImageUploader,
  Input,
  Label,
  Select,
} from '@rapidinho/ui';
import { BOOST_PLACEMENT_LABEL } from '@rapidinho/shared';
import { criarBanner } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

export function BannerDialog({
  cidades,
  lojas,
}: {
  cidades: { id: string; name: string; state: string }[];
  lojas: { id: string; name: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [imageId, setImageId] = useState<string | null>(null);
  const [state, enviar, enviando] = useActionState(criarBanner, ACTION_IDLE);

  useEffect(() => {
    if (state.ok) {
      setAberto(false);
      setImageId(null);
    }
  }, [state]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-5 w-5" aria-hidden />
          Novo banner
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo banner</DialogTitle>
          <DialogDescription>
            A imagem é recortada em 21:9 e otimizada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="space-y-4">
          <input type="hidden" name="imageId" value={imageId ?? ''} />

          <ImageUploader
            context="PROMO_BANNER"
            value={imageId}
            onChange={setImageId}
            label="Imagem do banner"
            helperText="Faixa larga, 21:9. Evite texto pequeno — muita gente vê no celular."
          />

          <div>
            <Label htmlFor="title" required>
              Título
            </Label>
            <Input
              id="title"
              name="title"
              placeholder="Frete grátis nas farmácias"
              error={state.fieldErrors?.title}
              required
            />
          </div>

          <div>
            <Label htmlFor="linkUrl">Link ao tocar</Label>
            <Input id="linkUrl" name="linkUrl" type="url" placeholder="https://…" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cityId">Cidade</Label>
              <Select id="cityId" name="cityId" defaultValue="">
                <option value="">Todas as cidades</option>
                {cidades.map((cidade) => (
                  <option key={cidade.id} value={cidade.id}>
                    {cidade.name} — {cidade.state}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="storeId">Loja em destaque</Label>
              <Select id="storeId" name="storeId" defaultValue="">
                <option value="">Nenhuma</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="placement">Posição</Label>
              <Select id="placement" name="placement" defaultValue="TOP_BANNER">
                {Object.entries(BOOST_PLACEMENT_LABEL).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sortOrder">Ordem</Label>
              <Input id="sortOrder" name="sortOrder" inputMode="numeric" defaultValue={0} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="startsAt">Começa em</Label>
              <Input id="startsAt" name="startsAt" type="date" />
            </div>
            <div>
              <Label htmlFor="endsAt">Termina em</Label>
              <Input id="endsAt" name="endsAt" type="date" />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked
              className="accent-primary h-5 w-5"
            />
            <span className="text-sm font-medium">Publicar agora</span>
          </label>

          {state.message && !state.ok ? <Alert variant="destructive">{state.message}</Alert> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={enviando} disabled={!imageId}>
              Publicar banner
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
