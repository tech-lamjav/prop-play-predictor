// Datas e horários do módulo Futebol, em fuso de Brasília.
//
// Existe porque `parseUtc`, `fmtTime` e `isFinished` estavam copiados em
// FutebolHoje.tsx e FutebolJogos.tsx, e as duas cópias divergiam no ponto que mais
// importa: qual é "o dia" de um jogo.
//
// REGRA: o dia de um jogo vem do KICKOFF convertido pra BRT, nunca de
// `fact_fixtures.date_utc`. O `date_utc` é data UTC, então jogo às 21:30 de quarta
// em Brasília (00:30 de quinta em UTC) cai no dia seguinte se você agrupar por ele.
// São 288 dos 2.128 jogos de 2026, justamente os noturnos. O backend tem a mesma
// regra em `public.futebol_dia_brt` (migration 092) e a RPC da agenda já devolve
// `day_brt` pronto; estas funções são pro que o front calcula por conta.

export const SAO_PAULO_TZ = 'America/Sao_Paulo';

/**
 * Formatador de data reaproveitado, guardado pela combinação de idioma e opções.
 *
 * ⚠️ NUNCA escreva `new Intl.DateTimeFormat(...)` dentro de uma função que o
 * módulo chama em laço — use esta. Construir um formatador custa ~216µs; reusá-lo
 * custa ~3µs. São 66 vezes, medido neste projeto em 19/09/2026, num desktop —
 * no celular a distância é maior.
 *
 * Não é detalhe de microssegundo. `brtDateStr` é chamada uma vez por jogo e uma
 * vez por oportunidade, em vários laços a cada render: num sábado cheio, trocar
 * de dia na régua travava a tela por 1,4 segundo, quase tudo gasto construindo
 * milhares de vezes o mesmo formatador. É de onde vinha a interação de 2,8s que
 * o PostHog media na home.
 *
 * O mapa não cresce sem limite: as opções vêm de literais no código, não de
 * dado do usuário, e hoje são meia dúzia de combinações no módulo inteiro.
 */
const formatadores = new Map<string, Intl.DateTimeFormat>();
export function formatadorDeData(
  locale: string,
  opcoes: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const chave = `${locale}|${JSON.stringify(opcoes)}`;
  const guardado = formatadores.get(chave);
  if (guardado) return guardado;
  const novo = new Intl.DateTimeFormat(locale, opcoes);
  formatadores.set(chave, novo);
  return novo;
}

/**
 * Interpreta string do banco como UTC. Aceita data pura (`2026-08-01`), timestamp
 * sem fuso (`2026-08-01T00:30:00`), que é o formato de `kickoff_utc`, e a forma
 * crua com ESPAÇO no lugar do `T` (`2026-08-01 00:30:00`). Sem o `Z` forçado, o
 * browser leria o timestamp como hora LOCAL e o horário sairia errado.
 *
 * O separador com espaço entrou pela #439: a cópia desta função do lado das
 * mensagens decide se uma linha está escondida na data dela, e devolver nulo ali
 * fazia a regra tratar a data como ilegível — que, com período fechado, NÃO
 * esconde. Os outros leitores de kickoff daquele lado já normalizavam a forma
 * com espaço, e esta era a única que não.
 */
export function parseUtc(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const iso = raw.includes('T')
    ? raw
    : raw.includes(' ')
      ? raw.replace(' ', 'T')
      : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}

// A função mais chamada do arquivo, e por isso a única com formatador próprio:
// aqui nem o `JSON.stringify` da chave do mapa se justifica.
const DIA_BRT = new Intl.DateTimeFormat('en-CA', {
  // en-CA porque formata como YYYY-MM-DD, que é ordenável como string.
  timeZone: SAO_PAULO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Dia do jogo em BRT no formato `YYYY-MM-DD`. Espelha `public.futebol_dia_brt`. */
export function brtDateStr(d: Date): string {
  return DIA_BRT.format(d);
}

/** Dia BRT direto do kickoff cru do banco. Atalho do par parseUtc + brtDateStr. */
export function brtDayOf(kickoffUtc: string | null | undefined): string | null {
  const d = parseUtc(kickoffUtc);
  return d ? brtDateStr(d) : null;
}

/** Hoje em BRT (`YYYY-MM-DD`). Chamar na hora do uso, não guardar em const de módulo. */
export function brtToday(): string {
  return brtDateStr(new Date());
}

/** Soma dias a uma chave `YYYY-MM-DD` e devolve outra chave. Imune a fuso: usa meio-dia UTC. */
export function addDays(dayKey: string, delta: number): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  // ⚠️ Fala o que aconteceu, em vez de deixar o `toISOString` estourar um
  // `RangeError: Invalid time value` sem dizer de onde veio.
  //
  // Custou uma investigação inteira: a tela de Oportunidades passava um dia
  // `undefined` daqui para o board de exemplo no carregamento frio, e o que
  // chegava ao console era só "Invalid time value" no meio de código
  // minificado, com a página em branco. A chave errada é o fato interessante,
  // e ela estava a uma linha de ser dita.
  if (isNaN(d.getTime())) {
    throw new RangeError(`addDays recebeu um dia ilegível: ${JSON.stringify(dayKey)}`);
  }
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Dias inteiros entre duas chaves `YYYY-MM-DD`. Positivo quando `ate` é depois.
 *
 * Imune a fuso pelo mesmo truque de `addDays`: meio-dia UTC está longe das duas
 * bordas do dia, então o horário de verão de qualquer lado não muda a conta.
 *
 * Vive aqui porque o CRM tinha DUAS cópias dela, uma em `crm-painel.ts` para
 * contar há quantos dias um lead está parado e outra em `crm-cobranca.ts` para
 * contar quanto falta até uma assinatura vencer. As duas já divergiam no
 * comentário, que é sempre o primeiro sinal.
 */
export function diasEntre(de: string, ate: string): number {
  const ms = Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** `HH:MM` em BRT. */
export function fmtTime(raw: string | null | undefined): string {
  const d = parseUtc(raw);
  if (!d) return '';
  return formatadorDeData('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Cabeçalho de dia a partir de uma chave `YYYY-MM-DD` (ex.: "Quarta-feira, 29 de jul").
 * Recebe a CHAVE do dia, não um kickoff: quem agrupa já resolveu o fuso.
 */
export function fmtDayHeader(dayKey: string | null | undefined): string {
  if (!dayKey) return '—';
  // Meio-dia UTC: qualquer hora entre 03:00 e 21:00 UTC cai no mesmo dia civil em
  // BRT (UTC−3), então o rótulo não escorrega pro dia vizinho.
  const d = new Date(`${dayKey}T12:00:00Z`);
  if (isNaN(d.getTime())) return '—';
  const s = formatadorDeData('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  })
    .format(d)
    .replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Dia sem o dia da semana: "21 de mar", ou "21 de mar de 2027" com `comAno`.
 * Pra intervalo (temporada de 15/ago a 30/mai), repetir "Sábado," nas duas pontas
 * só ocupa espaço, e o ano importa quando a temporada atravessa o ano.
 */
export function fmtDayShort(dayKey: string | null | undefined, comAno = false): string {
  if (!dayKey) return '—';
  const d = new Date(`${dayKey}T12:00:00Z`);
  if (isNaN(d.getTime())) return '—';
  return formatadorDeData('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    day: '2-digit',
    month: 'short',
    ...(comAno ? { year: 'numeric' } : {}),
  })
    .format(d)
    .replace('.', '');
}

/** Ano de uma chave `YYYY-MM-DD`. */
export function yearOf(dayKey: string | null | undefined): string | null {
  return dayKey?.slice(0, 4) ?? null;
}

/** Rótulo curto pra régua de datas: `{ weekday: 'qua', day: '29/07' }`. */
export function fmtDayChip(dayKey: string): { weekday: string; day: string } {
  const d = new Date(`${dayKey}T12:00:00Z`);
  const weekday = formatadorDeData('pt-BR', { timeZone: SAO_PAULO_TZ, weekday: 'short' })
    .format(d)
    .replace('.', '');
  const day = formatadorDeData('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), day };
}

/** Jogo encerrado (inclui prorrogação e pênaltis). */
export function isFinished(status: string | null | undefined): boolean {
  return status === 'FT' || status === 'AET' || status === 'PEN';
}

/**
 * Jogo rolando agora. `status_short` da API-Football: 1H/2H primeiro e segundo
 * tempo, HT intervalo, ET prorrogação, BT pausa antes da prorrogação, P pênaltis,
 * LIVE genérico.
 */
export function isLive(status: string | null | undefined): boolean {
  return (
    status === '1H' ||
    status === '2H' ||
    status === 'HT' ||
    status === 'ET' ||
    status === 'BT' ||
    status === 'P' ||
    status === 'LIVE'
  );
}

/**
 * O momento real do início vence o status recebido da fonte. Ela pode demorar a
 * trocar de "NS" para "1H", mas não devemos continuar oferecendo registro de
 * aposta depois do apito inicial.
 */
export function hasKickoffPassed(kickoffUtc: string | null | undefined, now = new Date()): boolean {
  const kickoff = parseUtc(kickoffUtc);
  return kickoff != null && kickoff.getTime() <= now.getTime();
}
