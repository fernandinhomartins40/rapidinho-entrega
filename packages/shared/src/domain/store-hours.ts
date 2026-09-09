/**
 * Cálculo de "loja aberta agora".
 *
 * Três coisas fecham uma loja, nesta ordem de precedência:
 *  1. pausa de emergência ("fechar agora", com prazo);
 *  2. fechamento programado/feriado;
 *  3. o horário do dia da semana.
 *
 * O horário é guardado em minutos desde a meia-noite. Um fechamento maior que
 * 1440 significa que a loja vira o dia (abre 18:00 e fecha 02:00 → 1560).
 */

export const TIMEZONE = 'America/Sao_Paulo';

export const MINUTES_IN_DAY = 1440;

export interface StoreHourWindow {
  weekday: number;
  opensAt: number;
  closesAt: number;
  isActive: boolean;
}

export interface StoreClosureWindow {
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
}

export interface StoreOpenInput {
  hours: StoreHourWindow[];
  closures?: StoreClosureWindow[];
  pausedUntil?: Date | null;
  pauseReason?: string | null;
  now?: Date;
}

export interface StoreOpenResult {
  isOpen: boolean;
  /// Motivo do fechamento, pronto para exibir ao cliente.
  reason?: string;
  /// Minutos até fechar, quando aberta.
  closesInMinutes?: number;
  /// Próxima abertura, quando fechada por horário.
  nextOpensAt?: { weekday: number; minute: number };
}

interface LocalMoment {
  weekday: number;
  minuteOfDay: number;
}

/** Converte um Date para dia da semana e minuto do dia no fuso da operação. */
export function toLocalMoment(date: Date, timeZone = TIMEZONE): LocalMoment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? '';

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const hour = Number(lookup('hour'));
  const minute = Number(lookup('minute'));

  return {
    weekday: weekdayMap[lookup('weekday')] ?? 0,
    // Intl com hour12:false devolve 24 para meia-noite em alguns runtimes.
    minuteOfDay: (hour % 24) * 60 + minute,
  };
}

function windowContains(window: StoreHourWindow, minuteOfDay: number): boolean {
  if (window.closesAt > MINUTES_IN_DAY) {
    // Janela que vira o dia: 18:00–02:00 cobre 1080..1440 do próprio dia.
    return minuteOfDay >= window.opensAt && minuteOfDay < MINUTES_IN_DAY;
  }
  return minuteOfDay >= window.opensAt && minuteOfDay < window.closesAt;
}

/** Janela do dia anterior que ainda está valendo (madrugada). */
function overnightFromPreviousDay(window: StoreHourWindow, minuteOfDay: number): boolean {
  if (window.closesAt <= MINUTES_IN_DAY) return false;
  return minuteOfDay < window.closesAt - MINUTES_IN_DAY;
}

export function isStoreOpen(input: StoreOpenInput): StoreOpenResult {
  const now = input.now ?? new Date();

  if (input.pausedUntil && input.pausedUntil.getTime() > now.getTime()) {
    return {
      isOpen: false,
      reason: input.pauseReason ?? 'A loja pausou os pedidos temporariamente',
    };
  }

  const closure = input.closures?.find(
    (item) => item.startsAt.getTime() <= now.getTime() && item.endsAt.getTime() > now.getTime(),
  );
  if (closure) {
    return { isOpen: false, reason: closure.reason ?? 'Loja fechada nesta data' };
  }

  const { weekday, minuteOfDay } = toLocalMoment(now);
  const activeHours = input.hours.filter((hour) => hour.isActive);

  const todayWindow = activeHours
    .filter((hour) => hour.weekday === weekday)
    .find((hour) => windowContains(hour, minuteOfDay));

  if (todayWindow) {
    const closesAt = Math.min(todayWindow.closesAt, MINUTES_IN_DAY);
    return { isOpen: true, closesInMinutes: closesAt - minuteOfDay };
  }

  const yesterday = (weekday + 6) % 7;
  const overnightWindow = activeHours
    .filter((hour) => hour.weekday === yesterday)
    .find((hour) => overnightFromPreviousDay(hour, minuteOfDay));

  if (overnightWindow) {
    return {
      isOpen: true,
      closesInMinutes: overnightWindow.closesAt - MINUTES_IN_DAY - minuteOfDay,
    };
  }

  return {
    isOpen: false,
    reason: 'Loja fechada agora',
    ...(findNextOpening(activeHours, weekday, minuteOfDay) ?? {}),
  };
}

function findNextOpening(
  hours: StoreHourWindow[],
  weekday: number,
  minuteOfDay: number,
): { nextOpensAt: { weekday: number; minute: number } } | null {
  for (let offset = 0; offset < 7; offset += 1) {
    const day = (weekday + offset) % 7;
    const candidates = hours
      .filter((hour) => hour.weekday === day)
      .filter((hour) => offset > 0 || hour.opensAt > minuteOfDay)
      .sort((a, b) => a.opensAt - b.opensAt);

    const next = candidates[0];
    if (next) {
      return { nextOpensAt: { weekday: day, minute: next.opensAt } };
    }
  }
  return null;
}

const WEEKDAY_LABELS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? '';
}

/** 1080 → "18:00" */
export function minuteToTime(minute: number): string {
  const normalized = ((minute % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** "18:00" → 1080 */
export function timeToMinute(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}
