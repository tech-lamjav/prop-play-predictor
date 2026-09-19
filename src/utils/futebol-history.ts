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
import { type MercadoOculto, mercadoOcultoNaData } from '@/utils/futebol-mercados-ocultos';
import { cortadaNaData, type LimiarDeValor } from '@/utils/futebol-corte-de-valor';

/** Quantos dias o Histórico navega para trás. */
export const HISTORY_WINDOW_DAYS = 30;

/**
 * Janela do Histórico, em dias contando hoje: `historyWindow(hoje)` dá os 30 do
 * painel (hoje−29 … hoje), e `historyWindow(hoje, 1)` dá só hoje.
 *
 * ⚠️ O TAMANHO DA JANELA É O CUSTO DA CONSULTA, e não um detalhe de conforto.
 * A `get_futebol_value_history` percorre o snapshot de oportunidades — todas as
 * versões de todas as linhas —, e 30 dias são cerca de 40% dessa tabela: o
 * Postgres desiste do índice e varre tudo. Medido no dev em 19/09/2026, com
 * três rodadas alternadas de cada:
 *
 *   · 2 dias  → 198ms, 198ms, 199ms
 *   · 30 dias → 879ms, 1.939ms, 4.397ms
 *
 * Repare menos no número e mais na VARIÂNCIA. A janela curta é constante; a
 * longa oscila cinco vezes e piora sob carga, até estourar o tempo limite e
 * voltar HTTP 500 — que foi o erro visto no console da home. Com cache frio, a
 * de 30 dias chegou a 7,5 segundos, e esse é o preço que o primeiro visitante
 * do dia paga.
 *
 * Então peça a janela que a tela usa, não a maior que possa servir.
 */
export function historyWindow(today: string, dias = HISTORY_WINDOW_DAYS): { from: string; to: string } {
  return { from: addDays(today, -(dias - 1)), to: today };
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
  // Os mercados fora da vitrine (#324), cada um com a data em que saiu.
  //
  // O corte é a DATA, não "hoje". Antes dela a linha fica: foi publicada, vista
  // e possivelmente apostada, e escondê-la reescreveria o passado do assinante.
  // A partir dela some em qualquer tela, porque nunca esteve em nenhuma.
  //
  // Cortar por "hoje" — o que esta função fazia — deixava o mercado voltar pela
  // porta dos fundos: sumia da lista de hoje e reaparecia amanhã, no mesmo
  // jogo, quando a linha passava a vir do histórico. Em produção isso somava 31
  // linhas de Handicap que ninguém nunca viu, contra 23 de verdade.
  vitrine: readonly MercadoOculto[] = [],
  // O corte de valor por mercado (migration 144), com a data de vigência. Mesma
  // lógica da vitrine, no grão da LINHA: a que paga abaixo do limiar some a
  // partir da data, e fica antes dela. O board já chega cortado do serviço; é o
  // histórico que devolveria amanhã a linha cortada hoje.
  limiares: readonly LimiarDeValor[] = [],
): FutebolValueBoardRow[] {
  const today = brtDateStr(new Date(nowMs));
  const out: FutebolValueBoardRow[] = [];
  const hojeHist = new Map<string, FutebolValueBoardRow>();
  const hojeBoard = new Map<string, FutebolValueBoardRow>();

  for (const r of history) {
    const d = brtDayOf(r.kickoff_utc);
    if (!d) continue;
    if (mercadoOcultoNaData(r.market, r.kickoff_utc, vitrine, nowMs)) continue;
    // Pela vantagem de PUBLICAÇÃO, não pela do apito: a regra é que o que
    // apareceu no board continua aparecendo, e o que nunca apareceu some.
    // `edge` é a leitura do apito e só entra se a de publicação não vier —
    // histórico antigo, ou board servido por uma versão anterior da RPC.
    if (cortadaNaData(r.market, r.edge_publicacao ?? r.edge, r.kickoff_utc, limiares, nowMs)) continue;
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
