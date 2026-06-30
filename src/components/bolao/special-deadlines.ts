import type { WcMatch, SpecialDeadlinesConfig } from '@/services/bolao.service';

/**
 * Prazos dos palpites especiais — espelha a função SQL
 * `special_prediction_deadline(p_type)` (migration 056). O servidor é a
 * autoridade; isto é só pra UI mostrar o prazo e travar o card client-side.
 *
 * Regra "rolável por rodada": cada palpite trava quando começa a rodada que o
 * decide. Os prêmios de jogador travam na abertura da Copa (1º jogo de todos).
 */
export type SpecialDeadlineType =
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinalist'
  | 'semifinalist'
  | 'finalist'
  | 'champion'
  | 'top_scorer'
  | 'best_goalkeeper'
  | 'best_young_player'
  | 'best_player';

/** Fase cujo PRIMEIRO jogo trava o palpite. `null` → abertura da Copa. */
const DECIDING_STAGE: Record<SpecialDeadlineType, WcMatch['stage'] | null> = {
  round_of_32: 'round_of_32', // 16 avos travam no início do mata-mata
  round_of_16: 'round_of_32', // oitavas são decididas pelos jogos dos 16 avos
  quarterfinalist: 'round_of_16',
  semifinalist: 'quarter',
  finalist: 'semi',
  champion: 'final',
  top_scorer: null,
  best_goalkeeper: null,
  best_young_player: null,
  best_player: null,
};

/** Kickoff em ms (BRT = UTC-3, sem horário de verão desde 2019). */
function kickoffMs(m: WcMatch): number {
  return new Date(`${m.match_date}T${m.match_time_brasilia}-03:00`).getTime();
}

/**
 * Tipos do chaveamento (palpite de quem avança). No modo "chaveamento real" todos
 * travam de uma vez, no início do mata-mata (1º jogo dos 16 avos) — janela curta:
 * o jogador preenche quem avança em cada fase até a final antes de começar.
 *
 * O CAMPEÃO fica de fora: o pessoal já escolheu lá no início (e ninguém aponta
 * campeão que nem passou dos 16 avos), então mantém o prazo próprio dele.
 */
const BRACKET_TYPES = new Set<SpecialDeadlineType>([
  'round_of_32',
  'round_of_16',
  'quarterfinalist',
  'semifinalist',
  'finalist',
]);

/**
 * Prazo (Date) do tipo, ou null se ainda não há jogos da fase decisiva.
 * Espelha o SQL: override por tipo vence; senão segue o preset do `config.mode`
 * ('opening' = abertura da Copa; 'rolling'/ausente = rodada que decide o tipo).
 */
export function specialDeadline(
  type: SpecialDeadlineType,
  matches: WcMatch[],
  config?: SpecialDeadlinesConfig | null,
  knockoutRealMode = false
): Date | null {
  // 1) Override explícito por tipo vence tudo.
  const override = config?.overrides?.[type];
  if (override) {
    const d = new Date(override);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (!matches?.length) return null;
  // 1.5) Modo "chaveamento real": todo o bracket trava no início do mata-mata.
  if (knockoutRealMode && BRACKET_TYPES.has(type)) {
    const times = matches
      .filter((m) => m.stage === 'round_of_32')
      .map(kickoffMs)
      .filter((t) => Number.isFinite(t));
    return times.length ? new Date(Math.min(...times)) : null;
  }
  // 2) Preset: 'opening' usa todos os jogos; 'rolling' (default) usa a fase decisiva.
  const mode = config?.mode ?? 'rolling';
  const stage = mode === 'opening' ? null : DECIDING_STAGE[type];
  const pool = stage ? matches.filter((m) => m.stage === stage) : matches;
  const times = pool.map(kickoffMs).filter((t) => Number.isFinite(t));
  if (!times.length) return null;
  return new Date(Math.min(...times));
}

/** true se o prazo já passou (relativo a `now`, default Date.now()). */
export function isSpecialLocked(
  type: SpecialDeadlineType,
  matches: WcMatch[],
  config?: SpecialDeadlinesConfig | null,
  now: number = Date.now(),
  knockoutRealMode = false
): boolean {
  const d = specialDeadline(type, matches, config, knockoutRealMode);
  return d != null && now >= d.getTime();
}

/** Rótulo curto pra badge, ex: "fecha 28/06 16h" ou "encerrado". */
export function formatDeadlineLabel(
  type: SpecialDeadlineType,
  matches: WcMatch[],
  config?: SpecialDeadlinesConfig | null,
  now: number = Date.now(),
  knockoutRealMode = false
): string | null {
  const d = specialDeadline(type, matches, config, knockoutRealMode);
  if (!d) return null;
  if (now >= d.getTime()) return 'encerrado';
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
  // "28/06, 16" → "fecha 28/06 16h"
  const parts = fmt.format(d).replace(',', '');
  return `fecha ${parts}h`;
}
