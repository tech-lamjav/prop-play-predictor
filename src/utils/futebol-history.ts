// ── Histórico point-in-time do board (ADR 0009 / issue #257) ────────────────
//
// A aba Histórico de /futebol/oportunidades mostra a oportunidade COMO FOI
// PUBLICADA, não a nota recalculada semanas depois. O passado vem da RPC
// `get_futebol_value_history`, que devolve a versão do snapshot viva no apito
// (`dbt_valid_from <= kickoff < dbt_valid_to`); o presente/futuro segue vindo do
// board. Aqui mora a costura entre as duas fontes — pura, pra ser testável.
import type { FutebolValueBoardRow } from '@/services/futebol-data.service';

export const SAO_PAULO_TZ = 'America/Sao_Paulo';

const DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** `kickoff_utc` vem do Postgres como timestamp SEM fuso — é UTC, e é lido como tal. */
export function kickoffMs(raw: string | null): number | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/** Dia de Brasília (YYYY-MM-DD) de um instante. */
export function brtDayFromMs(ms: number): string {
  return DAY_FMT.format(new Date(ms));
}

/**
 * Dia de Brasília de um kickoff. O fuso importa de verdade aqui: 21:30 BRT é
 * 00:30 UTC do dia seguinte, horário de metade do calendário brasileiro.
 */
export function brtDay(raw: string | null): string | null {
  const ms = kickoffMs(raw);
  return ms == null ? null : brtDayFromMs(ms);
}

/** Aritmética de calendário sobre YYYY-MM-DD, sem fuso no meio. */
export function addDaysBrt(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + delta * 864e5);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

export const HISTORY_WINDOW_DAYS = 30;

/** Janela padrão do Histórico: 30 dias contando hoje (hoje-29 .. hoje). */
export function historyWindow(today: string): { from: string; to: string } {
  return { from: addDaysBrt(today, -(HISTORY_WINDOW_DAYS - 1)), to: today };
}

type KeyParts = { fixture_id: number; market: string; outcome: string; line_value: number | null };

/** Espelha o `opportunity_key` do snapshot: `fixture|market|outcome|line` (nula = NONE). */
export function opportunityKey(o: KeyParts): string {
  return `${o.fixture_id}|${o.market}|${o.outcome}|${o.line_value ?? 'NONE'}`;
}

/**
 * Funde board (presente/futuro) e histórico PIT (passado) numa lista só.
 *
 *   dia passado  -> só o PIT. O board do passado é a nota recalculada, e as
 *                   linhas que nasceram DEPOIS do apito não têm versão viva no
 *                   apito: somem, que é o efeito pretendido.
 *   dia corrente -> união com dedup por `opportunity_key`:
 *                     kickoff já passou -> vence a linha do hist (PIT)
 *                     kickoff no futuro -> vence a linha do board
 *                     nunca as duas
 *                   Sem isso o jogo das 16h sumiria da tela às 16h05.
 *   dia futuro   -> só o board (o hist não tem apito pra apontar).
 *
 * A regra segue correta depois do expurgo do mart: lá o board deixa de trazer a
 * chave do jogo encerrado, e o lado PIT já era o vencedor.
 */
export function mergeBoardAndHistory(
  board: FutebolValueBoardRow[],
  history: FutebolValueBoardRow[],
  nowMs: number,
): FutebolValueBoardRow[] {
  const today = brtDayFromMs(nowMs);
  const out: FutebolValueBoardRow[] = [];
  const hojeHist = new Map<string, FutebolValueBoardRow>();
  const hojeBoard = new Map<string, FutebolValueBoardRow>();

  for (const r of history) {
    const d = brtDay(r.kickoff_utc);
    if (!d) continue;
    if (d < today) out.push(r);
    else if (d === today) hojeHist.set(opportunityKey(r), r);
    // d > today: a RPC não devolve (só apito dado); se devolver, o board manda.
  }

  for (const r of board) {
    const d = brtDay(r.kickoff_utc);
    if (!d) continue;
    if (d < today) continue;
    if (d > today) out.push(r);
    else hojeBoard.set(opportunityKey(r), r);
  }

  for (const k of new Set([...hojeHist.keys(), ...hojeBoard.keys()])) {
    const h = hojeHist.get(k);
    const b = hojeBoard.get(k);
    const ms = kickoffMs((h ?? b)!.kickoff_utc);
    const comecou = ms != null && ms <= nowMs;
    const vencedora = comecou ? h : b;
    if (vencedora) out.push(vencedora);
  }

  return out;
}
