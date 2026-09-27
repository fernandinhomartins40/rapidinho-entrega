'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChevronRight, RotateCcw, Users } from 'lucide-react';
import {
  combinaComAVontade,
  CURTIDAS_PARA_DECIDIR,
  formatCents,
  proximoCartao,
  VONTADES,
  type Vontade,
} from '@rapidinho/shared';
import { Button, cn } from '@rapidinho/ui';
import { ArteDoPrato } from '@/components/app/arte-do-prato';
import type { PratoNaVitrine } from '@/lib/pratos';
import { criarSessaoEmGrupo } from './actions';
import { CartaoDoBaralho } from './cartao';

/**
 * "Tô com fome", sozinho.
 *
 * A pessoa não escolhe numa lista de 60 lojas: passa um prato por vez, e o
 * baralho aprende com cada toque (curtiu doce, vem mais doce; descartou
 * lanche duas vezes, lanche vai para o fim). No terceiro "quero" o app para
 * de mostrar opções e deixa só as três — decidir entre três é fácil; entre
 * sessenta, ninguém decide.
 */
export function Baralho({
  cidade,
  pratos,
}: {
  cidade: { name: string; slug: string };
  pratos: PratoNaVitrine[];
}) {
  const [vontade, setVontade] = useState<Vontade>('tanto-faz');
  const [curtidos, setCurtidos] = useState<PratoNaVitrine[]>([]);
  const [descartados, setDescartados] = useState<PratoNaVitrine[]>([]);
  const [anterior, setAnterior] = useState<PratoNaVitrine | undefined>();

  // Visto por nome, e não só por id: "Porção de fritas" de duas lojas é o
  // mesmo prato para quem está decidindo — mostrar de novo parece repetição.
  const vistos = useMemo(
    () => new Set([...curtidos, ...descartados].map((prato) => prato.nome.toLowerCase())),
    [curtidos, descartados],
  );
  const restantes = useMemo(
    () =>
      pratos.filter(
        (prato) => !vistos.has(prato.nome.toLowerCase()) && combinaComAVontade(prato, vontade),
      ),
    [pratos, vistos, vontade],
  );
  const atual = proximoCartao(restantes, { curtidos, descartados }, anterior);
  const decidido = curtidos.length >= CURTIDAS_PARA_DECIDIR || (!atual && curtidos.length > 0);

  function recomecar() {
    setCurtidos([]);
    setDescartados([]);
    setAnterior(undefined);
  }

  function decidir(prato: PratoNaVitrine, gostou: boolean) {
    setAnterior(prato);
    if (gostou) setCurtidos((lista) => [...lista, prato]);
    else setDescartados((lista) => [...lista, prato]);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        {/* Tela cheia, sem a barra de baixo: a volta fica aqui em cima. */}
        <Link
          href={`/${cidade.slug}`}
          aria-label="Voltar para o início"
          className="bg-secondary -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
            {decidido ? (
              'Seus finalistas'
            ) : (
              <>
                Tô com fome. <span className="text-primary">Mas de quê?</span>
              </>
            )}
          </h1>
          {/* Em tela baixa o subtítulo sai: o cartão e os botões têm prioridade. */}
          <p className="text-muted-foreground mt-1 text-sm [@media(max-height:700px)]:hidden">
            {decidido
              ? 'Agora é só escolher um. Os três estão abertos e entregam agora.'
              : `Pratos abertos agora em ${cidade.name}. ♥ quero, ✕ não.`}
          </p>
        </div>
        {!decidido ? <DecidirJunto cidadeSlug={cidade.slug} pratos={restantes} /> : null}
      </header>

      {!decidido ? (
        <>
          <ul className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" aria-label="Vontade">
            {VONTADES.map((opcao) => (
              <li key={opcao.id}>
                <button
                  type="button"
                  aria-pressed={vontade === opcao.id}
                  onClick={() => setVontade(opcao.id)}
                  className={cn(
                    'min-h-touch flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors',
                    vontade === opcao.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-secondary border-transparent',
                  )}
                >
                  <span aria-hidden>{opcao.emoji}</span>
                  {opcao.rotulo}
                </button>
              </li>
            ))}
          </ul>

          <Progresso curtidos={curtidos.length} />

          {atual ? (
            <CartaoDoBaralho
              key={atual.chave}
              prato={atual}
              onDecidir={(gostou) => decidir(atual, gostou)}
            />
          ) : (
            <div className="bg-card rounded-3xl border p-8 text-center">
              <p className="text-4xl" aria-hidden>
                🤔
              </p>
              <p className="mt-3 font-bold">Acabaram os pratos desta vontade.</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Troque a vontade aí em cima ou recomece do zero.
              </p>
              <Button type="button" variant="outline" className="mt-4" onClick={recomecar}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Recomeçar
              </Button>
            </div>
          )}
        </>
      ) : (
        <Finalistas pratos={curtidos.slice(0, CURTIDAS_PARA_DECIDIR)} onRecomecar={recomecar} />
      )}
    </div>
  );
}

function Progresso({ curtidos }: { curtidos: number }) {
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="flex gap-1.5">
        {Array.from({ length: CURTIDAS_PARA_DECIDIR }, (_, indice) => (
          <span
            key={indice}
            className={cn(
              'h-2 w-8 rounded-full transition-colors',
              indice < curtidos ? 'bg-primary' : 'bg-secondary',
            )}
          />
        ))}
      </div>
      <span className="text-muted-foreground text-xs font-medium">
        {curtidos === 0
          ? `Escolha ${CURTIDAS_PARA_DECIDIR} que te dão vontade`
          : `${curtidos} de ${CURTIDAS_PARA_DECIDIR} — faltam ${CURTIDAS_PARA_DECIDIR - curtidos}`}
      </span>
    </div>
  );
}

function Finalistas({
  pratos,
  onRecomecar,
}: {
  pratos: PratoNaVitrine[];
  onRecomecar: () => void;
}) {
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {pratos.map((prato, indice) => (
          <li key={prato.chave}>
            <Link
              href={prato.href}
              className="bg-card hover:border-primary flex items-center gap-3 overflow-hidden rounded-2xl border p-2 pr-4 transition-colors"
            >
              <ArteDoPrato
                imagem={prato.imagem}
                arte={prato.arte}
                nome={prato.nome}
                tamanho="sm"
                className="h-20 w-20 shrink-0 rounded-xl"
              />
              <span className="min-w-0 flex-1">
                <span className="text-muted-foreground block text-xs font-semibold">
                  {indice === 0 ? '1º que você quis' : `${indice + 1}º que você quis`}
                </span>
                <span className="block truncate font-bold">{prato.nome}</span>
                <span className="text-muted-foreground block truncate text-sm">
                  {prato.loja.nome} · {prato.tempoMin} min
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="text-primary block font-extrabold">
                  {formatCents(prato.precoCents)}
                </span>
                <span className="text-primary-text inline-flex items-center text-sm font-semibold">
                  Pedir
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" block onClick={onRecomecar}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        Não era isso — recomeçar
      </Button>
    </div>
  );
}

/**
 * Abre a escolha em grupo com o baralho que está na tela: quem recebe o link
 * passa os mesmos pratos.
 */
function DecidirJunto({ cidadeSlug, pratos }: { cidadeSlug: string; pratos: PratoNaVitrine[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [apelido, setApelido] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="bg-secondary flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-xs font-bold"
      >
        <Users className="text-primary h-5 w-5" aria-hidden />
        Decidir
        <br />
        junto
      </button>
    );
  }

  return (
    <div className="bg-card fixed inset-x-4 top-20 z-50 mx-auto max-w-md space-y-3 rounded-3xl border p-5 shadow-2xl">
      <p className="text-lg font-extrabold">Decidir junto 💛</p>
      <p className="text-muted-foreground text-sm">
        Você manda um link. Cada um passa os mesmos pratos no próprio celular e, quando todos
        curtirem o mesmo, dá match.
      </p>
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          setErro(null);
          iniciar(async () => {
            const resposta = await criarSessaoEmGrupo({
              cidadeSlug,
              apelido,
              chaves: pratos.slice(0, 25).map((prato) => prato.chave),
            });
            if (!resposta.ok) {
              setErro(resposta.message);
              return;
            }
            router.push(`/${cidadeSlug}/fome/g/${resposta.id}`);
          });
        }}
        className="space-y-3"
      >
        <label htmlFor="apelido" className="block text-sm font-semibold">
          Como te chamam?
        </label>
        <input
          id="apelido"
          value={apelido}
          onChange={(evento) => setApelido(evento.target.value)}
          maxLength={24}
          autoFocus
          placeholder="Ex.: Ana"
          className="border-input bg-background min-h-touch w-full rounded-xl border px-3"
        />
        {erro ? <p className="text-destructive text-sm">{erro}</p> : null}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
            Voltar
          </Button>
          <Button
            type="submit"
            className="flex-1"
            isLoading={pendente}
            disabled={!apelido.trim() || pratos.length < 2}
          >
            Criar e mandar o link
          </Button>
        </div>
      </form>
    </div>
  );
}
