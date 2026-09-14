'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { Badge, Button, Card, CardContent, Input, cn } from '@rapidinho/ui';
import { calculateCartItem, formatCents, formatGrams } from '@rapidinho/shared';
import { adicionarAoCarrinho } from '@/app/carrinho/actions';

interface Opcao {
  id: string;
  nome: string;
  descricao: string | null;
  precoCents: number;
}

interface Grupo {
  id: string;
  nome: string;
  descricao: string | null;
  obrigatorio: boolean;
  minimo: number;
  maximo: number;
  permiteRepetir: boolean;
  opcoes: Opcao[];
}

interface Props {
  produto: {
    id: string;
    nome: string;
    descricao: string | null;
    precoCents: number;
    precoDeCents: number | null;
    porPeso: boolean;
    passoGramas: number;
    minimoGramas: number;
    disponivel: boolean;
  };
  loja: { id: string; nome: string; slug: string; aberta: boolean; motivoFechada: string | null };
  grupos: Grupo[];
  cidadeSlug: string;
}

/**
 * Montagem do item.
 *
 * O preço na barra de baixo é calculado pela MESMA função que o servidor usa
 * ao gravar o pedido (`calculateCartItem`, em `shared`). É isso que garante que
 * o valor mostrado aqui e o cobrado no fim sejam o mesmo número — duas
 * implementações divergiriam no primeiro caso de arredondamento.
 */
export function FormularioDoProduto({ produto, loja, grupos, cidadeSlug }: Props) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [quantidade, setQuantidade] = useState(1);
  const [gramas, setGramas] = useState(produto.minimoGramas);
  const [observacao, setObservacao] = useState('');
  const [escolhas, setEscolhas] = useState<Record<string, Record<string, number>>>({});

  function alterarEscolha(grupo: Grupo, opcaoId: string, delta: number) {
    setEscolhas((atual) => {
      const doGrupo = { ...(atual[grupo.id] ?? {}) };
      const novaQuantidade = Math.max(0, (doGrupo[opcaoId] ?? 0) + delta);

      const totalOutros = Object.entries(doGrupo)
        .filter(([id]) => id !== opcaoId)
        .reduce((soma, [, valor]) => soma + valor, 0);

      // Respeita o máximo do grupo já na interação: deixar passar e recusar no
      // servidor faria o cliente perder o que montou.
      if (totalOutros + novaQuantidade > grupo.maximo) return atual;

      if (novaQuantidade === 0) delete doGrupo[opcaoId];
      else doGrupo[opcaoId] = novaQuantidade;

      return { ...atual, [grupo.id]: doGrupo };
    });
  }

  const complementosEscolhidos = useMemo(
    () =>
      grupos.flatMap((grupo) =>
        Object.entries(escolhas[grupo.id] ?? {}).map(([opcaoId, qtd]) => {
          const opcao = grupo.opcoes.find((o) => o.id === opcaoId);
          return {
            optionId: opcaoId,
            groupName: grupo.nome,
            optionName: opcao?.nome ?? '',
            priceCents: opcao?.precoCents ?? 0,
            quantity: qtd,
          };
        }),
      ),
    [escolhas, grupos],
  );

  const preco = calculateCartItem({
    productName: produto.nome,
    unitPriceCents: produto.precoCents,
    quantity: quantidade,
    sellingUnit: produto.porPeso ? 'WEIGHT_KG' : 'UNIT',
    weightGrams: produto.porPeso ? gramas : null,
    complements: complementosEscolhidos,
  });

  const gruposIncompletos = grupos.filter((grupo) => {
    const total = Object.values(escolhas[grupo.id] ?? {}).reduce((soma, valor) => soma + valor, 0);
    return grupo.obrigatorio && total < Math.max(1, grupo.minimo);
  });

  const podeAdicionar =
    produto.disponivel && loja.aberta && gruposIncompletos.length === 0 && !pendente;

  function adicionar() {
    setErro(null);

    iniciarTransicao(async () => {
      const resultado = await adicionarAoCarrinho({
        storeId: loja.id,
        item: {
          productId: produto.id,
          quantity: quantidade,
          ...(produto.porPeso ? { weightGrams: gramas } : {}),
          ...(observacao.trim() ? { notes: observacao.trim() } : {}),
          complements: complementosEscolhidos.map((complemento) => ({
            optionId: complemento.optionId,
            quantity: complemento.quantity,
          })),
          flavorIds: [],
        },
      });

      if (resultado.ok) {
        router.push(`/${cidadeSlug}/${loja.slug}`);
        router.refresh();
      } else {
        setErro(resultado.message ?? 'Não foi possível adicionar.');
      }
    });
  }

  return (
    <div className="space-y-5 px-5 py-5">
      <header>
        <h1 className="text-2xl font-bold leading-tight">{produto.nome}</h1>
        {produto.descricao ? (
          <p className="text-muted-foreground mt-1 leading-relaxed">{produto.descricao}</p>
        ) : null}
        <p className="mt-2 text-xl font-bold">
          {formatCents(produto.precoCents)}
          {produto.porPeso ? <span className="text-muted-foreground text-base"> /kg</span> : null}
          {produto.precoDeCents && produto.precoDeCents > produto.precoCents ? (
            <span className="text-muted-foreground ml-2 text-base font-normal line-through">
              {formatCents(produto.precoDeCents)}
            </span>
          ) : null}
        </p>
      </header>

      {!loja.aberta ? (
        <p className="bg-warning/15 rounded-xl p-3 text-sm font-medium">
          {loja.motivoFechada ?? 'A loja está fechada'}. Você pode montar o pedido, mas só dá para
          enviar quando ela abrir.
        </p>
      ) : null}

      {!produto.disponivel ? (
        <p className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">
          Este item está indisponível no momento.
        </p>
      ) : null}

      {produto.porPeso ? (
        <Card>
          <CardContent className="pt-5">
            <p className="font-semibold">Quanto você quer?</p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                aria-label="Diminuir peso"
                disabled={gramas <= produto.minimoGramas}
                onClick={() =>
                  setGramas((atual) => Math.max(produto.minimoGramas, atual - produto.passoGramas))
                }
              >
                <Minus className="h-5 w-5" aria-hidden />
              </Button>
              <span className="min-w-24 text-center text-lg font-bold">{formatGrams(gramas)}</span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Aumentar peso"
                onClick={() => setGramas((atual) => atual + produto.passoGramas)}
              >
                <Plus className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              O peso final pode variar um pouco; você paga pelo que for pesado na loja.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {grupos.map((grupo) => {
        const total = Object.values(escolhas[grupo.id] ?? {}).reduce((soma, v) => soma + v, 0);
        const incompleto = gruposIncompletos.includes(grupo);

        return (
          <Card key={grupo.id} className={cn(incompleto && 'border-warning')}>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{grupo.nome}</p>
                  {grupo.descricao ? (
                    <p className="text-muted-foreground text-sm">{grupo.descricao}</p>
                  ) : null}
                  <p className="text-muted-foreground text-sm">
                    {grupo.obrigatorio ? 'Escolha ' : 'Até '}
                    {grupo.maximo === 1 ? '1 opção' : `${grupo.maximo} opções`}
                    {total > 0 ? ` · ${total} escolhida(s)` : ''}
                  </p>
                </div>
                {grupo.obrigatorio ? <Badge variant="warning">Obrigatório</Badge> : null}
              </div>

              <ul className="mt-3 space-y-1">
                {grupo.opcoes.map((opcao) => {
                  const escolhido = escolhas[grupo.id]?.[opcao.id] ?? 0;

                  return (
                    <li
                      key={opcao.id}
                      className="flex items-center gap-3 border-b py-2 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{opcao.nome}</p>
                        {opcao.descricao ? (
                          <p className="text-muted-foreground text-sm">{opcao.descricao}</p>
                        ) : null}
                        {opcao.precoCents > 0 ? (
                          <p className="text-muted-foreground text-sm">
                            + {formatCents(opcao.precoCents)}
                          </p>
                        ) : null}
                      </div>

                      {grupo.permiteRepetir ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            aria-label={`Menos ${opcao.nome}`}
                            disabled={escolhido === 0}
                            onClick={() => alterarEscolha(grupo, opcao.id, -1)}
                          >
                            <Minus className="h-4 w-4" aria-hidden />
                          </Button>
                          <span className="w-6 text-center font-semibold">{escolhido}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            aria-label={`Mais ${opcao.nome}`}
                            onClick={() => alterarEscolha(grupo, opcao.id, 1)}
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      ) : (
                        <input
                          type={grupo.maximo === 1 ? 'radio' : 'checkbox'}
                          name={`grupo-${grupo.id}`}
                          checked={escolhido > 0}
                          aria-label={opcao.nome}
                          className="h-6 w-6 shrink-0"
                          onChange={() => {
                            if (grupo.maximo === 1) {
                              // Rádio: escolher um troca o anterior.
                              setEscolhas((atual) => ({ ...atual, [grupo.id]: { [opcao.id]: 1 } }));
                            } else {
                              alterarEscolha(grupo, opcao.id, escolhido > 0 ? -escolhido : 1);
                            }
                          }}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      <div>
        <label htmlFor="observacao" className="font-semibold">
          Alguma observação?
        </label>
        <Input
          id="observacao"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
          placeholder="Ex.: sem cebola"
          maxLength={200}
          className="mt-1"
        />
      </div>

      {erro ? <p className="text-destructive font-medium">{erro}</p> : null}

      {/* Barra fixa: o preço e o botão acompanham a rolagem, porque em
          cardápio longo o cliente perde a referência do total. */}
      <div className="bg-card pb-safe fixed inset-x-0 bottom-0 z-30 border-t p-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {!produto.porPeso ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Diminuir quantidade"
                disabled={quantidade <= 1}
                onClick={() => setQuantidade((atual) => Math.max(1, atual - 1))}
              >
                <Minus className="h-5 w-5" aria-hidden />
              </Button>
              <span className="w-6 text-center text-lg font-bold">{quantidade}</span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantidade((atual) => Math.min(99, atual + 1))}
              >
                <Plus className="h-5 w-5" aria-hidden />
              </Button>
            </div>
          ) : null}

          <Button size="lg" className="flex-1" disabled={!podeAdicionar} onClick={adicionar}>
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {gruposIncompletos.length > 0
              ? `Escolha: ${gruposIncompletos[0]?.nome}`
              : `Adicionar · ${formatCents(preco.totalCents)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
