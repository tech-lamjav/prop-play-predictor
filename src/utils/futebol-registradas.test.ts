import { describe, expect, it } from 'vitest';
import { oportunidadesDoDia, oppFromAlerted, oppKey, type OppLike } from './futebol-registradas';
import { settleFutebol } from './futebol-settlement';
import type { FutebolAlertedPick, FutebolFixture } from '@/services/futebol-data.service';

function registrada(over: Partial<FutebolAlertedPick> = {}): FutebolAlertedPick {
  return {
    game_day: '2026-08-29',
    fixture_id: 1,
    market: 'match_winner',
    outcome: 'Home',
    line_value: null,
    bet_description: 'Coritiba vence',
    betting_market: 'Resultado',
    league: 'brasileirao-b',
    match_description: 'Coritiba × Palmeiras',
    odds: 2.1,
    janela_usada: 'manha',
    score: 62,
    faixa: 'alta',
    edge: 0.08,
    prob_justa_fechamento: 0.52,
    sent_at: '2026-08-29T11:00:00Z',
    ...over,
  };
}

function doBoard(over: Partial<OppLike> = {}): OppLike {
  return {
    fixture_id: 1,
    home_team_id: 10,
    away_team_id: 20,
    home_team_name: 'Coritiba',
    away_team_name: 'Palmeiras',
    competition: 'brasileirao-b',
    kickoff_utc: '2026-08-29T22:00:00Z',
    status_short: 'NS',
    market: 'match_winner',
    outcome: 'Home',
    line_value: null,
    best_odd: 2.1,
    best_book: 'bet365',
    avg_odd: 2.05,
    n_casas: 4,
    janela_usada: 'manha',
    pts_premissas: 30,
    penalidades: 0,
    evidencias: [],
    premissas_sem_dado: 0,
    score: 62,
    faixa: 'alta',
    edge: 0.08,
    prob_justa_fechamento: 0.52,
    ...over,
  };
}

const semFixtures = new Map<number, FutebolFixture>();

/**
 * Chama `oportunidadesDoDia` preenchendo o que o teste não disser.
 *
 * ⚠️ O padrão mora AQUI, e não na função. Lá os três são obrigatórios de
 * propósito: são dois donos da mesma lista, e parâmetro esquecível já fez as
 * duas telas divergirem dentro desta própria entrega.
 *
 * Num teste a preocupação é outra — cada caso diz só o que ele está afirmando,
 * e o resto some do texto. Quem quiser regra passa regra; quem não passa está
 * dizendo "sem regra configurada", que é uma resposta e não um esquecimento.
 */
function montarLista(
  args: Omit<Parameters<typeof oportunidadesDoDia>[0], 'vitrine' | 'limiares' | 'agoraMs'> &
    Partial<Pick<Parameters<typeof oportunidadesDoDia>[0], 'vitrine' | 'limiares' | 'agoraMs'>>,
): OppLike[] {
  return oportunidadesDoDia({
    vitrine: [],
    limiares: [],
    agoraMs: Date.parse('2026-08-30T12:00:00Z'),
    ...args,
  });
}

// ============================================================================
// ⚠️ A registrada passa pelas MESMAS regras que o resto da lista (#490)
// ============================================================================
// A lista do dia tem três fontes: o board, o histórico e o registro do que o
// daily enviou. As duas primeiras passam pela vitrine e pelo corte de valor. A
// terceira não passava por nada: ela entrava copiando os números do envio.
//
// Foi por essa porta que o Fiorentina × Napoli apareceu na tela de
// Oportunidades com odd 2.00 e vantagem −6,2%, enquanto o detalhe do jogo
// mostrava outra coisa. Os números do cartão eram os de um envio de 13/09 para
// um jogo de 20/09 — uma odd de sete dias antes, exibida como se fosse a atual.
//
// ⚠️ O EIXO AQUI É O ENVIO, e não o kickoff, por três motivos:
//
//   · é o que a #490 pede: "avaliados na data do envio e com a vantagem do
//     envio". A registrada não tem foto de nascimento; o que ela tem é a do
//     envio;
//   · `sent_at` e `edge` existem sempre na registrada. `kickoff_utc` vem NULO
//     quando a liga está fora da lista fixa do board, e filtrar por ele
//     derrubaria justamente essas linhas — que os testes de liga fora da lista,
//     mais abaixo, existem para proteger;
//   · e o passado não se reescreve: antes da vigência do limiar não havia corte
//     para esconder nada, então a linha fica.
//
// O board e o histórico continuam julgando pelo kickoff. Essa diferença de eixo
// é conhecida e tem ticket próprio; alinhá-la aqui seria mudar duas coisas ao
// mesmo tempo.
// ============================================================================

describe('a registrada passa pelo corte e pela vitrine', () => {
  const LIMIAR = [
    { market: 'asian_handicap', limiar: -0.02, vigenteDesde: '2026-08-20T00:00:00Z' },
  ];
  const dohandicap = (over: Partial<FutebolAlertedPick> = {}) =>
    registrada({ market: 'asian_handicap', outcome: 'Home', line_value: -0.5, ...over });

  it('⚠️ a registrada cortada pelo limiar na data do envio NÃO entra', () => {
    // O caso do Napoli: enviada com vantagem abaixo do limiar que já vigia.
    const cortada = dohandicap({ edge: -0.062, sent_at: '2026-08-29T11:00:00Z' });

    const lista = montarLista({
      doBoard: [],
      registradas: [cortada],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [],
      limiares: LIMIAR,
    });

    expect(lista).toEqual([]);
  });

  it('e a que passa no limiar continua entrando', () => {
    const passa = dohandicap({ edge: -0.01, sent_at: '2026-08-29T11:00:00Z' });

    const lista = montarLista({
      doBoard: [],
      registradas: [passa],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [],
      limiares: LIMIAR,
    });

    expect(lista).toHaveLength(1);
  });

  it('⚠️ a enviada ANTES da vigência fica, porque ali não havia corte', () => {
    // Não se reescreve o passado: o assinante viu e pode ter apostado.
    const antes = dohandicap({ edge: -0.062, sent_at: '2026-08-10T11:00:00Z' });

    const lista = montarLista({
      doBoard: [],
      registradas: [antes],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [],
      limiares: LIMIAR,
    });

    expect(lista).toHaveLength(1);
  });

  it('⚠️ a de mercado fora da vitrine na data do envio NÃO entra', () => {
    const escondido = dohandicap({ edge: 0.05, sent_at: '2026-08-29T11:00:00Z' });

    const lista = montarLista({
      doBoard: [],
      registradas: [escondido],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [{ market: 'asian_handicap', ocultoDesde: '2026-08-01T00:00:00Z', ocultoAte: null }],
      limiares: [],
    });

    expect(lista).toEqual([]);
  });

  it('e o mercado que já tinha voltado à vitrine entra', () => {
    const voltou = dohandicap({ edge: 0.05, sent_at: '2026-08-29T11:00:00Z' });

    const lista = montarLista({
      doBoard: [],
      registradas: [voltou],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [
        {
          market: 'asian_handicap',
          ocultoDesde: '2026-08-01T00:00:00Z',
          ocultoAte: '2026-08-20T00:00:00Z',
        },
      ],
      limiares: [],
    });

    expect(lista).toHaveLength(1);
  });

  it('⚠️ a cortada CONSOME a chave: um envio posterior não a ressuscita', () => {
    // O defeito que o code review achou: a regra rodava ANTES de marcar a
    // chave, então a registrada cortada não bloqueava as outras. Com dois
    // envios da mesma saída — o mais antigo cortado, o segundo passando —, a
    // linha voltava pela segunda porta, com os números do envio POSTERIOR.
    //
    // Isso contraria as duas decisões que já estavam escritas: "fica o MAIS
    // ANTIGO, que é a foto de nascimento", e "o pick que deixou de ser
    // oportunidade some do painel". Quem representa a oportunidade é o primeiro
    // envio; se ele foi cortado, a oportunidade foi cortada.
    const cortadaAntiga = dohandicap({ edge: -0.062, sent_at: '2026-08-29T09:00:00Z' });
    const boaDepois = dohandicap({ edge: -0.01, sent_at: '2026-08-29T15:00:00Z' });

    const lista = montarLista({
      doBoard: [],
      registradas: [cortadaAntiga, boaDepois],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [],
      limiares: LIMIAR,
      agoraMs: Date.parse('2026-08-30T12:00:00Z'),
    });

    expect(lista).toEqual([]);
  });

  it('a que passa entra com o Score, a faixa e a vantagem DO ENVIO', () => {
    // Quinto critério da #490, e o único que tinha ficado sem teste: os testes
    // anteriores só contavam linhas. Contar não prova que os números certos
    // atravessaram.
    const passa = dohandicap({
      edge: -0.01,
      score: 77,
      faixa: 'media',
      odds: 1.95,
      sent_at: '2026-08-29T11:00:00Z',
    });

    const [linha] = montarLista({
      doBoard: [],
      registradas: [passa],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [],
      limiares: LIMIAR,
      agoraMs: Date.parse('2026-08-30T12:00:00Z'),
    });

    expect(linha.score).toBe(77);
    expect(linha.faixa).toBe('media');
    expect(linha.edge).toBe(-0.01);
    expect(linha.best_odd).toBe(1.95);
  });

  it('⚠️ a registrada SEM mercado não entra: não dá para avaliá-la', () => {
    // A guarda era `a.market != null` em volta das duas regras, o que fazia a
    // linha sem mercado PULAR os dois filtros. O critério da #490 não abre
    // exceção — e uma linha que não dá para avaliar contra a vitrine nem contra
    // o limiar é uma linha sobre a qual não se pode afirmar que esteve na tela.
    const semMercado = registrada({ market: null, sent_at: '2026-08-29T11:00:00Z' });

    const lista = montarLista({
      doBoard: [],
      registradas: [semMercado],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [],
      limiares: LIMIAR,
      agoraMs: Date.parse('2026-08-30T12:00:00Z'),
    });

    expect(lista).toEqual([]);
  });

  it('sem vitrine e sem limiar, nada muda — a lista é a de antes', () => {
    // A regra só age quando há regra. Sem isso, esta entrega teria mudado o
    // comportamento de todo mundo que chama sem os dois novos argumentos.
    const qualquer = dohandicap({ edge: -0.5, sent_at: '2026-08-29T11:00:00Z' });

    const lista = montarLista({
      doBoard: [],
      registradas: [qualquer],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
      vitrine: [],
      limiares: [],
    });

    expect(lista).toHaveLength(1);
  });
});

describe('oportunidadesDoDia', () => {
  it('soma a registrada que o board não tem mais', () => {
    // O bug que originou este módulo: num sábado de seis oportunidades a home
    // mostrava três, porque só a outra tela somava as registradas.
    const lista = montarLista({
      doBoard: [doBoard()],
      registradas: [registrada({ fixture_id: 2, match_description: 'Sport × Goiás' })],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
    });

    expect(lista).toHaveLength(2);
    expect(lista[1].home_team_name).toBe('Sport');
  });

  it('não duplica a oportunidade que já está no board', () => {
    const lista = montarLista({
      doBoard: [doBoard()],
      registradas: [registrada()],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
    });

    expect(lista).toHaveLength(1);
  });

  it('a mesma partida com outra aposta entra como linha própria', () => {
    // A chave é jogo + mercado + saída + linha: dois palpites no mesmo jogo são
    // duas oportunidades, e colapsá-los esconderia uma.
    const lista = montarLista({
      doBoard: [doBoard()],
      registradas: [registrada({ market: 'over_under', outcome: 'Over', line_value: 2.5 })],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
    });

    expect(lista).toHaveLength(2);
  });

  it('registrada de outro dia fica de fora', () => {
    const lista = montarLista({
      doBoard: [],
      registradas: [registrada({ game_day: '2026-08-28' })],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
    });

    expect(lista).toHaveLength(0);
  });

  it('com o jogo casado, usa os nomes e o horário do fixture', () => {
    const fx = {
      fixture_id: 7,
      home_team_id: 33,
      away_team_id: 44,
      home_team_name: 'Athletico-PR',
      away_team_name: 'Vila Nova',
      kickoff_utc: '2026-08-29T19:30:00Z',
      status_short: 'FT',
    } as FutebolFixture;

    const linha = oppFromAlerted(registrada({ fixture_id: 7, match_description: 'CAP × VIL' }), fx);

    expect(linha.home_team_name).toBe('Athletico-PR');
    expect(linha.kickoff_utc).toBe('2026-08-29T19:30:00Z');
    expect(linha.status_short).toBe('FT');
  });

  it('sem jogo casado, mantém a oportunidade com os nomes do registro', () => {
    // Perder o escudo é aceitável; perder a oportunidade da lista não é.
    const linha = oppFromAlerted(registrada({ match_description: 'Ceará × Bahia' }));

    expect(linha.home_team_name).toBe('Ceará');
    expect(linha.away_team_name).toBe('Bahia');
    expect(linha.kickoff_utc).toBeNull();
  });

  it('a registrada não declara versão de escala', () => {
    // Carimbá-la de legacy faria a legenda achar que toda janela é mista.
    expect(oppFromAlerted(registrada()).score_versao).toBeUndefined();
  });

  it('a chave ignora campos que não identificam a aposta', () => {
    expect(oppKey(1, 'over_under', 'Over', 2.5)).toBe(oppKey(1, 'over_under', 'Over', 2.5));
    expect(oppKey(1, 'over_under', 'Over', 2.5)).not.toBe(oppKey(1, 'over_under', 'Over', 3.5));
  });
});

// ============================================================================
// Pick em liga fora da antiga lista fixa (issue #323)
// ============================================================================
// O caso relatado: 29/08/2026, seis oportunidades na tela e três sem horário,
// sem placar e sem resultado — Strasbourg × Lens e Arouca × Marítimo, de Ligue 1
// e Primeira Liga. Os fixtures existiam no banco; o que faltava era a tela
// PEDIR o calendário dessas ligas, porque o escopo vinha de uma lista fixa de
// oito slugs.
//
// Este teste fixa o efeito: com o fixture no mapa, a linha registrada nasce
// liquidável; sem ele, nasce cega. É o que separa "2 de 3 deram green" de
// "2 de 6", e por isso o escopo tem de vir do catálogo do mart.
// ============================================================================

describe('oportunidade registrada em liga fora da lista fixa', () => {
  const strasbourg = registrada({
    fixture_id: 1552745,
    league: 'ligue_1',
    match_description: 'Strasbourg × Lens',
    outcome: 'Home',
  });

  const fixtureDoStrasbourg: FutebolFixture = {
    fixture_id: 1552745,
    home_team_id: 95,
    away_team_id: 116,
    home_team_name: 'Strasbourg',
    away_team_name: 'Lens',
    kickoff_utc: '2026-08-29T15:15:00Z',
    status_short: 'FT',
    goals_home: 2,
    goals_away: 1,
  } as FutebolFixture;

  it('com o calendário da liga carregado, a linha tem horário e placar', () => {
    const linha = oppFromAlerted(strasbourg, fixtureDoStrasbourg);

    expect(linha.kickoff_utc).toBe('2026-08-29T15:15:00Z');
    expect(linha.status_short).toBe('FT');
    expect(linha.home_team_name).toBe('Strasbourg');
    expect(linha.away_team_name).toBe('Lens');
    expect(linha.home_team_id).toBe(95);
  });

  it('sem o calendário da liga, a linha aparece mas é incapaz de liquidar', () => {
    // O defeito, fixado: ela NÃO some da lista — some do resultado. Sem
    // `status_short` finalizado e sem placar, nada a liquida, e o resumo do dia
    // encolhia o denominador em silêncio. Ver `resumoDoDia`.
    const linha = oppFromAlerted(strasbourg, undefined);

    expect(linha.kickoff_utc).toBeNull();
    expect(linha.status_short).toBeNull();
    // O nome sai da descrição do pick, então a linha ainda se identifica —
    // é por isso que ela aparece na tela em vez de sumir.
    expect(linha.home_team_name).toBe('Strasbourg');
    expect(linha.home_team_id).toBe(0);
  });

  it('a linha registrada entra no dia mesmo em liga que o board não trouxe', () => {
    const doDia = montarLista({
      doBoard: [],
      registradas: [strasbourg],
      dia: '2026-08-29',
      fixturePorId: new Map([[1552745, fixtureDoStrasbourg]]),
    });

    expect(doDia).toHaveLength(1);
    expect(doDia[0].competition).toBe('ligue_1');
    expect(doDia[0].status_short).toBe('FT');
  });

  it('com o calendário carregado, a linha LIQUIDA de verdade', () => {
    // O aceite da issue pede horário, placar E liquidação. As asserções acima
    // param no horário; esta fecha o ciclo, porque é a liquidação que o
    // histórico de 29/08 não conseguiu fazer nas três linhas órfãs.
    const linha = oppFromAlerted(strasbourg, fixtureDoStrasbourg);
    const resultado = settleFutebol(
      linha,
      fixtureDoStrasbourg.goals_home!,
      fixtureDoStrasbourg.goals_away!,
    );

    // Strasbourg 2 × 1 Lens, pick no mandante: green.
    expect(resultado).toBe('won');
  });

  it('sem o calendário, não há placar para liquidar', () => {
    const linha = oppFromAlerted(strasbourg, undefined);

    // Este é o defeito inteiro em uma linha: o placar vem do fixture, e sem
    // fixture não existe par de gols para passar ao liquidador. A linha fica
    // na tela sem nunca fechar, e o resumo do dia a omitia da conta.
    expect(linha.status_short).toBeNull();
    expect(fixtureDoStrasbourg.goals_home).toBe(2); // o placar EXISTIA no banco
  });
});

// ============================================================================
// A lista do dia só tem linhas DAQUELE dia
// ============================================================================
// Em 17/09/2026 o painel mostrava "Menos de 3,5 gols · Atletico Torque ×
// Cienciano" — jogo das 21:30 daquela noite — na lista de 12, 13, 14, 15 e 16
// de setembro. Duas cópias, sempre no topo, porque o Score era 100.
//
// A investigação levou uma hora e queimou quatro hipóteses porque NINGUÉM era
// dono desta regra: o recorte por dia estava repartido entre o filtro do board
// na página, o filtro das registradas aqui, e a fusão com o histórico em outro
// arquivo. Três lugares, nenhum teste, e cada suspeita exigia ler um trecho
// diferente para ser descartada.
//
// Agora o dia é decidido AQUI, num lugar só, e estes testes são a guarda.
// ============================================================================

describe('a lista do dia', () => {
  const HOJE = '2026-09-17';

  /** O jogo das 21:30 de 17/09: kickoff em UTC cai no dia seguinte. */
  const jogoDaNoite = (over: Partial<OppLike> = {}): OppLike =>
    doBoard({
      fixture_id: 1631512,
      home_team_name: 'Atletico Torque',
      away_team_name: 'Cienciano',
      kickoff_utc: '2026-09-18T00:30:00',
      status_short: '2H',
      market: 'goals_over_under',
      outcome: 'Under',
      line_value: 3.5,
      ...over,
    });

  it('não deixa entrar linha de outro dia, mesmo com o kickoff virando em UTC', () => {
    // O caso real: quem olha 12/09 recebe a lista inteira do board, e a partida
    // das 21:30 de hoje não pode aparecer ali.
    //
    // ⚠️ O que este teste prova é o RECORTE POR DIA, e a armadilha do fuso: o
    // kickoff em UTC cai em 18/09 e o jogo é da noite de 17 em Brasília. Ele NÃO
    // prova nada sobre jogo ao vivo — a função não lê status, e o `2H` abaixo é
    // só contexto do caso real.
    const lista = montarLista({
      doBoard: [jogoDaNoite(), doBoard({ fixture_id: 99, kickoff_utc: '2026-09-12T22:00:00Z' })],
      registradas: [],
      dia: '2026-09-12',
      fixturePorId: new Map(),
    });

    expect(lista).toHaveLength(1);
    expect(lista[0].fixture_id).toBe(99);
  });

  it('e no dia do jogo ela entra', () => {
    // A contraprova: sem ela, o teste acima passaria com uma lista sempre vazia.
    const lista = montarLista({
      doBoard: [jogoDaNoite()],
      registradas: [],
      dia: HOJE,
      fixturePorId: new Map(),
    });

    expect(lista).toHaveLength(1);
    expect(lista[0].fixture_id).toBe(1631512);
  });

  const envio = (sent: string, odds: number, over: Partial<FutebolAlertedPick> = {}) =>
    registrada({
      game_day: HOJE,
      fixture_id: 1631512,
      market: 'goals_over_under',
      outcome: 'Under',
      line_value: 3.5,
      sent_at: sent,
      odds,
      ...over,
    });

  it('a mesma oportunidade registrada três vezes vira UMA linha, a do primeiro envio', () => {
    // O pick do Torque foi enviado no Telegram em 12, 15 e 17 de setembro, para
    // o mesmo jogo. Cada envio é uma linha na origem, e a lista deduplicava
    // contra o board mas não contra si mesma: a oportunidade aparecia repetida,
    // uma vez por envio, sempre no topo por causa do Score.
    //
    // Cada envio tem odd própria, e é por isso que o teste afirma QUAL sobrevive
    // em vez de só contar: a primeira versão deste caso usava três envios
    // idênticos e passaria com qualquer sobrevivente. A escolha é a foto de
    // nascimento — o anúncio mais antigo —, e a lista chega fora de ordem de
    // propósito, senão o teste passaria mesmo sem a ordenação.
    const lista = montarLista({
      doBoard: [],
      registradas: [
        envio('2026-09-17T13:00:00Z', 1.7),
        envio('2026-09-12T13:00:00Z', 1.5),
        envio('2026-09-15T13:00:00Z', 1.6),
      ],
      dia: HOJE,
      fixturePorId: new Map(),
    });

    expect(lista).toHaveLength(1);
    expect(lista[0].best_odd).toBe(1.5);
  });

  it('mas duas linhas DIFERENTES do mesmo jogo continuam sendo duas', () => {
    // A contraprova da dedup: a chave inclui mercado, saída e linha. Menos de
    // 3,5 e menos de 2,5 são apostas distintas, e colapsá-las seria esconder uma
    // oportunidade — defeito pior do que o que este PR conserta.
    const lista = montarLista({
      doBoard: [],
      registradas: [
        envio('2026-09-17T13:00:00Z', 1.5),
        envio('2026-09-17T13:00:00Z', 2.2, { line_value: 2.5 }),
      ],
      dia: HOJE,
      fixturePorId: new Map(),
    });

    expect(lista).toHaveLength(2);
  });

  it('e o board continua ganhando da registrada, quando são a mesma', () => {
    // Regra que já existia e não pode se perder no conserto: a linha do board
    // tem número vivo; a registrada é o retrato do envio.
    const lista = montarLista({
      doBoard: [jogoDaNoite()],
      registradas: [
        registrada({
          game_day: HOJE,
          fixture_id: 1631512,
          market: 'goals_over_under',
          outcome: 'Under',
          line_value: 3.5,
        }),
      ],
      dia: HOJE,
      fixturePorId: new Map(),
    });

    expect(lista).toHaveLength(1);
    expect(lista[0].n_casas).toBe(jogoDaNoite().n_casas);
  });

  it('o board repetido também vira uma linha só', () => {
    // A dedup das registradas não bastava: o board e o histórico entram na mesma
    // lista, e a fusão pode trazer a mesma chave duas vezes. Uma chave repetida
    // aqui é uma `key` repetida no React — ver o teste abaixo.
    const lista = montarLista({
      doBoard: [jogoDaNoite(), jogoDaNoite({ best_odd: 1.6 })],
      registradas: [],
      dia: HOJE,
      fixturePorId: new Map(),
    });

    expect(lista).toHaveLength(1);
    // Fica a primeira: quem chama já ordenou, e trocar a sobrevivente por acaso
    // faria a odd da linha mudar sem que nada no dado tivesse mudado.
    expect(lista[0].best_odd).toBe(jogoDaNoite().best_odd);
  });

  it('a lista NUNCA tem duas linhas com a mesma chave', () => {
    // A invariante que o defeito de 18/09 quebrou, e por que ela importa:
    //
    // As telas usam `fixture-mercado-saída-linha` como `key` do React. Com a
    // chave repetida, trocar de dia deixava uma linha do dia anterior PRESA no
    // DOM — o "Menos de 3,5" do Torque aparecendo no dia 16, e mais uma cópia a
    // cada ida e volta. O estado do React estava certo o tempo todo; quem
    // mentia era a tela, e por isso procurar no dado não achava nada.
    const lista = montarLista({
      doBoard: [jogoDaNoite(), jogoDaNoite({ best_odd: 1.6 })],
      registradas: [
        envio('2026-09-12T07:40:00Z', 1.5),
        envio('2026-09-17T13:00:00Z', 1.5),
        envio('2026-09-17T13:00:00Z', 2.2, { line_value: 2.5 }),
      ],
      dia: HOJE,
      fixturePorId: new Map(),
    });

    const chaves = lista.map((o) => oppKey(o.fixture_id, o.market, o.outcome, o.line_value));
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});
