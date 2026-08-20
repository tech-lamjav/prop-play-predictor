// ============================================================================
// futebol-history.ts — a costura entre o board e a foto do apito
// ============================================================================
// A aba Histórico de /futebol/oportunidades mostra a oportunidade COMO FOI
// PUBLICADA, não a nota recalculada semanas depois. O passado vem da RPC
// `get_futebol_value_history` (migrations 101 e 102), que devolve a versão do
// snapshot viva no apito; o presente e o futuro seguem vindo do board.
//
// A regra da fusão mora aqui, separada da página, porque é a única parte disso
// que dá para testar sem montar tela.
//
// ----------------------------------------------------------------------------
// CRÉDITO
// ----------------------------------------------------------------------------
// A regra de fusão e a decisão de extrair um módulo puro vêm do PR #259 do
// Matheus (`feat/futebol-value-history`), que implementou o mesmo A0 em
// paralelo, sem que nenhum dos dois lados soubesse do outro. Absorvido aqui.
//
// O que mudou em relação ao dele: as funções de calendário (`kickoffMs`,
// `brtDay`, `addDaysBrt`) saíram, porque `futebol-datas.ts` já tem as mesmas,
// já testadas, e duas cópias de aritmética de fuso é como se erra fuso.
// ============================================================================
import type { FutebolValueBoardRow } from '@/services/futebol-data.service';
import { parseUtc, brtDateStr, brtDayOf, addDays } from '@/utils/futebol-datas';

/** Quantos dias o Histórico navega para trás. */
export const HISTORY_WINDOW_DAYS = 30;

/** Janela padrão do Histórico: 30 dias contando hoje (hoje−29 … hoje). */
export function historyWindow(today: string): { from: string; to: string } {
  return { from: addDays(today, -(HISTORY_WINDOW_DAYS - 1)), to: today };
}

type KeyParts = {
  fixture_id: number;
  market: string | null;
  outcome: string | null;
  line_value: number | null;
};

/**
 * Identidade de uma oportunidade, para casar as duas fontes.
 *
 * Não tenta espelhar o `opportunity_key` do snapshot: as duas listas que se
 * cruzam aqui vêm de RPCs nossas, com as mesmas colunas, então a chave só
 * precisa ser consistente DENTRO do front. Espelhar o formato do banco criaria
 * um acoplamento que ninguém verifica e que quebra em silêncio.
 */
export function opportunityKey(o: KeyParts): string {
  return `${o.fixture_id}|${o.market ?? ''}|${o.outcome ?? ''}|${o.line_value ?? ''}`;
}

/**
 * Funde board (presente e futuro) com histórico point-in-time (passado).
 *
 *   dia passado  → só o PIT. O board do passado é a nota recalculada, e a linha
 *                  que nasceu DEPOIS do apito não tem versão viva no apito:
 *                  some, que é o efeito pretendido.
 *   dia corrente → união com desempate por oportunidade:
 *                    kickoff já passou → vence a linha do histórico (o apito)
 *                    kickoff no futuro → vence a linha do board
 *                  Sem isso o jogo das 16h sumiria da tela às 16h05, e a lista
 *                  contaria história diferente da tela de detalhe, que já cai
 *                  na foto do apito assim que o kickoff passa (migration 101).
 *   dia futuro   → só o board. A RPC nem devolve (ela corta em `kickoff < now()`
 *                  desde a 102), mas o front não depende disso.
 *
 * Segue correta depois do expurgo no mart: lá o board deixa de trazer a chave
 * do jogo encerrado, e o lado PIT já era o vencedor.
 */
export function mergeBoardAndHistory(
  board: FutebolValueBoardRow[],
  history: FutebolValueBoardRow[],
  nowMs: number,
): FutebolValueBoardRow[] {
  const today = brtDateStr(new Date(nowMs));
  const out: FutebolValueBoardRow[] = [];
  const hojeHist = new Map<string, FutebolValueBoardRow>();
  const hojeBoard = new Map<string, FutebolValueBoardRow>();

  for (const r of history) {
    const d = brtDayOf(r.kickoff_utc);
    if (!d) continue;
    if (d < today) out.push(r);
    else if (d === today) hojeHist.set(opportunityKey(r), r);
    // d > today: a RPC não devolve; se um dia devolver, o board manda.
  }

  for (const r of board) {
    const d = brtDayOf(r.kickoff_utc);
    if (!d) continue;
    if (d < today) continue; // passado é território do PIT, sempre
    if (d > today) out.push(r);
    else hojeBoard.set(opportunityKey(r), r);
  }

  for (const k of new Set([...hojeHist.keys(), ...hojeBoard.keys()])) {
    const h = hojeHist.get(k);
    const b = hojeBoard.get(k);
    const ms = parseUtc((h ?? b)!.kickoff_utc)?.getTime() ?? null;
    const comecou = ms != null && ms <= nowMs;
    const vencedora = comecou ? (h ?? b) : (b ?? h);
    if (vencedora) out.push(vencedora);
  }

  return out;
}
