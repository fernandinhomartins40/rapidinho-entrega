'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bike,
  Check,
  ChevronRight,
  Clock,
  Mic,
  Minus,
  Plus,
  RotateCcw,
  SearchX,
  Sparkles,
  Star,
  Store,
  X,
} from 'lucide-react';
import { formatCents } from '@rapidinho/shared';
import { Alert, Button, cn } from '@rapidinho/ui';
import { colocarListaNoCarrinho, montarPedidoPorLista } from './actions';
import {
  precoDaLinha,
  type ItemParaOCarrinho,
  type LojaSugerida,
  type PedidoMontado,
  type ProdutoSugerido,
} from './tipos';

const CHAVE_DO_RASCUNHO = 'rapidinho:lista';

const EXEMPLOS = [
  { rotulo: 'Café da manhã', texto: '10 pães franceses\n1 leite integral\nmanteiga\ncafé 500g' },
  { rotulo: 'Churrasco', texto: '2 kg de picanha\ncarvão\n12 cervejas\n1 coca 2 litros' },
  { rotulo: 'Farmácia', texto: 'dipirona\nsoro fisiológico\nprotetor solar' },
  { rotulo: 'Jantar', texto: '1 pizza calabresa\n2 refrigerantes' },
];

/* ------------------------------------------------------------------------ */
/* Voz                                                                       */
/* ------------------------------------------------------------------------ */

interface ReconhecimentoDeFala {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((evento: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
}

type ConstrutorDeFala = new () => ReconhecimentoDeFala;

function construtorDeFala(): ConstrutorDeFala | null {
  if (typeof window === 'undefined') return null;
  const janela = window as unknown as {
    SpeechRecognition?: ConstrutorDeFala;
    webkitSpeechRecognition?: ConstrutorDeFala;
  };
  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null;
}

/**
 * Ditado pelo reconhecimento de fala do próprio navegador: nada de áudio sai
 * do aparelho para o nosso servidor. Onde não existe (Firefox, alguns iPhones
 * antigos), o botão nem aparece.
 */
function useDitado(aoOuvir: (trecho: string) => void) {
  const [disponivel, setDisponivel] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const reconhecimento = useRef<ReconhecimentoDeFala | null>(null);
  const aoOuvirRef = useRef(aoOuvir);
  aoOuvirRef.current = aoOuvir;

  useEffect(() => setDisponivel(construtorDeFala() != null), []);

  function alternar() {
    if (ouvindo) {
      reconhecimento.current?.stop();
      return;
    }

    const Construtor = construtorDeFala();
    if (!Construtor) return;

    const instancia = new Construtor();
    instancia.lang = 'pt-BR';
    instancia.interimResults = false;
    instancia.continuous = true;
    instancia.onresult = (evento) => {
      for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
        const resultado = evento.results[i]!;
        if (resultado.isFinal) aoOuvirRef.current(resultado[0].transcript.trim());
      }
    };
    instancia.onerror = (evento) => {
      setErro(
        evento.error === 'not-allowed'
          ? 'Libere o microfone nas configurações do navegador para falar sua lista.'
          : 'Não entendi. Tente de novo, falando um item de cada vez.',
      );
    };
    instancia.onend = () => setOuvindo(false);

    setErro(null);
    reconhecimento.current = instancia;
    instancia.start();
    setOuvindo(true);
  }

  useEffect(() => () => reconhecimento.current?.stop(), []);

  return { disponivel, ouvindo, erro, alternar };
}

/* ------------------------------------------------------------------------ */
/* Montador                                                                  */
/* ------------------------------------------------------------------------ */

type Modo = 'combinado' | string;

interface Linha {
  indice: number;
  original: string;
  produto: ProdutoSugerido;
  alternativas: ProdutoSugerido[];
  quantidade: number;
}

export function MontadorDePedido({
  cidade,
  logado,
}: {
  cidade: { name: string; slug: string };
  logado: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [pedido, setPedido] = useState<PedidoMontado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>('combinado');
  const [trocas, setTrocas] = useState<Record<number, string>>({});
  const [quantidades, setQuantidades] = useState<Record<number, number>>({});
  const [removidos, setRemovidos] = useState<Set<number>>(new Set());
  const [montando, iniciarMontagem] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const resultadoRef = useRef<HTMLDivElement>(null);

  // Rascunho guardado no aparelho: quem precisa entrar no meio do caminho
  // volta e encontra a lista como deixou.
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_DO_RASCUNHO);
      if (salvo) setTexto(salvo);
    } catch {
      /* armazenamento bloqueado: segue sem rascunho */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_DO_RASCUNHO, texto);
    } catch {
      /* idem */
    }
  }, [texto]);

  const ditado = useDitado((trecho) =>
    setTexto((atual) => (atual.trim() ? `${atual.trimEnd()}\n${trecho}` : trecho)),
  );

  function montar(lista = texto) {
    setErro(null);
    iniciarMontagem(async () => {
      const resposta = await montarPedidoPorLista({ cidadeSlug: cidade.slug, texto: lista });
      if (!resposta.ok) {
        setPedido(null);
        setErro(resposta.message);
        return;
      }
      setPedido(resposta.pedido);
      setModo('combinado');
      setTrocas({});
      setQuantidades({});
      setRemovidos(new Set());
      requestAnimationFrame(() =>
        resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    });
  }

  const lojasPorId = useMemo(
    () => new Map((pedido?.lojas ?? []).map((loja) => [loja.id, loja])),
    [pedido],
  );

  /** Loja de cada item no modo atual; `undefined` = essa loja não tem. */
  const grupos = useMemo(() => {
    if (!pedido)
      return { porLoja: [] as { loja: LojaSugerida; linhas: Linha[] }[], faltam: [] as number[] };

    const porLoja = new Map<string, Linha[]>();
    const faltam: number[] = [];

    for (const item of pedido.itens) {
      if (removidos.has(item.indice)) continue;
      if (pedido.naoEncontrados.includes(item.indice) || pedido.soEmFechadas.includes(item.indice))
        continue;

      const lojaId = modo === 'combinado' ? pedido.plano[item.indice] : modo;
      const opcoes = lojaId ? lojasPorId.get(lojaId)?.produtos[item.indice] : undefined;

      if (!lojaId || !opcoes || opcoes.length === 0) {
        faltam.push(item.indice);
        continue;
      }

      const produto = opcoes.find((opcao) => opcao.id === trocas[item.indice]) ?? opcoes[0]!;
      const linhas = porLoja.get(lojaId) ?? [];
      linhas.push({
        indice: item.indice,
        original: item.original,
        produto,
        alternativas: opcoes,
        quantidade: quantidades[item.indice] ?? item.quantidade,
      });
      porLoja.set(lojaId, linhas);
    }

    return {
      porLoja: [...porLoja.entries()].map(([id, linhas]) => ({
        loja: lojasPorId.get(id)!,
        linhas,
      })),
      faltam,
    };
  }, [pedido, modo, trocas, quantidades, removidos, lojasPorId]);

  const encontrados = grupos.porLoja.reduce((soma, grupo) => soma + grupo.linhas.length, 0);
  const totalCents = grupos.porLoja.reduce(
    (soma, { loja, linhas }) =>
      soma +
      linhas.reduce(
        (parcial, linha) => parcial + precoDaLinha(linha.produto, linha.quantidade),
        0,
      ) +
      (loja.taxaGratis ? 0 : loja.taxaCents),
    0,
  );
  const prontos = grupos.porLoja.flatMap(({ loja, linhas }) =>
    linhas
      .filter((linha) => !linha.produto.precisaEscolher)
      .map<ItemParaOCarrinho>((linha) => ({
        storeId: loja.id,
        productId: linha.produto.id,
        quantidade: linha.quantidade,
        gramas: linha.produto.porPeso ? linha.produto.gramas : null,
      })),
  );

  function enviar() {
    setErro(null);
    iniciarEnvio(async () => {
      const resultado = await colocarListaNoCarrinho(prontos);
      if (!resultado.ok) {
        setErro(resultado.message ?? 'Não foi possível colocar no carrinho.');
        return;
      }
      try {
        window.localStorage.removeItem(CHAVE_DO_RASCUNHO);
      } catch {
        /* sem armazenamento */
      }
      router.push('/carrinho');
      router.refresh();
    });
  }

  const destinoDoLogin = `/entrar?destino=${encodeURIComponent(`/${cidade.slug}/pedir`)}`;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-primary-text inline-flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4" aria-hidden />
          Pedido por lista
        </p>
        <h1 className="mt-1 text-[1.65rem] font-extrabold leading-tight tracking-tight">
          Diga o que você precisa.
          <br />
          <span className="text-primary">A gente acha e monta.</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">
          Escreva ou fale sua lista. Procuramos nas lojas abertas de {cidade.name} e montamos o
          pedido no menor número de lojas.
        </p>
      </header>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          montar();
        }}
        className="bg-card rounded-3xl border p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        <label htmlFor="lista" className="sr-only">
          Sua lista
        </label>
        <textarea
          id="lista"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          // Cresce com a lista (até 10 linhas): rolar dentro da caixa esconde o
          // começo do que o cliente acabou de ditar.
          rows={Math.min(10, Math.max(4, texto.split('\n').length + 1))}
          maxLength={2000}
          placeholder={'2 arroz 5kg\n1 dipirona\nmeio quilo de carne moída\n1 coca 2 litros'}
          className="placeholder:text-muted-foreground/70 w-full resize-none bg-transparent px-2 py-1.5 text-[17px] leading-relaxed outline-none"
        />

        <div className="mt-2 flex items-center gap-2">
          {ditado.disponivel ? (
            <button
              type="button"
              onClick={ditado.alternar}
              aria-pressed={ditado.ouvindo}
              aria-label={ditado.ouvindo ? 'Parar de ouvir' : 'Falar a lista'}
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors',
                ditado.ouvindo
                  ? 'botao-vidro text-[#141414] motion-safe:animate-pulse'
                  : 'bg-secondary text-foreground',
              )}
            >
              <Mic className="h-5 w-5" aria-hidden />
            </button>
          ) : null}

          {texto ? (
            <button
              type="button"
              onClick={() => {
                setTexto('');
                setPedido(null);
              }}
              className="text-muted-foreground flex h-12 items-center gap-1 rounded-full px-3 text-sm"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Limpar
            </button>
          ) : null}

          <Button
            type="submit"
            isLoading={montando}
            disabled={!texto.trim()}
            className="ml-auto h-12 rounded-full px-5 text-base font-bold"
          >
            Montar pedido
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        {ditado.ouvindo ? (
          <p className="text-primary-text mt-2 px-2 text-sm font-medium" role="status">
            Ouvindo… fale um item de cada vez. Toque no microfone para parar.
          </p>
        ) : null}
        {ditado.erro ? <p className="text-destructive mt-2 px-2 text-sm">{ditado.erro}</p> : null}
      </form>

      {!pedido ? (
        <section aria-labelledby="exemplos">
          <h2 id="exemplos" className="text-muted-foreground mb-2 text-sm font-semibold">
            Sem ideia? Comece por um destes
          </h2>
          <ul className="flex flex-wrap gap-2">
            {EXEMPLOS.map((exemplo) => (
              <li key={exemplo.rotulo}>
                <button
                  type="button"
                  onClick={() => {
                    setTexto(exemplo.texto);
                    montar(exemplo.texto);
                  }}
                  className="bg-secondary hover:bg-accent min-h-touch rounded-full px-4 text-sm font-semibold transition-colors"
                >
                  {exemplo.rotulo}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {erro ? <Alert variant="destructive">{erro}</Alert> : null}

      {pedido ? (
        <div ref={resultadoRef} className="scroll-mt-4 space-y-5">
          <div className="rounded-2xl border border-[#FFB900]/30 bg-[#FFB900]/10 p-4">
            <p className="text-lg font-bold">
              {encontrados === 0
                ? 'Não achamos nada da lista nas lojas abertas.'
                : `Achamos ${encontrados} de ${pedido.itens.length - removidos.size} ${pedido.itens.length === 1 ? 'item' : 'itens'}`}
            </p>
            {encontrados > 0 ? (
              <p className="text-muted-foreground text-sm">
                {grupos.porLoja.length === 1
                  ? 'Tudo numa loja só'
                  : `Em ${grupos.porLoja.length} lojas — um pedido para cada`}{' '}
                · estimado <strong className="text-foreground">{formatCents(totalCents)}</strong>{' '}
                com entrega
              </p>
            ) : null}
          </div>

          {pedido.lojas.length > 1 ? (
            <div>
              <p className="text-muted-foreground mb-2 text-sm font-semibold">Como prefere?</p>
              <ul className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                <li>
                  <Escolha ativa={modo === 'combinado'} onClick={() => setModo('combinado')}>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Melhor combinação
                  </Escolha>
                </li>
                {pedido.lojas.map((loja) => {
                  const atende = pedido.itens.filter(
                    (item) => loja.produtos[item.indice]?.length && !removidos.has(item.indice),
                  ).length;
                  return (
                    <li key={loja.id}>
                      <Escolha ativa={modo === loja.id} onClick={() => setModo(loja.id)}>
                        Só {loja.nome}
                        <span className="opacity-70">
                          {atende}/{pedido.itens.length - removidos.size}
                        </span>
                      </Escolha>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {grupos.porLoja.map(({ loja, linhas }) => {
            const subtotal = linhas.reduce(
              (soma, linha) => soma + precoDaLinha(linha.produto, linha.quantidade),
              0,
            );
            const abaixoDoMinimo = loja.minimoCents > 0 && subtotal < loja.minimoCents;

            return (
              <section key={loja.id} className="bg-card overflow-hidden rounded-2xl border">
                <Link
                  href={`/${cidade.slug}/${loja.slug}`}
                  className="flex items-center gap-3 border-b p-3"
                >
                  {loja.imagem ? (
                    <Image
                      src={loja.imagem}
                      alt=""
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="bg-secondary flex h-11 w-11 items-center justify-center rounded-xl">
                      <Store className="h-5 w-5" aria-hidden />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{loja.nome}</span>
                    <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                      {loja.avaliacoes > 0 ? (
                        <span className="flex items-center gap-0.5">
                          <Star className="fill-primary text-primary h-3 w-3" aria-hidden />
                          {loja.nota.toFixed(1)}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" aria-hidden />
                        {loja.tempoMin} min
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Bike className="h-3 w-3" aria-hidden />
                        {loja.taxaGratis || loja.taxaCents === 0
                          ? 'Grátis'
                          : formatCents(loja.taxaCents)}
                      </span>
                    </span>
                  </span>
                  <span className="font-bold">{formatCents(subtotal)}</span>
                </Link>

                <ul className="divide-y">
                  {linhas.map((linha) => (
                    <LinhaDoPedido
                      key={linha.indice}
                      linha={linha}
                      cidadeSlug={cidade.slug}
                      aoTrocar={(id) => setTrocas((atual) => ({ ...atual, [linha.indice]: id }))}
                      aoMudarQuantidade={(quantidade) =>
                        setQuantidades((atual) => ({ ...atual, [linha.indice]: quantidade }))
                      }
                      aoRemover={() => setRemovidos((atual) => new Set(atual).add(linha.indice))}
                    />
                  ))}
                </ul>

                {abaixoDoMinimo ? (
                  <p className="text-warning-text bg-warning/10 px-3 py-2 text-xs font-medium">
                    Pedido mínimo desta loja: {formatCents(loja.minimoCents)}. Dá para completar no
                    carrinho.
                  </p>
                ) : null}
              </section>
            );
          })}

          {grupos.faltam.length + pedido.naoEncontrados.length + pedido.soEmFechadas.length > 0 ? (
            <section className="bg-card rounded-2xl border border-dashed p-4">
              <h2 className="flex items-center gap-2 font-bold">
                <SearchX className="text-muted-foreground h-5 w-5" aria-hidden />
                Ficou de fora
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {[...grupos.faltam, ...pedido.naoEncontrados, ...pedido.soEmFechadas]
                  .filter((indice) => !removidos.has(indice))
                  .map((indice) => {
                    const item = pedido.itens[indice]!;
                    const motivo = pedido.soEmFechadas.includes(indice)
                      ? 'só em loja fechada agora'
                      : grupos.faltam.includes(indice)
                        ? 'não tem nesta loja'
                        : 'não encontramos';
                    return (
                      <li key={indice} className="flex items-center justify-between gap-3">
                        <span>
                          <span className="font-medium">{item.original}</span>
                          <span className="text-muted-foreground"> — {motivo}</span>
                        </span>
                        <Link
                          href={`/${cidade.slug}/busca?q=${encodeURIComponent(item.original)}`}
                          className="text-primary-text shrink-0 font-semibold"
                        >
                          Buscar
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ) : null}

          {prontos.length > 0 ? (
            <div className="sticky bottom-[calc(6rem+env(safe-area-inset-bottom))] z-30">
              {logado ? (
                <Button
                  type="button"
                  onClick={enviar}
                  isLoading={enviando}
                  className="h-14 w-full rounded-2xl text-base font-extrabold shadow-[0_10px_30px_rgba(255,185,0,0.35)]"
                >
                  <Check className="h-5 w-5" aria-hidden />
                  Colocar {prontos.length} {prontos.length === 1 ? 'item' : 'itens'} no carrinho
                </Button>
              ) : (
                <Button
                  asChild
                  className="h-14 w-full rounded-2xl text-base font-extrabold shadow-[0_10px_30px_rgba(255,185,0,0.35)]"
                >
                  <Link href={destinoDoLogin}>Entrar para colocar no carrinho</Link>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Escolha({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={cn(
        'min-h-touch flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors',
        ativa
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-secondary border-transparent',
      )}
    >
      {children}
    </button>
  );
}

function LinhaDoPedido({
  linha,
  cidadeSlug,
  aoTrocar,
  aoMudarQuantidade,
  aoRemover,
}: {
  linha: Linha;
  cidadeSlug: string;
  aoTrocar: (produtoId: string) => void;
  aoMudarQuantidade: (quantidade: number) => void;
  aoRemover: () => void;
}) {
  const { produto } = linha;

  return (
    <li className="flex gap-3 p-3">
      {produto.imagem ? (
        <Image
          src={produto.imagem}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="bg-secondary h-14 w-14 shrink-0 rounded-xl" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground truncate text-xs">você pediu: {linha.original}</p>

        {linha.alternativas.length > 1 ? (
          <select
            value={produto.id}
            onChange={(evento) => aoTrocar(evento.target.value)}
            aria-label={`Produto para "${linha.original}"`}
            className="-ml-1 mt-0.5 w-full truncate rounded-lg bg-transparent py-0.5 pr-6 text-[15px] font-semibold"
          >
            {linha.alternativas.map((opcao) => (
              <option key={opcao.id} value={opcao.id} className="bg-card">
                {opcao.nome} — {formatCents(opcao.precoCents)}
                {opcao.porPeso ? '/kg' : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-0.5 text-[15px] font-semibold leading-snug">{produto.nome}</p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          {produto.precisaEscolher ? (
            <Link
              href={`/${cidadeSlug}/produto/${produto.id}`}
              className="text-primary-text inline-flex items-center gap-1 text-sm font-semibold"
            >
              Escolher opções
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : produto.porPeso ? (
            <span className="bg-secondary rounded-full px-3 py-1 text-sm font-semibold">
              {(produto.gramas ?? 0) >= 1000
                ? `${((produto.gramas ?? 0) / 1000).toLocaleString('pt-BR')} kg`
                : `${produto.gramas} g`}
            </span>
          ) : (
            <span className="bg-secondary inline-flex items-center rounded-full">
              <button
                type="button"
                onClick={() => aoMudarQuantidade(Math.max(1, linha.quantidade - 1))}
                aria-label="Diminuir quantidade"
                className="flex h-9 w-9 items-center justify-center"
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <span className="min-w-6 text-center text-sm font-bold tabular-nums">
                {linha.quantidade}
              </span>
              <button
                type="button"
                onClick={() => aoMudarQuantidade(Math.min(99, linha.quantidade + 1))}
                aria-label="Aumentar quantidade"
                className="flex h-9 w-9 items-center justify-center"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
            </span>
          )}

          <span className="font-bold tabular-nums">
            {produto.precisaEscolher
              ? `a partir de ${formatCents(produto.precoCents)}`
              : formatCents(precoDaLinha(produto, linha.quantidade))}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={aoRemover}
        aria-label={`Tirar "${linha.original}" da lista`}
        className="text-muted-foreground -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}
