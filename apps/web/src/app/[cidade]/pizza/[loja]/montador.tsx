'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Minus, Plus, Search, X } from 'lucide-react';
import { calculatePizzaPrice, formatCents } from '@rapidinho/shared';
import { Alert, Button, cn } from '@rapidinho/ui';
import { adicionarAoCarrinho } from '@/app/carrinho/actions';

export interface DadosDaPizzaria {
  loja: { id: string; nome: string; slug: string };
  regra: 'HIGHEST_PRICE' | 'AVERAGE_PRICE';
  aberta: boolean;
  motivoFechada: string | null;
  tamanhos: {
    id: string;
    nome: string;
    descricao: string | null;
    maxSabores: number;
    fatias: number | null;
  }[];
  sabores: {
    id: string;
    nome: string;
    descricao: string | null;
    grupo: string;
    /** Preço do sabor por tamanho (id do tamanho → centavos). */
    precos: Record<string, number>;
  }[];
  extras: { id: string; nome: string; tipo: 'EDGE' | 'CRUST' | 'TOPPING'; precoCents: number }[];
}

/** Cores das partes da pizza no desenho, uma por sabor escolhido. */
const CORES_DAS_PARTES = ['#F59E0B', '#DC2626', '#16A34A', '#7C3AED'];

/** Aviso de quando o cliente tenta mais sabores do que o tamanho aceita. */
interface AvisoDeSabor {
  texto: string;
  /** Sabor que o cliente tentou pôr (para as ações do aviso). */
  saborId?: string;
  /** Menor tamanho que comporta o sabor a mais, se houver. */
  maior?: { id: string; nome: string; maxSabores: number };
}

/**
 * Montador de pizza.
 *
 * Tamanho → sabores → borda, massa e adicionais. Não se pergunta "em quantas
 * partes": quantos sabores o cliente tocar é a divisão (um = inteira, dois =
 * meio a meio...). Se tentar mais do que o tamanho aceita, um aviso explica e
 * oferece trocar para o tamanho que comporta. O desenho mostra a pizza
 * dividida e o preço acompanha cada toque, já explicando a regra da casa.
 */
export function MontadorDePizza({
  cidadeSlug,
  dados,
  tamanhoInicial,
}: {
  cidadeSlug: string;
  dados: DadosDaPizzaria;
  tamanhoInicial: string;
}) {
  const router = useRouter();
  const [tamanhoId, setTamanhoId] = useState(tamanhoInicial);
  const tamanho = dados.tamanhos.find((opcao) => opcao.id === tamanhoId)!;
  const [saboresEscolhidos, setSaboresEscolhidos] = useState<string[]>([]);
  const [aviso, setAviso] = useState<AvisoDeSabor | null>(null);
  const partes = Math.max(1, saboresEscolhidos.length);
  const [borda, setBorda] = useState<string | null>(null);
  const [massa, setMassa] = useState<string | null>(null);
  const [adicionais, setAdicionais] = useState<Set<string>>(new Set());
  const [observacao, setObservacao] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const bordas = dados.extras.filter((extra) => extra.tipo === 'EDGE');
  const massas = dados.extras.filter((extra) => extra.tipo === 'CRUST');
  const extrasAdicionais = dados.extras.filter((extra) => extra.tipo === 'TOPPING');

  // Só sabor com preço neste tamanho aparece: sem preço, sairia de graça.
  const saboresDoTamanho = dados.sabores.filter((sabor) => sabor.precos[tamanhoId] != null);
  const porGrupo = useMemo(() => {
    const termo = busca
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const grupos = new Map<string, typeof saboresDoTamanho>();
    for (const sabor of saboresDoTamanho) {
      const texto = `${sabor.nome} ${sabor.descricao ?? ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      if (termo && !texto.includes(termo)) continue;
      grupos.set(sabor.grupo, [...(grupos.get(sabor.grupo) ?? []), sabor]);
    }
    return [...grupos.entries()];
  }, [saboresDoTamanho, busca]);

  const nomeDoSabor = (id: string) => dados.sabores.find((sabor) => sabor.id === id)?.nome ?? '';
  const temPreco = (saborId: string, tamanhoDoPreco: string) =>
    dados.sabores.find((sabor) => sabor.id === saborId)?.precos[tamanhoDoPreco] != null;

  function trocarTamanho(id: string, saborExtra?: string) {
    const novo = dados.tamanhos.find((opcao) => opcao.id === id)!;
    setTamanhoId(id);
    // Sabor sem preço no tamanho novo sai; o que passar do limite também.
    const candidatos = [...saboresEscolhidos, ...(saborExtra ? [saborExtra] : [])];
    const comPreco = candidatos.filter((saborId) => temPreco(saborId, id));
    const ficam = comPreco.slice(0, novo.maxSabores);
    const sairam = candidatos.filter((saborId) => !ficam.includes(saborId));
    setSaboresEscolhidos(ficam);
    setAviso(
      sairam.length > 0
        ? {
            texto: `${novo.nome} aceita ${novo.maxSabores === 1 ? '1 sabor' : `até ${novo.maxSabores} sabores`}: tiramos ${sairam.map(nomeDoSabor).join(', ')}.`,
          }
        : null,
    );
  }

  /** Toque num sabor: põe ou tira. Passou do limite do tamanho, avisa. */
  function escolherSabor(saborId: string) {
    if (saboresEscolhidos.includes(saborId)) {
      setSaboresEscolhidos((atuais) => atuais.filter((id) => id !== saborId));
      setAviso(null);
      return;
    }

    if (saboresEscolhidos.length < tamanho.maxSabores) {
      setSaboresEscolhidos((atuais) => [...atuais, saborId]);
      setAviso(null);
      return;
    }

    // O menor tamanho que comporta mais um sabor e tem preço para todos.
    const quantos = saboresEscolhidos.length + 1;
    const maior = dados.tamanhos.find(
      (opcao) =>
        opcao.maxSabores >= quantos &&
        [...saboresEscolhidos, saborId].every((id) => temPreco(id, opcao.id)),
    );

    setAviso({
      texto:
        tamanho.maxSabores === 1
          ? `A ${tamanho.nome} é de 1 sabor só.`
          : `A ${tamanho.nome} aceita até ${tamanho.maxSabores} sabores.`,
      saborId,
      maior: maior ? { id: maior.id, nome: maior.nome, maxSabores: maior.maxSabores } : undefined,
    });
  }

  /** Ação do aviso: troca o último sabor escolhido pelo que foi tocado. */
  function trocarUltimoSabor(saborId: string) {
    setSaboresEscolhidos((atuais) => [...atuais.slice(0, -1), saborId]);
    setAviso(null);
  }

  const completa = saboresEscolhidos.length > 0;

  const extrasEscolhidos = [...(borda ? [borda] : []), ...(massa ? [massa] : []), ...adicionais];
  const precoDosExtras = extrasEscolhidos.reduce(
    (soma, id) => soma + (dados.extras.find((extra) => extra.id === id)?.precoCents ?? 0),
    0,
  );

  const preco = calculatePizzaPrice({
    rule: dados.regra,
    maxFlavors: tamanho.maxSabores,
    extraPriceCents: precoDosExtras,
    flavors: saboresEscolhidos.map((id) => {
      const sabor = dados.sabores.find((opcao) => opcao.id === id)!;
      return { flavorId: id, name: sabor.nome, priceCents: sabor.precos[tamanhoId] ?? 0 };
    }),
  });
  const totalCents = preco.valid ? preco.totalCents * quantidade : 0;

  function adicionar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await adicionarAoCarrinho({
        storeId: dados.loja.id,
        item: {
          pizzaSizeId: tamanhoId,
          flavorIds: saboresEscolhidos,
          pizzaExtraIds: extrasEscolhidos,
          quantity: quantidade,
          notes: observacao.trim() || undefined,
          complements: [],
        },
      });
      if (resultado.ok) {
        router.push(`/${cidadeSlug}/${dados.loja.slug}`);
        router.refresh();
        return;
      }
      setErro(resultado.message ?? 'Não foi possível adicionar.');
    });
  }

  const precisaEntrar = erro?.startsWith('Entre com seu telefone');

  return (
    <>
      <header className="bg-brand-deep px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-white">
        <Link
          href={`/${cidadeSlug}/${dados.loja.slug}`}
          aria-label="Voltar para a loja"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <p className="mt-4 text-sm text-white/60">{dados.loja.nome}</p>
        <h1 className="text-2xl font-extrabold">Monte sua pizza</h1>

        <div className="mt-5 flex items-center gap-5">
          <DesenhoDaPizza
            partes={partes}
            nomes={saboresEscolhidos.length > 0 ? saboresEscolhidos.map(nomeDoSabor) : [null]}
          />
          <ol className="min-w-0 flex-1 space-y-1.5 text-sm">
            {saboresEscolhidos.length === 0 ? (
              <li className="text-white/60">
                {tamanho.maxSabores === 1
                  ? 'Escolha o sabor'
                  : `Escolha até ${tamanho.maxSabores} sabores`}
              </li>
            ) : null}
            {saboresEscolhidos.map((id, indice) => (
              <li key={id} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: CORES_DAS_PARTES[indice] }}
                />
                <span className="min-w-0 flex-1 truncate">{nomeDoSabor(id)}</span>
                <button
                  type="button"
                  onClick={() => escolherSabor(id)}
                  aria-label={`Tirar ${nomeDoSabor(id)}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <div className="space-y-7 px-5 pt-6">
        {!dados.aberta ? (
          <Alert variant="warning">
            {dados.motivoFechada ?? 'A pizzaria está fechada agora.'} Dá para montar e deixar no
            carrinho para quando abrir.
          </Alert>
        ) : null}

        <Secao titulo="Tamanho">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {dados.tamanhos.map((opcao) => (
              <Opcao
                key={opcao.id}
                ativa={opcao.id === tamanhoId}
                onClick={() => trocarTamanho(opcao.id)}
              >
                <span className="block font-bold">{opcao.nome}</span>
                <span className="text-muted-foreground block text-xs">
                  {opcao.fatias ? `${opcao.fatias} fatias · ` : ''}até {opcao.maxSabores}{' '}
                  {opcao.maxSabores === 1 ? 'sabor' : 'sabores'}
                </span>
              </Opcao>
            ))}
          </div>
        </Secao>

        <Secao
          titulo={tamanho.maxSabores === 1 ? 'Sabor' : 'Sabores'}
          detalhe={
            tamanho.maxSabores === 1
              ? '1 sabor'
              : `${saboresEscolhidos.length} de até ${tamanho.maxSabores}`
          }
        >
          {tamanho.maxSabores > 1 ? (
            <p className="text-muted-foreground -mt-1 mb-3 text-xs">
              Toque em até {tamanho.maxSabores} sabores: a pizza se divide sozinha.{' '}
              {dados.regra === 'HIGHEST_PRICE'
                ? 'Com mais de um sabor, vale o preço do mais caro.'
                : 'Com mais de um sabor, vale a média dos preços.'}
            </p>
          ) : null}
          <label className="relative mb-3 block">
            <Search
              className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar sabor"
              aria-label="Buscar sabor"
              className="border-input bg-card min-h-touch w-full rounded-xl border pl-9 pr-3"
            />
          </label>
          <div className="space-y-5">
            {porGrupo.map(([grupo, lista]) => (
              <div key={grupo}>
                <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                  {grupo}
                </p>
                <ul className="bg-card divide-y rounded-xl border">
                  {lista.map((sabor) => {
                    const escolhido = saboresEscolhidos.includes(sabor.id);
                    const lotada = !escolhido && saboresEscolhidos.length >= tamanho.maxSabores;
                    return (
                      <li key={sabor.id}>
                        <button
                          type="button"
                          onClick={() => escolherSabor(sabor.id)}
                          aria-pressed={escolhido}
                          className={cn(
                            'flex w-full items-start gap-3 px-3 py-3 text-left',
                            // Continua tocável: o toque explica como pôr mais.
                            lotada && 'opacity-60',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                              escolhido ? 'border-primary bg-primary' : 'border-input',
                            )}
                          >
                            {escolhido ? <Check className="h-3 w-3" aria-hidden /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{sabor.nome}</span>
                            {sabor.descricao ? (
                              <span className="text-muted-foreground line-clamp-2 block text-sm">
                                {sabor.descricao}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-sm font-semibold">
                            {formatCents(sabor.precos[tamanhoId] ?? 0)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {porGrupo.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum sabor encontrado.</p>
            ) : null}
          </div>
        </Secao>

        {bordas.length > 0 ? (
          <Secao titulo="Borda">
            <ListaDeEscolha
              opcoes={[{ id: null, nome: 'Sem borda recheada', precoCents: 0 }, ...bordas]}
              escolhida={borda}
              onEscolher={setBorda}
            />
          </Secao>
        ) : null}

        {massas.length > 0 ? (
          <Secao titulo="Massa">
            <ListaDeEscolha
              opcoes={[{ id: null, nome: 'Massa tradicional', precoCents: 0 }, ...massas]}
              escolhida={massa}
              onEscolher={setMassa}
            />
          </Secao>
        ) : null}

        {extrasAdicionais.length > 0 ? (
          <Secao titulo="Adicionais" detalhe="opcional">
            <ul className="bg-card divide-y rounded-xl border">
              {extrasAdicionais.map((extra) => {
                const marcado = adicionais.has(extra.id);
                return (
                  <li key={extra.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() =>
                          setAdicionais((atuais) => {
                            const proximos = new Set(atuais);
                            if (proximos.has(extra.id)) proximos.delete(extra.id);
                            else proximos.add(extra.id);
                            return proximos;
                          })
                        }
                        className="accent-primary h-5 w-5"
                      />
                      <span className="flex-1 font-medium">{extra.nome}</span>
                      <span className="text-sm font-semibold">
                        + {formatCents(extra.precoCents)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Secao>
        ) : null}

        <Secao titulo="Observação" detalhe="opcional">
          <textarea
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value.slice(0, 200))}
            rows={2}
            placeholder="Ex.: sem cebola, bem assada"
            className="border-input bg-card w-full rounded-xl border px-3 py-2"
          />
        </Secao>
      </div>

      {/* Barra fixa: quantidade, total e o botão — sempre à vista. */}
      <div className="bg-card pb-safe fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-[0_-6px_20px_rgba(20,20,20,0.06)]">
        <div className="mx-auto max-w-lg space-y-2">
          {aviso ? (
            <div
              role="status"
              className="bg-warning/15 text-warning-text space-y-2 rounded-xl px-3 py-2.5 text-sm"
            >
              <div className="flex items-start gap-2">
                <p className="flex-1 font-medium">
                  {aviso.texto}
                  {aviso.maior && aviso.saborId
                    ? ` Para pôr ${nomeDoSabor(aviso.saborId)} também, mude para ${aviso.maior.nome} (até ${aviso.maior.maxSabores} sabores).`
                    : ''}
                </p>
                <button
                  type="button"
                  onClick={() => setAviso(null)}
                  aria-label="Fechar aviso"
                  className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {aviso.saborId ? (
                <div className="flex flex-wrap gap-2">
                  {aviso.maior ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => trocarTamanho(aviso.maior!.id, aviso.saborId)}
                    >
                      Mudar para {aviso.maior.nome}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => trocarUltimoSabor(aviso.saborId!)}
                  >
                    {tamanho.maxSabores === 1 ? 'Trocar o sabor' : 'Trocar o último sabor'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {erro ? (
            <p role="alert" className="text-destructive text-sm font-medium">
              {erro}{' '}
              {precisaEntrar ? (
                <Link
                  href={`/entrar?destino=${encodeURIComponent(`/${cidadeSlug}/pizza/${dados.loja.id}?tamanho=${tamanhoId}`)}`}
                  className="underline"
                >
                  Entrar
                </Link>
              ) : null}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <span className="bg-secondary inline-flex items-center rounded-full">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantidade((atual) => Math.max(1, atual - 1))}
                className="flex h-11 w-11 items-center justify-center"
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <span className="min-w-6 text-center font-bold tabular-nums">{quantidade}</span>
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantidade((atual) => Math.min(20, atual + 1))}
                className="flex h-11 w-11 items-center justify-center"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </span>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={!completa || pendente}
              isLoading={pendente}
              onClick={adicionar}
            >
              {completa ? `Adicionar · ${formatCents(totalCents)}` : 'Escolha um sabor'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function Secao({
  titulo,
  detalhe,
  children,
}: {
  titulo: string;
  detalhe?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline justify-between text-lg font-bold">
        {titulo}
        {detalhe ? (
          <span className="text-muted-foreground text-xs font-medium">{detalhe}</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function Opcao({
  ativa,
  onClick,
  compacta = false,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  compacta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={cn(
        'rounded-xl border-2 text-left transition-colors',
        compacta ? 'min-h-touch px-4 text-sm font-semibold' : 'p-3',
        ativa ? 'border-primary bg-accent' : 'border-input bg-card',
      )}
    >
      {children}
    </button>
  );
}

function ListaDeEscolha({
  opcoes,
  escolhida,
  onEscolher,
}: {
  opcoes: { id: string | null; nome: string; precoCents: number }[];
  escolhida: string | null;
  onEscolher: (id: string | null) => void;
}) {
  return (
    <ul className="bg-card divide-y rounded-xl border">
      {opcoes.map((opcao) => {
        const ativa = opcao.id === escolhida;
        return (
          <li key={opcao.id ?? 'nenhuma'}>
            <button
              type="button"
              onClick={() => onEscolher(opcao.id)}
              aria-pressed={ativa}
              className="flex w-full items-center gap-3 px-3 py-3 text-left"
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                  ativa ? 'border-primary' : 'border-input',
                )}
              >
                {ativa ? <span className="bg-primary h-2.5 w-2.5 rounded-full" /> : null}
              </span>
              <span className="flex-1 font-medium">{opcao.nome}</span>
              {opcao.precoCents > 0 ? (
                <span className="text-sm font-semibold">+ {formatCents(opcao.precoCents)}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A pizza desenhada, dividida nas partes escolhidas, cada parte com a cor do
 * sabor dela — o "meio a meio" que o cliente vê antes de pedir.
 */
function DesenhoDaPizza({ partes, nomes }: { partes: number; nomes: (string | null)[] }) {
  const raio = 44;
  const centro = 50;
  const fatias = Array.from({ length: partes }, (_, indice) => {
    const inicio = (indice / partes) * Math.PI * 2 - Math.PI / 2;
    const fim = ((indice + 1) / partes) * Math.PI * 2 - Math.PI / 2;
    const x1 = centro + raio * Math.cos(inicio);
    const y1 = centro + raio * Math.sin(inicio);
    const x2 = centro + raio * Math.cos(fim);
    const y2 = centro + raio * Math.sin(fim);
    const arcoGrande = fim - inicio > Math.PI ? 1 : 0;
    return partes === 1
      ? null
      : `M ${centro} ${centro} L ${x1} ${y1} A ${raio} ${raio} 0 ${arcoGrande} 1 ${x2} ${y2} Z`;
  });

  return (
    <svg
      viewBox="0 0 100 100"
      className="h-28 w-28 shrink-0"
      role="img"
      aria-label={`Pizza em ${partes} ${partes === 1 ? 'parte' : 'partes'}: ${nomes.map((nome) => nome ?? 'a escolher').join(', ')}`}
    >
      {/* Borda da massa */}
      <circle cx={centro} cy={centro} r={48} fill="#E9B872" />
      {partes === 1 ? (
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill={nomes[0] ? CORES_DAS_PARTES[0] : '#FFE7B3'}
          opacity={nomes[0] ? 0.9 : 1}
        />
      ) : (
        fatias.map((caminho, indice) => (
          <path
            key={indice}
            d={caminho!}
            fill={nomes[indice] ? CORES_DAS_PARTES[indice] : '#FFE7B3'}
            opacity={nomes[indice] ? 0.9 : 1}
            stroke="#E9B872"
            strokeWidth={1.5}
          />
        ))
      )}
    </svg>
  );
}
