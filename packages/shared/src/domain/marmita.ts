import { toLocalMoment } from './store-hours';

/**
 * Marmita: tamanho com preço fixo e cardápio da semana.
 *
 * Cada item tem um papel: o que VEM NO PRATO (o cliente pede sem, pouco ou
 * mais, sem mudar o preço), a MISTURA (escolhe até o máximo do tamanho; a
 * especial tem acréscimo) e o EXTRA pago. O item sai nos dias marcados — sem
 * dia marcado, sai todo dia — e "acabou hoje" tira do ar até a meia-noite.
 */

export type PapelNaMarmita = 'NO_PRATO' | 'MISTURA' | 'EXTRA';
export type AjusteDaMarmita = 'SEM' | 'POUCO' | 'MAIS' | 'ESCOLHIDO';

/** O que dá para pedir em cada item que vem no prato ("normal" não se grava). */
export const AJUSTES_DO_PRATO = ['SEM', 'POUCO', 'MAIS'] as const;

export const NOMES_DOS_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

/** Dia da semana de hoje no fuso da operação (0 = domingo). */
export function diaDaSemanaLocal(agora: Date = new Date()): number {
  return toLocalMoment(agora).weekday;
}

/** Filtro do Prisma: itens no cardápio de hoje. Usa `AND` na raiz. */
export function marmitaNoCardapioHoje(agora: Date = new Date()) {
  const dia = diaDaSemanaLocal(agora);
  return {
    isAvailable: true,
    AND: [
      { OR: [{ pausedUntil: null }, { pausedUntil: { lte: agora } }] },
      { OR: [{ weekdays: { isEmpty: true } }, { weekdays: { has: dia } }] },
    ],
  };
}

export function marmitaForaDoCardapio(
  item: { isAvailable: boolean; pausedUntil: Date | null; weekdays: number[] },
  agora: Date = new Date(),
): boolean {
  if (!item.isAvailable) return true;
  if (item.pausedUntil != null && item.pausedUntil > agora) return true;
  return item.weekdays.length > 0 && !item.weekdays.includes(diaDaSemanaLocal(agora));
}

export interface EscolhaDaMarmita {
  nome: string;
  papel: PapelNaMarmita;
  ajuste: AjusteDaMarmita;
  precoCents: number;
}

/** Tamanho + acréscimo das misturas + extras. Ajuste do prato não muda preço. */
export function precoDaMarmita(tamanhoCents: number, escolhas: EscolhaDaMarmita[]): number {
  return escolhas.reduce(
    (soma, escolha) =>
      escolha.ajuste === 'ESCOLHIDO' && escolha.papel !== 'NO_PRATO'
        ? soma + escolha.precoCents
        : soma,
    tamanhoCents,
  );
}

/** "SEM feijão", "POUCO arroz", "MAIS salada": linha de ajuste do prato. */
export function ehAjusteDoPrato(nome: string): boolean {
  return /^(SEM|POUCO|MAIS) /.test(nome);
}

/**
 * Complemento na comanda: o ajuste vai sem "+" (a cozinha lê "SEM feijão", não
 * "+ SEM feijão"); os demais levam "+" e a quantidade só quando passa de um.
 */
export function linhaDoComplemento(nome: string, quantidade: number): string {
  if (ehAjusteDoPrato(nome)) return nome;
  return quantidade > 1 ? `+ ${quantidade}× ${nome}` : `+ ${nome}`;
}

const ROTULO_DO_AJUSTE: Record<Exclude<AjusteDaMarmita, 'ESCOLHIDO'>, string> = {
  SEM: 'SEM',
  POUCO: 'POUCO',
  MAIS: 'MAIS',
};

/**
 * Linhas da comanda, no formato dos complementos do pedido: a cozinha lê
 * "Mistura: Frango grelhado", "Ajustes: SEM feijão", "Extras: Ovo frito".
 */
export function linhasDaMarmita(
  escolhas: EscolhaDaMarmita[],
): { grupo: string; nome: string; precoCents: number }[] {
  const ordem: Record<PapelNaMarmita, number> = { MISTURA: 0, NO_PRATO: 1, EXTRA: 2 };
  return [...escolhas]
    .sort((a, b) => ordem[a.papel] - ordem[b.papel])
    .map((escolha) =>
      escolha.papel === 'NO_PRATO'
        ? {
            grupo: 'Ajustes',
            nome: `${ROTULO_DO_AJUSTE[escolha.ajuste as 'SEM' | 'POUCO' | 'MAIS']} ${escolha.nome.toLowerCase()}`,
            precoCents: 0,
          }
        : {
            grupo: escolha.papel === 'MISTURA' ? 'Mistura' : 'Extras',
            nome: escolha.nome,
            precoCents: escolha.precoCents,
          },
    );
}
