import type {
  FutebolFixtureValueRow,
  FutebolValueBoardRow,
} from './futebol-data.service';

/**
 * Em que ESCALA a nota foi calculada.
 *
 * `legacy` não é um contrato aceito na entrada — é um dado do passado. O
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

/** A linha como ela chega da RPC, antes de a versão ser validada. */
type RawScoreRow = { score_versao?: unknown };

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
function scoreVersion(row: RawScoreRow): FutebolScoreVersion {
  if (row.score_versao == null) {
    throw new Error('O contrato do Score exige score_versao (legacy | contexto_v1)');
  }
  if (row.score_versao === 'legacy') return 'legacy';
  if (row.score_versao === 'contexto_v1') return 'contexto_v1';
  throw new Error(`Versão do Score desconhecida: ${String(row.score_versao)}`);
}

/**
 * A porta de entrada das RPCs de valor: valida a versão e estreita o tipo.
 *
 * É uma função só porque board e detalhe passaram a fazer exatamente a mesma
 * coisa. Elas eram duas enquanto cada uma tinha o seu conjunto de componentes
 * de preço para zerar; sem eles, manter duas cópias seria manter a chance de
 * uma divergir da outra (#310).
 *
 * O tipo de saída é escolhido por quem chama, que é quem sabe qual RPC
 * respondeu.
 */
export function normalizeFutebolScoreRows<
  T extends FutebolValueBoardRow | FutebolFixtureValueRow,
>(rows: readonly RawScoreRow[]): T[] {
  return rows.map((row) => ({
    ...row,
    score_versao: scoreVersion(row),
  })) as T[];
}
