import type {
  FutebolAlertedPick,
  FutebolFixture,
  FutebolValueBoardRow,
} from '@/services/futebol-data.service';
import { opportunityKey } from '@/utils/futebol-history';

/**
 * A lista de oportunidades de um dia, como as telas a montam.
 *
 * Esta função mora aqui, e não dentro de uma tela, porque a home e o painel
 * precisam mostrar a MESMA lista. Enquanto ela era privada do painel, a home
 * somava só o board e o histórico: num sábado com seis oportunidades, mostrava
 * três, e as duas telas contavam histórias diferentes do mesmo dia.
 */

/**
 * Linha da lista. O board sempre traz Score, faixa, chance e valor; uma
 * oportunidade REGISTRADA (que existiu no dia e o board não tem mais, porque o
 * mart é full-refresh e re-escolhe a janela de odds) pode não ter esses números
 * do instante em que era oportunidade — nas enviadas antes da migration 091 não
 * foram guardados. Ela continua sendo oportunidade do dia; só esses campos ficam
 * vazios. FutebolValueBoardRow é atribuível a isto (number → number | null).
 */
export type OppLike = Omit<
  FutebolValueBoardRow,
  'score' | 'faixa' | 'edge' | 'prob_justa_fechamento' | 'score_versao'
> & {
  score: number | null;
  faixa: string | null;
  edge: number | null;
  prob_justa_fechamento: number | null;
  /**
   * Ausente na oportunidade registrada: a tabela de picks nunca guardou versão,
   * e carimbá-la de legacy faria a legenda achar que toda janela é mista.
   */
  score_versao?: FutebolValueBoardRow['score_versao'];
};

/**
 * Chave de uma oportunidade — casa board, histórico e registro do que foi
 * enviado. Reexportada de `futebol-history.ts` com a forma que as telas usam
 * (argumentos soltos em vez de objeto): eram duas funções produzindo string
 * byte a byte idêntica, e duas chaves que "por acaso" batem é o tipo de coisa
 * que só quebra depois que alguém mexe numa delas.
 */
export const oppKey = (
  fixtureId: number,
  market: string | null,
  outcome: string | null,
  line: number | null,
) => opportunityKey({ fixture_id: fixtureId, market, outcome, line_value: line });

/**
 * Monta a linha de uma oportunidade registrada (enviada no daily) com os valores
 * do momento do envio. Sem fixture casado, cai pro "Casa × Fora" do registro:
 * é melhor manter a oportunidade na lista sem escudo do que perder o registro.
 */
export function oppFromAlerted(a: FutebolAlertedPick, fx?: FutebolFixture): OppLike {
  const [rawHome, rawAway] = a.match_description.split('×');
  return {
    fixture_id: a.fixture_id,
    home_team_id: fx?.home_team_id ?? 0,
    away_team_id: fx?.away_team_id ?? 0,
    home_team_name: fx?.home_team_name ?? (rawHome?.trim() || 'Casa'),
    away_team_name: fx?.away_team_name ?? (rawAway?.trim() || 'Fora'),
    competition: a.league ?? '',
    kickoff_utc: fx?.kickoff_utc ?? null,
    status_short: fx?.status_short ?? null,
    market: a.market!,
    outcome: a.outcome!,
    line_value: a.line_value,
    best_odd: Number(a.odds),
    best_book: '',
    avg_odd: Number(a.odds),
    n_casas: 0,
    janela_usada: a.janela_usada ?? '',
    pts_valor: 0,
    pts_premissas: 0,
    pts_corroboracao: 0,
    penalidades: 0,
    evidencias: [],
    premissas_sem_dado: 0,
    // Números do instante em que era oportunidade. Null nas enviadas antes da
    // migration 091 (o pipeline sobrescreve a janela e destrói chance/valor/Score
    // da manhã); daí em diante vêm preenchidos e a linha fica igual à do board.
    score: a.score,
    faixa: a.faixa,
    edge: a.edge,
    prob_justa_fechamento: a.prob_justa_fechamento,
  };
}

/**
 * As oportunidades de um dia: o que o board e o histórico têm, mais o que foi
 * enviado no daily e o board não tem mais.
 */
export function oportunidadesDoDia({
  doBoard,
  registradas,
  dia,
  fixturePorId,
}: {
  doBoard: OppLike[];
  registradas: readonly FutebolAlertedPick[];
  dia: string;
  fixturePorId: Map<number, FutebolFixture>;
}): OppLike[] {
  const jaNaLista = new Set(
    doBoard.map((r) => oppKey(r.fixture_id, r.market, r.outcome, r.line_value)),
  );
  const soRegistradas = registradas
    .filter((a) => a.game_day === dia)
    .filter((a) => !jaNaLista.has(oppKey(a.fixture_id, a.market, a.outcome, a.line_value)))
    .map((a) => oppFromAlerted(a, fixturePorId.get(a.fixture_id)));
  return [...doBoard, ...soRegistradas];
}
