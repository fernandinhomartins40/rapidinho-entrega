'use client';

/**
 * Alerta sonoro de pedido novo.
 *
 * O som é sintetizado na hora com a Web Audio API, em vez de um arquivo: não
 * há request extra (a loja costuma estar em conexão ruim), funciona offline e
 * não depende de formato suportado pelo navegador.
 *
 * Ele repete até alguém atender. Um bipe único se perde no barulho de uma
 * cozinha — e pedido não atendido é venda perdida.
 */

const INTERVALO_MS = 4000;

let contexto: AudioContext | null = null;
let repeticao: ReturnType<typeof setInterval> | null = null;

function obterContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const Construtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Construtor) return null;

  contexto ??= new Construtor();
  return contexto;
}

/** Duas notas curtas, como uma campainha de balcão. */
function tocarUmaVez(): void {
  const ctx = obterContexto();
  if (!ctx) return;

  // O navegador suspende o contexto até haver interação do usuário; retomar
  // aqui faz o som voltar assim que o lojista clicar em qualquer lugar.
  if (ctx.state === 'suspended') void ctx.resume();

  const agora = ctx.currentTime;

  for (const [indice, frequencia] of [880, 1174.7].entries()) {
    const oscilador = ctx.createOscillator();
    const ganho = ctx.createGain();

    oscilador.type = 'sine';
    oscilador.frequency.value = frequencia;

    const inicio = agora + indice * 0.18;
    // Envelope com ataque e queda suaves: onda quadrada crua estala no
    // alto-falante de celular.
    ganho.gain.setValueAtTime(0, inicio);
    ganho.gain.linearRampToValueAtTime(0.35, inicio + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.001, inicio + 0.16);

    oscilador.connect(ganho).connect(ctx.destination);
    oscilador.start(inicio);
    oscilador.stop(inicio + 0.18);
  }
}

export function iniciarAlerta(): void {
  tocarUmaVez();

  repeticao ??= setInterval(tocarUmaVez, INTERVALO_MS);
}

export function pararAlerta(): void {
  if (repeticao) {
    clearInterval(repeticao);
    repeticao = null;
  }
}

/**
 * Destrava o áudio.
 *
 * Navegador nenhum toca som antes de o usuário interagir com a página. Chamar
 * isto no primeiro clique deixa o contexto pronto, para que o alerta do
 * primeiro pedido não seja engolido.
 */
export function prepararAudio(): void {
  const ctx = obterContexto();
  if (ctx?.state === 'suspended') void ctx.resume();
}
