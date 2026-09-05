import { describe, expect, it } from 'vitest';
import { JOGOS_NA_GRADE, selecionarJogosDaGrade } from './futebol-grade-de-jogos';

// ============================================================================
// A coluna de jogos da home
// ============================================================================
// Duas coisas se sustentam ou caem juntas: o número fixo de linhas e a troca do
// jogo que apitou por um que ainda vem. Um sem o outro deixa a coluna presa nas
// partidas da manhã pelo resto do dia.
// ============================================================================

const jogo = (hora: string, id = Number(hora.slice(0, 2))) => ({
  fixture_id: id,
  kickoff_utc: `2026-09-05T${hora}:00`,
  date_utc: null,
});

// Doze jogos, de 3 em 3 horas a partir das 08:00 UTC não daria doze no mesmo
// dia — então de hora em hora, das 08:00 às 19:00.
const DIA = Array.from({ length: 12 }, (_, i) => jogo(String(8 + i).padStart(2, '0')));
const as = (hora: string) => Date.parse(`2026-09-05T${hora}:00Z`);

describe('selecionarJogosDaGrade', () => {
  it('corta no limite', () => {
    expect(selecionarJogosDaGrade(DIA, as('07:00'))).toHaveLength(JOGOS_NA_GRADE);
  });

  it('antes do primeiro apito, mostra os primeiros do dia', () => {
    const saida = selecionarJogosDaGrade(DIA, as('07:00'));
    expect(saida.map((j) => j.fixture_id)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  // ── O comportamento que o limite sozinho não dá ───────────────────────────
  it('o jogo que apitou sai e outro entra no lugar', () => {
    const antes = selecionarJogosDaGrade(DIA, as('07:00'));
    const depois = selecionarJogosDaGrade(DIA, as('08:30'));

    expect(antes.map((j) => j.fixture_id)).toContain(8);
    expect(depois.map((j) => j.fixture_id)).not.toContain(8);
    // Entrou um do fim da fila, e a coluna não encolheu.
    expect(depois.map((j) => j.fixture_id)).toContain(17);
    expect(depois).toHaveLength(JOGOS_NA_GRADE);
  });

  it('sempre em ordem de horário', () => {
    const saida = selecionarJogosDaGrade(DIA, as('12:30'));
    const horas = saida.map((j) => j.kickoff_utc);
    expect([...horas].sort()).toEqual(horas);
  });

  // ── O fim do dia, que é o caso que decide o desenho ───────────────────────
  it('depois do último apito completa com os mais recentes, e não esvazia', () => {
    const saida = selecionarJogosDaGrade(DIA, as('23:00'));
    expect(saida).toHaveLength(JOGOS_NA_GRADE);
    // Os nove últimos do dia, não os nove primeiros.
    expect(saida.map((j) => j.fixture_id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('com poucos por vir, mistura os recém-apitados com os que faltam', () => {
    // Às 16:30 restam três por vir (17, 18 e 19); os outros seis vêm dos
    // recém-apitados, de trás para frente.
    const saida = selecionarJogosDaGrade(DIA, as('16:30'));
    expect(saida).toHaveLength(JOGOS_NA_GRADE);
    expect(saida.map((j) => j.fixture_id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  // ── Bordas ────────────────────────────────────────────────────────────────
  it('dia com menos jogos que o limite devolve todos', () => {
    const curto = [jogo('08'), jogo('09')];
    expect(selecionarJogosDaGrade(curto, as('07:00'))).toHaveLength(2);
  });

  it('dia sem jogos devolve vazio', () => {
    expect(selecionarJogosDaGrade([], as('07:00'))).toEqual([]);
  });

  it('jogo sem horário legível fica fora', () => {
    const comLixo = [{ kickoff_utc: 'nao é data', date_utc: null }, jogo('08')];
    const saida = selecionarJogosDaGrade(comLixo, as('07:00'));
    expect(saida).toHaveLength(1);
    expect(saida[0].kickoff_utc).toBe('2026-09-05T08:00');
  });

  it('cai no date_utc quando não há kickoff_utc', () => {
    const so = [{ kickoff_utc: null, date_utc: '2026-09-05T08:00' }];
    expect(selecionarJogosDaGrade(so, as('07:00'))).toHaveLength(1);
  });

  // A armadilha que quase passou: `slice(-0)` devolve o array inteiro, então um
  // dia inteiro por vir traria junto todos os já encerrados.
  it('com a coluna cheia de jogos por vir, nenhum encerrado entra de carona', () => {
    const saida = selecionarJogosDaGrade(DIA, as('10:30'));
    expect(saida).toHaveLength(JOGOS_NA_GRADE);
    expect(saida.map((j) => j.fixture_id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });
});
