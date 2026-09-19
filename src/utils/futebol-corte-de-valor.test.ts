import { describe, expect, it } from 'vitest';
import {
  cortadaNaData,
  filtrarCorteDeValor,
  passaNoCorteDeValor,
  separaNoCorteDeValor,
  type LimiarDeValor,
} from './futebol-corte-de-valor';
import { mergeBoardAndHistory } from './futebol-history';
import { esteveNaVitrine, soAVitrine } from '@/components/placar/placar-vitrine';

const CORTE = [{ market: 'asian_handicap', limiar: -0.02 }];

const linha = (market: string, edge: number | null, id: number) => ({ market, edge, fixture_id: id });

describe('passaNoCorteDeValor', () => {
  it('mercado sem limiar sempre passa, qualquer que seja o preço', () => {
    expect(passaNoCorteDeValor('goals_over_under', -0.3, CORTE)).toBe(true);
  });

  it('acima do limiar passa', () => {
    expect(passaNoCorteDeValor('asian_handicap', -0.019, CORTE)).toBe(true);
    expect(passaNoCorteDeValor('asian_handicap', 0.04, CORTE)).toBe(true);
  });

  it('o limiar em si já corta', () => {
    // A remedição separou `edge > −2%` de `edge <= −2%`. A fronteira fica do lado
    // que corta, e é o caso que ninguém testa.
    expect(passaNoCorteDeValor('asian_handicap', -0.02, CORTE)).toBe(false);
  });

  it('abaixo do limiar corta', () => {
    expect(passaNoCorteDeValor('asian_handicap', -0.074, CORTE)).toBe(false);
  });

  it('sem vantagem gravada corta — é porta de publicação, não filtro de conveniência', () => {
    expect(passaNoCorteDeValor('asian_handicap', null, CORTE)).toBe(false);
    expect(passaNoCorteDeValor('asian_handicap', undefined, CORTE)).toBe(false);
    expect(passaNoCorteDeValor('asian_handicap', Number.NaN, CORTE)).toBe(false);
  });

  it('sem nenhum limiar configurado nada corta', () => {
    expect(passaNoCorteDeValor('asian_handicap', -0.5, [])).toBe(true);
  });
});

// O detalhe do jogo precisa saber que a linha EXISTIU e foi cortada (#432): sem
// isso a tela lê a ausência como "não houve preço coletado" e repõe a contagem
// de premissas no lugar do Score que o corte tirou.
describe('separaNoCorteDeValor', () => {
  it('devolve os dois lados, sem perder nem duplicar linha', () => {
    const linhas = [
      linha('asian_handicap', 0.01, 1),
      linha('asian_handicap', -0.05, 2),
      linha('goals_over_under', -0.05, 3),
      linha('asian_handicap', null, 4),
    ];

    const { passam, cortadas } = separaNoCorteDeValor(linhas, CORTE);

    expect(passam.map((l) => l.fixture_id)).toEqual([1, 3]);
    expect(cortadas.map((l) => l.fixture_id)).toEqual([2, 4]);
  });

  it('o que passa é exatamente o que filtrarCorteDeValor devolve', () => {
    // As duas saem da MESMA conta de propósito. No dia em que divergirem, a tela
    // esconde uma linha e a lista de cortadas fala de outra — e o detalhe do jogo
    // volta a tratar como "sem preço" a linha que o corte removeu.
    const linhas = [linha('asian_handicap', -0.05, 1), linha('asian_handicap', 0.2, 2)];

    expect(separaNoCorteDeValor(linhas, CORTE).passam).toEqual(filtrarCorteDeValor(linhas, CORTE));
  });

  it('sem limiar configurado nada é cortado', () => {
    const linhas = [linha('asian_handicap', -0.5, 1)];

    const { passam, cortadas } = separaNoCorteDeValor(linhas, []);

    expect(passam).toEqual(linhas);
    expect(cortadas).toEqual([]);
  });

  it('julga pela vantagem de PUBLICAÇÃO quando ela vem', () => {
    // Mesma regra do filtro: depois do apito o detalhe devolve a foto do apito, e
    // cortar por ela esconderia linha que apareceu na tela.
    const publicada = { market: 'asian_handicap', edge: -0.05, edge_publicacao: -0.01 };

    expect(separaNoCorteDeValor([publicada], CORTE).cortadas).toEqual([]);
  });
});

describe('filtrarCorteDeValor', () => {
  it('tira só as linhas cortadas, na ordem', () => {
    const linhas = [
      linha('asian_handicap', 0.01, 1),
      linha('asian_handicap', -0.05, 2),
      linha('goals_over_under', -0.05, 3),
      linha('asian_handicap', null, 4),
    ];
    expect(filtrarCorteDeValor(linhas, CORTE).map((l) => l.fixture_id)).toEqual([1, 3]);
  });

  it('sem limiar devolve tudo', () => {
    const linhas = [linha('asian_handicap', -0.5, 1)];
    expect(filtrarCorteDeValor(linhas, [])).toEqual(linhas);
  });

  it('não muda o array recebido', () => {
    const linhas = [linha('asian_handicap', -0.05, 1), linha('asian_handicap', 0.01, 2)];
    filtrarCorteDeValor(linhas, CORTE);
    expect(linhas).toHaveLength(2);
  });

  // A regra julga pela vantagem de PUBLICAÇÃO quando ela vem (migration 146).
  // Board e detalhe do jogo devolvem a foto do apito depois que o jogo acaba, e
  // cortar por ela esconderia linha que apareceu na tela.
  it('prefere a vantagem de publicação à do apito', () => {
    const publicada = { market: 'asian_handicap', edge: -0.025, edge_publicacao: -0.01 };
    expect(filtrarCorteDeValor([publicada], CORTE)).toEqual([publicada]);
  });

  it('e corta quando foi a publicação que não passou, mesmo o apito tendo melhorado', () => {
    const cortada = { market: 'asian_handicap', edge: -0.01, edge_publicacao: -0.025 };
    expect(filtrarCorteDeValor([cortada], CORTE)).toEqual([]);
  });

  it('sem a de publicação, vale a que existe', () => {
    const semPublicacao = { market: 'asian_handicap', edge: -0.05 };
    expect(filtrarCorteDeValor([semPublicacao], CORTE)).toEqual([]);
  });
});

// ============================================================================
// A data de vigência
// ============================================================================
// Sem ela, a linha cortada no board de hoje volta amanhã pelo histórico. É o
// defeito da migration 119, e o corte herdaria se não tratasse a data.
// ============================================================================

describe('cortadaNaData', () => {
  const VIGENTE: LimiarDeValor[] = [
    { market: 'asian_handicap', limiar: -0.02, vigenteDesde: '2026-09-15T00:00:00Z' },
  ];
  const AGORA = Date.parse('2026-09-20T15:00:00Z');

  it('corta a linha ruim a partir da vigência', () => {
    expect(cortadaNaData('asian_handicap', -0.05, '2026-09-17T18:00:00', VIGENTE, AGORA)).toBe(true);
  });

  it('mantém a linha ruim anterior à vigência — ela esteve na tela', () => {
    expect(cortadaNaData('asian_handicap', -0.05, '2026-09-10T18:00:00', VIGENTE, AGORA)).toBe(false);
  });

  it('o instante exato da vigência já corta', () => {
    expect(cortadaNaData('asian_handicap', -0.05, '2026-09-15T00:00:00', VIGENTE, AGORA)).toBe(true);
  });

  it('linha que passa no corte nunca é cortada, em data nenhuma', () => {
    expect(cortadaNaData('asian_handicap', 0.01, '2026-09-17T18:00:00', VIGENTE, AGORA)).toBe(false);
  });

  it('mercado sem limiar nunca é cortado', () => {
    expect(cortadaNaData('goals_over_under', -0.3, '2026-09-17T18:00:00', VIGENTE, AGORA)).toBe(false);
  });

  it('data ilegível corta, porque não dá para situá-la', () => {
    expect(cortadaNaData('asian_handicap', -0.05, 'nao é data', VIGENTE, AGORA)).toBe(true);
    expect(cortadaNaData('asian_handicap', -0.05, null, VIGENTE, AGORA)).toBe(true);
  });

  describe('sem data de vigência (o escuro)', () => {
    const SEM_DATA: LimiarDeValor[] = [{ market: 'asian_handicap', limiar: -0.02, vigenteDesde: null }];

    it('corta de hoje em diante', () => {
      expect(cortadaNaData('asian_handicap', -0.05, '2026-09-20T22:00:00', SEM_DATA, AGORA)).toBe(true);
    });

    it('não toca no passado', () => {
      expect(cortadaNaData('asian_handicap', -0.05, '2026-09-19T13:00:00', SEM_DATA, AGORA)).toBe(false);
    });
  });
});

// ============================================================================
// O aceite, no nível do comportamento
// ============================================================================
// O predicado puro não basta, e a #324 mostrou por quê: a lista do dia vem do
// HISTÓRICO para jogo que já apitou, e o placar recorta pela detecção. Estes
// casos travam os dois caminhos por onde a linha cortada voltaria.
// ============================================================================

const linhaDoBoard = (market: string, kickoff: string, edge: number | null, fixture: number) =>
  ({
    fixture_id: fixture,
    home_team_id: 1,
    away_team_id: 2,
    home_team_name: 'Casa',
    away_team_name: 'Fora',
    competition: 'brasileirao',
    kickoff_utc: kickoff,
    status_short: 'FT',
    market,
    outcome: 'Home',
    line_value: -0.5,
    edge,
    best_odd: 1.9,
    best_book: 'X',
    avg_odd: 1.85,
    n_casas: 8,
    janela_usada: 't1h',
    prob_justa_fechamento: 0.55,
    pts_premissas: 30,
    penalidades: 0,
    score: 50,
    faixa: 'Média',
    evidencias: [],
    premissas_sem_dado: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('o histórico respeita o corte de valor', () => {
  const VIGENTE: LimiarDeValor[] = [
    { market: 'asian_handicap', limiar: -0.02, vigenteDesde: '2026-09-15T00:00:00Z' },
  ];
  const AGORA = Date.parse('2026-09-20T15:00:00Z');

  it('a linha cortada não volta pela foto do apito, e o resto fica', () => {
    const historico = [
      linhaDoBoard('asian_handicap', '2026-09-10T18:00:00', -0.05, 1), // antes da vigência: fica
      linhaDoBoard('asian_handicap', '2026-09-17T18:00:00', -0.05, 2), // depois, ruim: some
      linhaDoBoard('asian_handicap', '2026-09-17T18:00:00', 0.01, 3), // depois, boa: fica
      linhaDoBoard('goals_over_under', '2026-09-17T18:00:00', -0.05, 4), // sem limiar: fica
    ];
    const fundido = mergeBoardAndHistory([], historico, AGORA, [], VIGENTE);
    expect(fundido.map((r) => r.fixture_id).sort()).toEqual([1, 3, 4]);
  });

  it('sem limiar a fusão é a de antes', () => {
    const historico = [linhaDoBoard('asian_handicap', '2026-09-17T18:00:00', -0.05, 2)];
    expect(mergeBoardAndHistory([], historico, AGORA, [])).toHaveLength(1);
  });
});

describe('o placar da vitrine respeita o corte de valor', () => {
  const VIGENTE: LimiarDeValor[] = [
    { market: 'asian_handicap', limiar: -0.02, vigenteDesde: '2026-09-15T00:00:00Z' },
  ];
  const AGORA = Date.parse('2026-09-20T15:00:00Z');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publicada = (edge: number | null, detectada: string) => ({ market: 'asian_handicap', edge, detectada_em: detectada }) as any;

  it('a linha cortada depois da vigência não esteve na vitrine', () => {
    expect(esteveNaVitrine(publicada(-0.05, '2026-09-16T10:00:00'), [], AGORA, VIGENTE)).toBe(false);
  });

  it('a linha ruim detectada antes da vigência esteve', () => {
    expect(esteveNaVitrine(publicada(-0.05, '2026-09-14T10:00:00'), [], AGORA, VIGENTE)).toBe(true);
  });

  it('soAVitrine tira a cortada e deixa a boa', () => {
    const linhas = [publicada(-0.05, '2026-09-16T10:00:00'), publicada(0.03, '2026-09-16T10:00:00')];
    expect(soAVitrine(linhas, [], AGORA, VIGENTE).map((l) => l.edge)).toEqual([0.03]);
  });
});

// ============================================================================
// Nulo explícito é resposta: "esta linha nunca esteve na tela"
// ============================================================================
// A migration 161 fez `edge_publicacao` ser a vantagem da primeira versão
// VISÍVEL, e devolver NULO quando nunca houve nenhuma. Nulo ali não é campo em
// branco: é o banco dizendo que a linha não chegou a aparecer para ninguém.
//
// O `?? edge` de antes lia esse nulo como ausência e caía na vantagem do APITO —
// que pode ser ótima. O efeito era mostrar como oportunidade justamente a linha
// que nunca esteve na vitrine, que é o defeito que a 119 e a 145 fecharam no
// grão do mercado e este fecha no grão da linha.
//
// A distinção é entre campo AUSENTE e campo NULO, e as duas coisas existem de
// verdade: ausente é front novo contra banco anterior à 146, e ali a queda para
// `edge` continua certa.
// ============================================================================

describe('vantagem de publicação nula é diferente de ausente', () => {
  const VIGENTE: LimiarDeValor[] = [
    { market: 'asian_handicap', limiar: -0.02, vigenteDesde: '2026-09-15T00:00:00Z' },
  ];
  const AGORA = Date.parse('2026-09-20T15:00:00Z');

  it('separaNoCorteDeValor corta o nulo explícito, mesmo com o apito bom', () => {
    const nuncaApareceu = { market: 'asian_handicap', edge: 0.05, edge_publicacao: null };
    expect(separaNoCorteDeValor([nuncaApareceu], CORTE).cortadas).toEqual([nuncaApareceu]);
    expect(separaNoCorteDeValor([nuncaApareceu], CORTE).passam).toEqual([]);
  });

  it('filtrarCorteDeValor idem, porque os dois saem da mesma conta', () => {
    const nuncaApareceu = { market: 'asian_handicap', edge: 0.05, edge_publicacao: null };
    expect(filtrarCorteDeValor([nuncaApareceu], CORTE)).toEqual([]);
  });

  it('⚠️ e o campo AUSENTE continua caindo no apito', () => {
    // Banco anterior à 146 não tem a coluna. Tratar ausência como nulo aqui
    // esvaziaria a tela inteira contra um banco velho, que é regressão e não
    // correção.
    const semColuna = { market: 'asian_handicap', edge: 0.05 };
    expect(filtrarCorteDeValor([semColuna], CORTE)).toEqual([semColuna]);
  });

  it('o histórico derruba a linha que nunca apareceu, a partir da vigência', () => {
    const nuncaApareceu = {
      ...linhaDoBoard('asian_handicap', '2026-09-17T18:00:00', 0.05, 5),
      edge_publicacao: null,
    };
    expect(mergeBoardAndHistory([], [nuncaApareceu], AGORA, [], VIGENTE)).toEqual([]);
  });

  it('e a mantém antes da vigência, porque ali não havia limiar para escondê-la', () => {
    // A data continua mandando: antes da vigência o limiar não existia, então
    // nada foi escondido por ele, e apagar a linha reescreveria o passado.
    const antes = {
      ...linhaDoBoard('asian_handicap', '2026-09-10T18:00:00', 0.05, 6),
      edge_publicacao: null,
    };
    expect(mergeBoardAndHistory([], [antes], AGORA, [], VIGENTE)).toHaveLength(1);
  });
});
