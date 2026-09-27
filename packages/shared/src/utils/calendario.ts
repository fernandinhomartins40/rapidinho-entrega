/**
 * "Hoje" e "este mês" no fuso da operação, não no do servidor.
 *
 * O servidor roda em UTC. `setHours(0, 0, 0, 0)` ali marca meia-noite de
 * Londres, que em Brasília é 21h do dia anterior: às 21h o "Encerrados hoje"
 * do lojista zerava no meio do expediente, e o faturamento do dia virava o do
 * dia seguinte. Estas funções devolvem o instante (UTC) em que o dia ou o mês
 * começam em Brasília.
 */

const FUSO_DA_OPERACAO = 'America/Sao_Paulo';

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  deslocamentoMs: number;
}

/** Data de calendário no fuso e quanto o fuso está deslocado de UTC. */
function partesNoFuso(instante: Date, fuso: string): Partes {
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const valores = Object.fromEntries(
    formato.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  ) as Record<string, string>;

  const ano = Number(valores.year);
  const mes = Number(valores.month);
  const dia = Number(valores.day);
  const comoUtc = Date.UTC(
    ano,
    mes - 1,
    dia,
    Number(valores.hour),
    Number(valores.minute),
    Number(valores.second),
  );
  const semMs = instante.getTime() - instante.getMilliseconds();

  return { ano, mes, dia, deslocamentoMs: comoUtc - semMs };
}

/** Meia-noite de hoje (ou de `diasAtras` dias atrás) em Brasília. */
export function inicioDoDia(
  agora: Date = new Date(),
  diasAtras = 0,
  fuso = FUSO_DA_OPERACAO,
): Date {
  const { ano, mes, dia, deslocamentoMs } = partesNoFuso(agora, fuso);
  return new Date(Date.UTC(ano, mes - 1, dia - diasAtras) - deslocamentoMs);
}

/** Dia 1 deste mês (ou de `mesesAtras` meses atrás), meia-noite em Brasília. */
export function inicioDoMes(
  agora: Date = new Date(),
  mesesAtras = 0,
  fuso = FUSO_DA_OPERACAO,
): Date {
  const { ano, mes, deslocamentoMs } = partesNoFuso(agora, fuso);
  return new Date(Date.UTC(ano, mes - 1 - mesesAtras, 1) - deslocamentoMs);
}
