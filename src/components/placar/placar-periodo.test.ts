import { describe, expect, it } from 'vitest';
import type { LinhaPublicada } from './placar-agregacao';
import {
  ATALHOS,
  avisosDoPeriodo,
  diaDaLinha,
  filtrarPeloEixo,
  periodoAnterior,
  recorteDaSerieComparavel,
  rotuloDoPeriodo,
} from './placar-periodo';

const linha = (p: Partial<LinhaPublicada> = {}): LinhaPublicada =>
  ({
    opportunity_key: 'k',
    fixture_id: 1,
    competition: 'Brasileirão',
    home_team_name: 'Casa',
    away_team_name: 'Fora',
    kickoff_utc: '2026-09-10T23:00:00',
    status_short: 'FT',
    goals_home: 2,
    goals_away: 0,
    detectada_em: '2026-09-09T03:00:00',
    market: 'match_winner',
    outcome: 'Home',
    line_value: null,
    best_odd: 2,
    edge: 1,
    score: 65,
    faixa: 'Alta',
    score_versao: 'contexto_v1',
    pts_premissas: 20,
    penalidades: 0,
    premissas_sem_dado: 0,
    modelo_api_concorda: true,
    linha_sharp_confirma: false,
    pen_odd_outlier: false,
    pen_poucas_casas: false,
    pen_odd_longshot: false,
    pen_odd_juice: false,
    ...p,
  }) satisfies LinhaPublicada;

describe('o dia da linha', () => {
  it('é o dia de Brasília, e não o de UTC', () => {
    // Jogo às 23h UTC de dia 10 é 20h de Brasília do MESMO dia; jogo às 00h30
    // UTC do dia 11 é 21h30 do dia 10. Agrupar por UTC joga o jogo noturno para
    // o dia seguinte, e são justamente os noturnos que enchem a rodada.
    expect(diaDaLinha(linha({ kickoff_utc: '2026-09-10T23:00:00' }), 'jogo')).toBe('2026-09-10');
    expect(diaDaLinha(linha({ kickoff_utc: '2026-09-11T00:30:00' }), 'jogo')).toBe('2026-09-10');
  });

  it('pelo eixo da detecção, é o dia em que a oportunidade nasceu', () => {
    expect(
      diaDaLinha(linha({ detectada_em: '2026-09-09T03:00:00' }), 'deteccao'),
    ).toBe('2026-09-09');
  });
});

describe('filtrar pelo eixo', () => {
  const dentroDosDois = linha({
    kickoff_utc: '2026-09-10T23:00:00',
    detectada_em: '2026-09-09T03:00:00',
  });
  // Detectada na janela, jogo depois dela: é a linha que a RPC traz de brinde,
  // porque ela devolve o que toca o período por QUALQUER um dos eixos.
  const soPelaDeteccao = linha({
    kickoff_utc: '2026-09-20T23:00:00',
    detectada_em: '2026-09-09T03:00:00',
  });

  const janela = { de: '2026-09-08', ate: '2026-09-11' };

  it('por apito, deixa fora a linha cujo jogo caiu fora da janela', () => {
    const dentro = filtrarPeloEixo([dentroDosDois, soPelaDeteccao], 'jogo', janela);
    expect(dentro).toEqual([dentroDosDois]);
  });

  it('por detecção, ela entra', () => {
    const dentro = filtrarPeloEixo([dentroDosDois, soPelaDeteccao], 'deteccao', janela);
    expect(dentro).toHaveLength(2);
  });

  it('a janela inclui os dois extremos', () => {
    const noPrimeiro = linha({ kickoff_utc: '2026-09-08T14:00:00' });
    const noUltimo = linha({ kickoff_utc: '2026-09-11T14:00:00' });
    expect(filtrarPeloEixo([noPrimeiro, noUltimo], 'jogo', janela)).toHaveLength(2);
  });
});

describe('os avisos do período', () => {
  it('avisa quando o período atravessa a virada do denominador', () => {
    const avisos = avisosDoPeriodo({ de: '2026-08-20', ate: '2026-09-12' }, 'jogo');
    expect(avisos.join(' ')).toMatch(/04\/09\/2026/);
    expect(avisos.join(' ')).toMatch(/outra escala/i);
  });

  it('não avisa quando o período começa na série comparável', () => {
    expect(avisosDoPeriodo({ de: '2026-09-04', ate: '2026-09-12' }, 'jogo')).toEqual([]);
  });

  it('por detecção, avisa do dia em que o board entrou de uma vez', () => {
    const avisos = avisosDoPeriodo({ de: '2026-09-01', ate: '2026-09-12' }, 'deteccao');
    expect(avisos.join(' ')).toMatch(/03\/09\/2026/);
    expect(avisos.join(' ')).toMatch(/entrou de uma vez/i);
  });

  it('por apito, o dia do snapshot não incomoda', () => {
    // Os jogos continuam espalhados: a pilha só existe no eixo da detecção. O
    // período inclui 03/09 e o único aviso é o da escala.
    const avisos = avisosDoPeriodo({ de: '2026-09-01', ate: '2026-09-12' }, 'jogo');
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/escala/i);
  });
});

describe('os atalhos', () => {
  it('o primeiro é a série comparável inteira, que é o padrão da tela', () => {
    expect(ATALHOS[0].periodo('2026-09-12')).toEqual({ de: '2026-09-04', ate: '2026-09-12' });
  });

  it('os últimos 7 dias incluem hoje', () => {
    // Sete dias contando hoje: de 06 a 12 são sete, e não oito.
    expect(ATALHOS[1].periodo('2026-09-12')).toEqual({ de: '2026-09-06', ate: '2026-09-12' });
  });
});

describe('o período anterior', () => {
  it('tem o mesmo tamanho e termina um dia antes', () => {
    // Comparar uma semana contra um mês compara também dois tamanhos de
    // amostra, e aí não se sabe o que mudou.
    expect(periodoAnterior({ de: '2026-09-06', ate: '2026-09-12' })).toEqual({
      de: '2026-08-30',
      ate: '2026-09-05',
    });
  });

  it('de um dia só, é o dia anterior', () => {
    expect(periodoAnterior({ de: '2026-09-12', ate: '2026-09-12' })).toEqual({
      de: '2026-09-11',
      ate: '2026-09-11',
    });
  });
});

describe('o rótulo do período', () => {
  it('é curto, porque ele vive num cabeçalho de coluna', () => {
    expect(rotuloDoPeriodo({ de: '2026-09-04', ate: '2026-09-12' })).toBe('04/09 a 12/09');
  });

  it('de um dia só, não repete a data', () => {
    expect(rotuloDoPeriodo({ de: '2026-09-12', ate: '2026-09-12' })).toBe('12/09');
  });
});

describe('o recorte da série comparável', () => {
  // A virada entrou às 14h35 UTC de 04/09. As duas linhas abaixo são do MESMO
  // dia, uma de cada lado do corte.
  const antesDaVirada = linha({ detectada_em: '2026-09-04T03:00:00' });
  const depoisDaVirada = linha({ detectada_em: '2026-09-04T18:00:00' });

  it('tira a linha de escala antiga quando a janela é a comparável', () => {
    const r = recorteDaSerieComparavel([antesDaVirada, depoisDaVirada], {
      de: '2026-09-04',
      ate: '2026-09-12',
    });
    expect(r.linhas).toEqual([depoisDaVirada]);
    expect(r.foraDaEscala).toBe(1);
  });

  it('não recorta nada quando o sócio pediu uma janela anterior', () => {
    // Ele foi buscar o período antigo; apagar o que ele pediu seria pior que
    // avisar, e é o aviso que cobre esse caso.
    const r = recorteDaSerieComparavel([antesDaVirada, depoisDaVirada], {
      de: '2026-08-20',
      ate: '2026-09-12',
    });
    expect(r.linhas).toHaveLength(2);
    expect(r.foraDaEscala).toBe(0);
  });

  it('janela depois da virada não perde ninguém', () => {
    const r = recorteDaSerieComparavel([depoisDaVirada], { de: '2026-09-06', ate: '2026-09-12' });
    expect(r.foraDaEscala).toBe(0);
  });
});
