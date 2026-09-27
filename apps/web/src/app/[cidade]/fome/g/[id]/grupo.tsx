'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Copy, Heart, Share2, Users } from 'lucide-react';
import { formatCents } from '@rapidinho/shared';
import { Button } from '@rapidinho/ui';
import { ArteDoPrato } from '@/components/app/arte-do-prato';
import type { PratoNaVitrine } from '@/lib/pratos';
import { entrarNaSessao, placarDaSessao, votar, type Placar } from '../../actions';
import { CartaoDoBaralho } from '../../cartao';

/** De quanto em quanto tempo o placar é conferido enquanto a tela está aberta. */
const INTERVALO_DO_PLACAR_MS = 3000;

/**
 * "Decidir junto": todos passam os mesmos pratos, na mesma ordem, cada um no
 * seu celular. Quando todo mundo curte o mesmo, a tela de todos vira "Deu
 * match!" com o botão de pedir.
 */
export function EscolhaEmGrupo({
  sessaoId,
  cidade,
  pratos,
  expirada,
  participante,
}: {
  sessaoId: string;
  cidade: { name: string; slug: string };
  pratos: PratoNaVitrine[];
  expirada: boolean;
  participante: { id: string; apelido: string } | null;
}) {
  const router = useRouter();
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const atualizar = useCallback(async () => {
    setPlacar(await placarDaSessao(sessaoId));
  }, [sessaoId]);

  useEffect(() => {
    void atualizar();
    const intervalo = window.setInterval(() => {
      // Aba escondida não precisa perguntar: volta a conferir quando reabrir.
      if (document.visibilityState === 'visible') void atualizar();
    }, INTERVALO_DO_PLACAR_MS);
    return () => window.clearInterval(intervalo);
  }, [atualizar]);

  if (expirada || placar?.expirada) {
    return (
      <Aviso emoji="⌛" titulo="Esta escolha em grupo já acabou.">
        <Button asChild className="mt-4">
          <Link href={`/${cidade.slug}/fome`}>Começar outra</Link>
        </Button>
      </Aviso>
    );
  }

  if (!participante) {
    return <Entrar onEntrar={() => router.refresh()} />;
  }

  const match = placar?.match ? pratos.find((prato) => prato.chave === placar.match) : null;
  if (match) return <DeuMatch prato={match} placar={placar!} />;

  const atual = pratos[indice];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-primary-text inline-flex items-center gap-1.5 text-sm font-semibold">
          <Users className="h-4 w-4" aria-hidden />
          Decidindo junto
        </p>
        <h1 className="text-[1.5rem] font-extrabold leading-tight">
          Todo mundo curte o mesmo prato = match.
        </h1>
      </header>

      <Convite />

      <Participantes placar={placar} total={pratos.length} />

      {erro ? <p className="text-destructive text-sm">{erro}</p> : null}

      {atual ? (
        <CartaoDoBaralho
          key={atual.chave}
          prato={atual}
          onDecidir={async (gostou) => {
            setIndice((valor) => valor + 1);
            const resposta = await votar({ sessaoId, chave: atual.chave, gostou });
            if (!resposta.ok) setErro(resposta.message ?? 'Não foi possível votar.');
            void atualizar();
          }}
        />
      ) : (
        <Ranking pratos={pratos} placar={placar} />
      )}
    </div>
  );
}

function Convite() {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const url = window.location.href;
    const texto = 'Bora decidir o que a gente vai comer? Passa os pratos aqui:';
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Decidir junto · Rapidinho', text: texto, url });
        return;
      } catch {
        /* cancelou o compartilhamento: cai no WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`, '_blank');
  }

  return (
    <div className="flex gap-2">
      <Button type="button" onClick={compartilhar} className="flex-1">
        <Share2 className="h-4 w-4" aria-hidden />
        Chamar quem vai comer
      </Button>
      <Button
        type="button"
        variant="outline"
        aria-label="Copiar link"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopiado(true);
          } catch {
            /* sem permissão de área de transferência */
          }
        }}
      >
        {copiado ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}

function Participantes({ placar, total }: { placar: Placar | null; total: number }) {
  const pessoas = placar?.participantes ?? [];
  return (
    <div
      className="bg-card flex flex-wrap items-center gap-2 rounded-2xl border p-3 text-sm"
      aria-live="polite"
    >
      {pessoas.length <= 1 ? (
        <span className="text-muted-foreground">
          Esperando alguém entrar pelo link… você já pode ir passando os pratos.
        </span>
      ) : null}
      {pessoas.map((pessoa) => (
        <span
          key={pessoa.apelido + pessoa.votos}
          className="bg-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold"
        >
          {pessoa.apelido}
          {pessoa.souEu ? <span className="text-muted-foreground font-normal">(você)</span> : null}
          <span className="text-muted-foreground font-normal">
            {Math.min(pessoa.votos, total)}/{total}
          </span>
        </span>
      ))}
    </div>
  );
}

function DeuMatch({ prato, placar }: { prato: PratoNaVitrine; placar: Placar }) {
  return (
    <div className="space-y-5 text-center">
      <p className="text-5xl" aria-hidden>
        🎉
      </p>
      <h1 className="text-primary text-3xl font-extrabold">Deu match!</h1>
      <p className="text-muted-foreground">
        {placar.participantes.map((pessoa) => pessoa.apelido).join(', ')} querem o mesmo prato.
      </p>
      <div className="bg-card overflow-hidden rounded-3xl border text-left">
        <ArteDoPrato
          imagem={prato.imagem}
          arte={prato.arte}
          nome={prato.nome}
          tamanho="lg"
          className="aspect-[4/3] w-full"
        />
        <div className="space-y-1 p-5">
          <p className="text-xl font-extrabold">{prato.nome}</p>
          <p className="text-muted-foreground text-sm">
            {prato.loja.nome} · {prato.tempoMin} min
          </p>
          <p className="text-primary text-2xl font-extrabold">
            {prato.aPartirDe ? (
              <span className="text-muted-foreground text-sm font-normal">a partir de </span>
            ) : null}
            {formatCents(prato.precoCents)}
          </p>
        </div>
      </div>
      <Button asChild size="lg" block>
        <Link href={prato.href}>
          Pedir agora
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

function Ranking({ pratos, placar }: { pratos: PratoNaVitrine[]; placar: Placar | null }) {
  const porChave = new Map(pratos.map((prato) => [prato.chave, prato] as const));
  const lideres = (placar?.curtidas ?? [])
    .map((linha) => ({ ...linha, prato: porChave.get(linha.chave) }))
    .filter((linha) => linha.prato)
    .slice(0, 3);

  return (
    <div className="space-y-3">
      <p className="text-lg font-bold">Você passou todos os pratos.</p>
      <p className="text-muted-foreground text-sm">
        Ainda sem match — esperando os outros. Enquanto isso, os mais curtidos:
      </p>
      {lideres.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-2xl border p-4 text-sm">
          Nenhum prato curtido ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {lideres.map(({ chave, prato, total, quem }) => (
            <li key={chave}>
              <Link
                href={prato!.href}
                className="bg-card flex items-center gap-3 rounded-2xl border p-2 pr-4"
              >
                <ArteDoPrato
                  imagem={prato!.imagem}
                  arte={prato!.arte}
                  nome={prato!.nome}
                  tamanho="sm"
                  className="h-16 w-16 shrink-0 rounded-xl"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{prato!.nome}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {quem.join(', ')}
                  </span>
                </span>
                <span className="text-primary inline-flex items-center gap-1 font-bold">
                  <Heart className="h-4 w-4 fill-current" aria-hidden />
                  {total}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Entrar({ onEntrar }: { onEntrar: () => void }) {
  const [apelido, setApelido] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        iniciar(async () => {
          const resposta = await entrarNaSessao(apelido);
          if (!resposta.ok) {
            setErro(resposta.message ?? 'Não foi possível entrar.');
            return;
          }
          onEntrar();
        });
      }}
      className="mt-8 space-y-4 text-center"
    >
      <p className="text-5xl" aria-hidden>
        🍽️
      </p>
      <h1 className="text-2xl font-extrabold">Te chamaram pra decidir o que comer!</h1>
      <p className="text-muted-foreground">
        Passe os pratos: ♥ quero, ✕ não. Quando todo mundo curtir o mesmo, dá match.
      </p>
      <label htmlFor="apelido-grupo" className="sr-only">
        Como te chamam?
      </label>
      <input
        id="apelido-grupo"
        value={apelido}
        onChange={(evento) => setApelido(evento.target.value)}
        maxLength={24}
        placeholder="Como te chamam?"
        className="border-input bg-card min-h-touch w-full rounded-xl border px-4 text-center text-lg"
      />
      {erro ? <p className="text-destructive text-sm">{erro}</p> : null}
      <Button type="submit" size="lg" block isLoading={pendente} disabled={!apelido.trim()}>
        Entrar
      </Button>
    </form>
  );
}

function Aviso({
  emoji,
  titulo,
  children,
}: {
  emoji: string;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card mt-10 rounded-3xl border p-8 text-center">
      <p className="text-4xl" aria-hidden>
        {emoji}
      </p>
      <p className="mt-3 font-bold">{titulo}</p>
      {children}
    </div>
  );
}
