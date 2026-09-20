import type {
  FutebolAlertedPick,
  FutebolFixture,
  FutebolValueBoardRow,
} from '@/services/futebol-data.service';
import { opportunityKey } from '@/utils/futebol-history';
import { brtDayOf } from '@/utils/futebol-datas';
import { mercadoOcultoNaData, type MercadoOculto } from '@/utils/futebol-mercados-ocultos';
import { cortadaNaData, type LimiarDeValor } from '@/utils/futebol-corte-de-valor';

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
    pts_premissas: 0,
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
  vitrine = [],
  limiares = [],
  agoraMs = Date.now(),
}: {
  doBoard: OppLike[];
  registradas: readonly FutebolAlertedPick[];
  dia: string;
  fixturePorId: Map<number, FutebolFixture>;
  /**
   * A vitrine e o limiar de valor, para a REGISTRADA passar pelas mesmas regras
   * que o board e o histórico já passam (#490).
   *
   * ⚠️ O board chega aqui JÁ FILTRADO — `getValueBoard` e `mergeBoardAndHistory`
   * cuidam dele. Estes dois argumentos servem só à terceira fonte, que entrava
   * sem regra nenhuma: ela copiava os números do envio e a tela os mostrava como
   * se fossem de agora.
   *
   * Foi por essa porta que o Fiorentina × Napoli apareceu na lista com odd 2.00
   * e vantagem −6,2% — números de um envio de 13/09 para um jogo de 20/09 —
   * enquanto o detalhe do jogo mostrava outra coisa.
   *
   * ⚠️ VAZIO POR PADRÃO, e isso é deliberado: sem regra configurada, nada é
   * cortado, e quem chamar sem os dois continua vendo a lista de antes.
   */
  vitrine?: readonly MercadoOculto[];
  limiares?: readonly LimiarDeValor[];
  agoraMs?: number;
}): OppLike[] {
  // ⚠️ O DIA É DECIDIDO AQUI, e não por quem chama.
  //
  // Antes esta função confiava que o board já vinha recortado, e a página fazia
  // esse recorte por fora. Duas metades da mesma regra, em arquivos diferentes,
  // e nenhum teste sobre o todo — foi assim que uma partida ao vivo apareceu na
  // lista de cinco dias anteriores sem nada acusar. Filtrar de novo aqui é
  // barato e transforma a regra em invariante: o que sai desta função é do dia
  // pedido, ponto.
  // ⚠️ E A LISTA NÃO REPETE CHAVE. Nem entre board e registrada, nem dentro de
  // cada um dos dois.
  //
  // Isto não é asseio: as duas telas usam a chave desta linha como `key` do
  // React, e chave repetida na mesma lista quebra a reconciliação. Medido em
  // 18/09 com Atlético Torque × Cienciano, cujo "Menos de 3,5" foi enviado duas
  // vezes (12/09 e 17/09) e virava duas linhas idênticas no dia 17: ao trocar
  // para o dia 16, o React não casava os filhos e DEIXAVA uma das linhas na
  // tela — uma aposta do dia 17 aparecendo num dia em que ela não existe. E
  // acumulava: cada ida e volta somava mais uma.
  //
  // O estado nunca conteve essa linha (conferido no navegador: a lista tinha 71
  // itens e zero do Torque), só o DOM — por isso o defeito resistia a ser
  // procurado no dado. A garantia mora aqui porque é aqui que a lista nasce.
  const jaNaLista = new Set<string>();
  const doDia: OppLike[] = [];
  for (const r of doBoard) {
    if (brtDayOf(r.kickoff_utc) !== dia) continue;
    const chave = oppKey(r.fixture_id, r.market, r.outcome, r.line_value);
    if (jaNaLista.has(chave)) continue;
    jaNaLista.add(chave);
    doDia.push(r);
  }

  // Qual envio sobrevive é DECISÃO, não sorte da ordenação de quem consultou:
  // fica o MAIS ANTIGO, que é a foto de nascimento — a odd, o Score e a janela
  // com que a oportunidade foi anunciada pela primeira vez. Hoje a RPC devolve
  // por `created_at` e o resultado calhava de ser esse; depender disso é o
  // acoplamento que quebra em silêncio no dia em que ela mudar de ordem.
  const porEnvio = [...registradas].sort((a, b) =>
    (a.sent_at ?? '').localeCompare(b.sent_at ?? ''),
  );

  const soRegistradas: OppLike[] = [];
  for (const a of porEnvio) {
    if (a.game_day !== dia) continue;
    // ⚠️ AS MESMAS DUAS REGRAS DO RESTO DA LISTA, no eixo do ENVIO (#490).
    //
    // O eixo é o envio, e não o kickoff, por três motivos:
    //
    //   · é a única foto que a registrada tem. Ela não tem nascimento: tem o
    //     instante em que foi anunciada, e é com aquele preço que o assinante
    //     pôde apostar;
    //   · `sent_at` e `edge` existem sempre; `kickoff_utc` vem NULO quando a
    //     liga está fora da lista fixa do board, e filtrar por ele derrubaria
    //     justamente essas linhas;
    //   · e o passado não se reescreve: antes da vigência do limiar não havia
    //     corte para esconder nada, então a linha fica. `cortadaNaData` e
    //     `mercadoOcultoNaData` já sabem disso — a data é argumento delas.
    //
    // O board e o histórico continuam julgando pelo kickoff. A diferença de
    // eixo é conhecida, tem ticket próprio, e alinhá-la aqui seria mudar duas
    // coisas ao mesmo tempo.
    if (a.market != null) {
      if (mercadoOcultoNaData(a.market, a.sent_at, vitrine, agoraMs)) continue;
      if (cortadaNaData(a.market, a.edge, a.sent_at, limiares, agoraMs)) continue;
    }
    const chave = oppKey(a.fixture_id, a.market, a.outcome, a.line_value);
    // Dedup contra o board E contra as outras registradas. A segunda parte
    // faltava: o mesmo pick enviado em dias diferentes vira uma linha por envio
    // na origem, e a lista mostrava a oportunidade repetida — sempre no topo,
    // porque o Score é o mesmo em todas as cópias.
    if (jaNaLista.has(chave)) continue;
    jaNaLista.add(chave);
    soRegistradas.push(oppFromAlerted(a, fixturePorId.get(a.fixture_id)));
  }

  return [...doDia, ...soRegistradas];
}
