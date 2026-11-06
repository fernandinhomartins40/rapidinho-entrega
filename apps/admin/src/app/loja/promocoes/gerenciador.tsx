'use client';

import { useActionState, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ImageUploader,
  Input,
  Label,
} from '@rapidinho/ui';
import { formatCents } from '@rapidinho/shared';
import { alternarPromocao, excluirPromocao, salvarPromocao } from './actions';
import { ACTION_IDLE } from '@/lib/action-state';

interface Produto {
  id: string;
  name: string;
  priceCents: number;
  compareAtPriceCents: number | null;
}

interface Promocao {
  id: string;
  title: string;
  subtitle: string | null;
  imageId: string | null;
  imagemUrl: string | null;
  isActive: boolean;
  endsAt: string | null;
  productIds: string[];
}

function dataNoFormulario(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : '';
}

function semAcento(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function Formulario({
  promocao,
  produtos,
  aoCancelar,
}: {
  promocao: Promocao | null;
  produtos: Produto[];
  aoCancelar: () => void;
}) {
  const [estado, acao, pendente] = useActionState(salvarPromocao, ACTION_IDLE);
  const [imageId, setImageId] = useState(promocao?.imageId ?? null);
  const [escolhidos, setEscolhidos] = useState<string[]>(promocao?.productIds ?? []);
  const [busca, setBusca] = useState('');

  const termo = semAcento(busca.trim());
  const visiveis = produtos.filter((produto) => semAcento(produto.name).includes(termo));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{promocao ? 'Editar promoção' : 'Nova promoção'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={acao} className="space-y-4">
          {promocao ? <input type="hidden" name="id" value={promocao.id} /> : null}
          <input type="hidden" name="imageId" value={imageId ?? ''} />
          {escolhidos.map((id) => (
            <input key={id} type="hidden" name="productIds" value={id} />
          ))}

          <ImageUploader
            context="PROMO_BANNER"
            value={imageId}
            previewUrl={promocao?.imagemUrl}
            onChange={setImageId}
            label="Imagem do banner (opcional)"
            helperText="Faixa larga. O título aparece por cima, na parte de baixo. Sem imagem, o banner usa a cor do Rapidinho."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={50}
                defaultValue={promocao?.title}
                placeholder="Ex.: Semana do churrasco"
                error={estado.fieldErrors?.title}
              />
            </div>
            <div>
              <Label htmlFor="endsAt">Válida até (opcional)</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="date"
                defaultValue={dataNoFormulario(promocao?.endsAt ?? null)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="subtitle">Frase de apoio (opcional)</Label>
            <Input
              id="subtitle"
              name="subtitle"
              maxLength={90}
              defaultValue={promocao?.subtitle ?? ''}
              placeholder="Ex.: Carnes e carvão com preço de sexta"
              error={estado.fieldErrors?.subtitle}
            />
          </div>

          <div>
            <Label htmlFor="busca">Produtos da promoção ({escolhidos.length} escolhidos)</Label>
            <Input
              id="busca"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar produto"
            />
            {estado.fieldErrors?.productIds ? (
              <p className="text-destructive mt-1 text-sm">{estado.fieldErrors.productIds}</p>
            ) : null}
            <ul className="border-input mt-2 max-h-72 divide-y overflow-y-auto rounded-lg border">
              {visiveis.map((produto) => (
                <li key={produto.id}>
                  <label className="min-h-touch flex cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={escolhidos.includes(produto.id)}
                      onChange={(evento) =>
                        setEscolhidos((atuais) =>
                          evento.target.checked
                            ? [...atuais, produto.id]
                            : atuais.filter((id) => id !== produto.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">{produto.name}</span>
                    <span className="text-muted-foreground whitespace-nowrap text-sm">
                      {produto.compareAtPriceCents ? (
                        <s className="mr-1">{formatCents(produto.compareAtPriceCents)}</s>
                      ) : null}
                      {formatCents(produto.priceCents)}
                    </span>
                  </label>
                </li>
              ))}
              {visiveis.length === 0 ? (
                <li className="text-muted-foreground px-3 py-4">Nenhum produto encontrado.</li>
              ) : null}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={pendente}>
              <Plus className="h-5 w-5" aria-hidden />
              {pendente ? 'Salvando…' : promocao ? 'Salvar promoção' : 'Publicar promoção'}
            </Button>
            {promocao ? (
              <Button type="button" variant="outline" size="lg" onClick={aoCancelar}>
                Cancelar edição
              </Button>
            ) : null}
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
      </CardContent>
    </Card>
  );
}

export function GerenciadorDePromocoes({
  promocoes,
  produtos,
}: {
  promocoes: Promocao[];
  produtos: Produto[];
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [alterando, iniciarTransicao] = useTransition();
  const emEdicao = promocoes.find((promocao) => promocao.id === editando) ?? null;

  return (
    <div className="space-y-6">
      <Formulario
        key={editando ?? 'nova'}
        promocao={emEdicao}
        produtos={produtos}
        aoCancelar={() => setEditando(null)}
      />

      {promocoes.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground pt-6">
            Nenhuma promoção criada ainda.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {promocoes.map((promocao) => {
            const vencida = promocao.endsAt != null && new Date(promocao.endsAt) < new Date();

            return (
              <li key={promocao.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <p className="text-lg font-bold">{promocao.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {promocao.productIds.length} produto(s)
                        {promocao.endsAt
                          ? ` · até ${new Date(promocao.endsAt).toLocaleDateString('pt-BR', {
                              timeZone: 'America/Sao_Paulo',
                            })}`
                          : ''}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {vencida ? <Badge variant="warning">Vencida</Badge> : null}
                        {!promocao.isActive ? <Badge variant="secondary">Pausada</Badge> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setEditando(promocao.id)}>
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        disabled={alterando}
                        onClick={() =>
                          iniciarTransicao(() =>
                            alternarPromocao(promocao.id, !promocao.isActive).then(() => undefined),
                          )
                        }
                      >
                        {promocao.isActive ? 'Pausar' : 'Colocar no ar'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={alterando}
                        onClick={() => {
                          if (!window.confirm(`Excluir a promoção "${promocao.title}"?`)) return;
                          setEditando(null);
                          iniciarTransicao(() =>
                            excluirPromocao(promocao.id).then(() => undefined),
                          );
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
