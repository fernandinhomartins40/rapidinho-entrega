'use client';

import { useRef, useState } from 'react';
import { Clock, Flame, Heart, Sparkles, Users, X } from 'lucide-react';
import { formatCents } from '@rapidinho/shared';
import { cn } from '@rapidinho/ui';
import { ArteDoPrato } from '@/components/app/arte-do-prato';
import type { PratoNaVitrine } from '@/lib/pratos';

/** Quanto arrastar (px) para o gesto contar como decisão. */
const LIMIAR = 90;

/**
 * Um cartão de prato que se arrasta: para a direita é "quero", para a
 * esquerda é "não". Os botões embaixo fazem o mesmo — gesto é atalho, não
 * a única porta (quem usa leitor de tela ou tem a mão ocupada também decide).
 */
export function CartaoDoBaralho({
  prato,
  onDecidir,
  desabilitado = false,
}: {
  prato: PratoNaVitrine;
  onDecidir: (gostou: boolean) => void;
  desabilitado?: boolean;
}) {
  const [deslocamento, setDeslocamento] = useState(0);
  const [saindo, setSaindo] = useState<'esquerda' | 'direita' | null>(null);
  const inicio = useRef<number | null>(null);
  const [arrastando, setArrastando] = useState(false);

  function decidir(gostou: boolean) {
    if (desabilitado || saindo) return;
    setSaindo(gostou ? 'direita' : 'esquerda');
    // Deixa a animação de saída terminar antes de trocar o cartão.
    window.setTimeout(() => {
      onDecidir(gostou);
      setSaindo(null);
      setDeslocamento(0);
    }, 220);
  }

  const dx = saindo === 'direita' ? 480 : saindo === 'esquerda' ? -480 : deslocamento;
  const intencao = dx > 30 ? 'quero' : dx < -30 ? 'nao' : null;

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label={`${prato.nome}, ${prato.loja.nome}, ${formatCents(prato.precoCents)}`}
        tabIndex={0}
        onKeyDown={(evento) => {
          if (evento.key === 'ArrowRight') decidir(true);
          if (evento.key === 'ArrowLeft') decidir(false);
        }}
        onPointerDown={(evento) => {
          if (desabilitado) return;
          inicio.current = evento.clientX;
          setArrastando(true);
          (evento.target as HTMLElement).setPointerCapture?.(evento.pointerId);
        }}
        onPointerMove={(evento) => {
          if (inicio.current == null) return;
          setDeslocamento(evento.clientX - inicio.current);
        }}
        onPointerUp={() => {
          if (inicio.current == null) return;
          inicio.current = null;
          setArrastando(false);
          if (deslocamento > LIMIAR) decidir(true);
          else if (deslocamento < -LIMIAR) decidir(false);
          else setDeslocamento(0);
        }}
        onPointerCancel={() => {
          inicio.current = null;
          setArrastando(false);
          setDeslocamento(0);
        }}
        className="bg-card relative touch-pan-y select-none overflow-hidden rounded-3xl border shadow-[0_20px_50px_rgba(0,0,0,0.5)] outline-none focus-visible:ring-4 focus-visible:ring-[#FFB900]/60"
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 18}deg)`,
          transition: arrastando ? 'none' : 'transform 220ms ease-out',
        }}
      >
        <ArteDoPrato
          imagem={prato.imagem}
          arte={prato.arte}
          nome={prato.nome}
          tamanho="lg"
          prioridade
          // Pela altura da tela, e não pela largura: nome, preço e os botões
          // precisam caber sem rolar — decidir não pode exigir rolagem.
          className="h-[min(30dvh,280px)] min-h-28 w-full [@media(max-height:700px)]:h-[22dvh]"
        />

        {intencao ? (
          <span
            aria-hidden
            className={cn(
              'absolute top-5 rounded-xl border-4 px-3 py-1 text-2xl font-black uppercase tracking-wider',
              intencao === 'quero'
                ? 'left-5 -rotate-12 border-emerald-400 text-emerald-300'
                : 'right-5 rotate-12 border-rose-400 text-rose-300',
            )}
          >
            {intencao === 'quero' ? 'Quero' : 'Não'}
          </span>
        ) : null}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {prato.jaPediu ? (
            <Selo>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Você já pediu
            </Selo>
          ) : prato.emAlta ? (
            <Selo>
              <Flame className="h-3.5 w-3.5 text-orange-300" aria-hidden />
              Muito pedido agora
            </Selo>
          ) : null}
          {prato.paraDividir ? (
            <Selo>
              <Users className="h-3.5 w-3.5" aria-hidden />
              Dá pra dividir
            </Selo>
          ) : null}
        </div>

        <div className="space-y-1 p-4">
          <p className="text-xl font-extrabold leading-tight">{prato.nome}</p>
          {prato.descricao ? (
            <p className="text-muted-foreground line-clamp-2 text-sm [@media(max-height:700px)]:hidden">
              {prato.descricao}
            </p>
          ) : null}
          <div className="flex items-end justify-between gap-3 pt-1">
            <div className="min-w-0">
              <p className="truncate font-semibold">{prato.loja.nome}</p>
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {prato.tempoMin} min
              </p>
            </div>
            <p className="shrink-0 text-right">
              {prato.aPartirDe ? (
                <span className="text-muted-foreground block text-xs">a partir de</span>
              ) : null}
              <span className="text-primary text-2xl font-extrabold">
                {formatCents(prato.precoCents)}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={() => decidir(false)}
          disabled={desabilitado}
          aria-label="Não quero este"
          className="bg-card flex h-16 w-16 items-center justify-center rounded-full border-2 border-rose-400/60 text-rose-300 shadow-lg transition-transform active:scale-90"
        >
          <X className="h-8 w-8" strokeWidth={2.6} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => decidir(true)}
          disabled={desabilitado}
          aria-label="Quero este"
          className="botao-vidro flex h-20 w-20 items-center justify-center rounded-full text-[#141414] transition-transform active:scale-90"
        >
          <Heart className="h-9 w-9 fill-current" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
      {children}
    </span>
  );
}
