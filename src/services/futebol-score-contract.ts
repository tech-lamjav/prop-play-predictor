import type {
  FutebolFixtureValueRow,
  FutebolValueBoardRow,
} from './futebol-data.service';

/**
 * Em que ESCALA a nota foi calculada.
 *
 * `legacy` não é mais um contrato aceito na entrada — é um dado do passado. O
 * histórico é point-in-time e continua devolvendo as 19.229 linhas anteriores
 * ao cutover de 03/09/2026, calculadas na régua antiga. Elas precisam continuar
 * abrindo, e a faixa delas tem fronteira própria: ver `fronteirasDoScore` em
 * `utils/futebol-score.ts`, com o teste que fixa a diferença em
 * `utils/futebol-faixas.test.ts`.
 *
 * ⚠️ Quem for apagar `legacy` daqui: sem ele, uma oportunidade antiga de Score
 * 35 passa a aparecer como Média quando na época era Baixa. A tela reescreve o
 * passado de quem apostou.
 */
export type FutebolScoreVersion = 'legacy' | 'contexto_v1';

type RawBoardRow = Omit<Partial<FutebolValueBoardRow>, 'score_versao'> & {
  score_versao?: unknown;
  [key: string]: unknown;
};

type RawFixtureRow = Omit<Partial<FutebolFixtureValueRow>, 'score_versao'> & {
  score_versao?: unknown;
  [key: string]: unknown;
};

/**
 * A versão vem DECLARADA, e ponto.
 *
 * Havia aqui uma dedução pela forma da linha: componentes de preço numéricos
 * viravam `legacy` por conta própria. Era andaime da expansão, quando a RPC
 * ainda podia responder na forma antiga enquanto o mart migrava. As três RPCs
 * declaram a versão desde a virada, então a dedução passou a ser pior que
 * inútil — carimbaria de `legacy` uma resposta malformada e a classificaria na
 * régua errada, em silêncio (#310).
 */
function scoreVersion(row: { score_versao?: unknown }): FutebolScoreVersion {
  if (row.score_versao == null) {
    throw new Error('O contrato do Score exige score_versao');
  }
  if (row.score_versao === 'legacy') return 'legacy';
  if (row.score_versao === 'contexto_v1') return 'contexto_v1';
  throw new Error(`Versão do Score desconhecida: ${String(row.score_versao)}`);
}

/**
 * Porta de entrada do board: valida a versão e estreita o tipo.
 *
 * Ela injetava também os componentes de preço zerados (`pts_valor`,
 * `pts_corroboracao`), para que consumidores da metodologia antiga não
 * quebrassem durante a virada. Esses consumidores não existem mais, e os campos
 * saíram do contrato junto com eles.
 */
export function normalizeFutebolValueBoardRows(
  rows: readonly RawBoardRow[],
): FutebolValueBoardRow[] {
  return rows.map((row) => ({
    ...row,
    score_versao: scoreVersion(row),
  })) as FutebolValueBoardRow[];
}

/** Mesma porta, para a RPC de detalhe. */
export function normalizeFutebolFixtureValueRows(
  rows: readonly RawFixtureRow[],
): FutebolFixtureValueRow[] {
  return rows.map((row) => ({
    ...row,
    score_versao: scoreVersion(row),
  })) as FutebolFixtureValueRow[];
}
