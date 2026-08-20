import { describe, it, expect } from 'vitest';
import {
  parseUtc,
  brtDateStr,
  brtDayOf,
  addDays,
  fmtTime,
  fmtDayHeader,
  fmtDayChip,
  fmtDayShort,
  yearOf,
  isFinished,
  isLive,
} from './futebol-datas';

// Os testes não dependem do fuso da máquina: todo formatador recebe
// timeZone: 'America/Sao_Paulo' explícito. Rodam igual em CI e no Windows local.

describe('brtDayOf — a virada de dia do jogo noturno', () => {
  // Caso real do mart (fixture São Paulo x Flamengo, season 2026): kickoff
  // 00:30 UTC do dia 29 é 21:30 do dia 28 em Brasília. A /futebol/jogos agrupava
  // por `date_utc` e jogava esse jogo pro dia 29, errado. São 288 de 2.128 jogos
  // de 2026 nessa condição.
  it('joga o kickoff 00:30 UTC pro dia anterior em BRT', () => {
    expect(brtDayOf('2026-01-29T00:30:00')).toBe('2026-01-28');
  });

  it('não confunde com o dia UTC do mesmo registro', () => {
    // date_utc do registro é 2026-01-29; o dia BRT tem que ser outro.
    expect(brtDayOf('2026-01-29T00:30:00')).not.toBe('2026-01-29');
  });

  it('vira o dia exatamente às 03:00 UTC (meia-noite em BRT)', () => {
    expect(brtDayOf('2026-01-29T02:59:59')).toBe('2026-01-28');
    expect(brtDayOf('2026-01-29T03:00:00')).toBe('2026-01-29');
  });

  it('jogo de tarde fica no mesmo dia nos dois fusos', () => {
    // 17:00 BRT = 20:00 UTC, mesmo dia civil nos dois.
    expect(brtDayOf('2026-07-29T20:00:00')).toBe('2026-07-29');
  });

  it('devolve null pra kickoff ausente', () => {
    expect(brtDayOf(null)).toBeNull();
    expect(brtDayOf(undefined)).toBeNull();
    expect(brtDayOf('')).toBeNull();
  });
});

describe('parseUtc', () => {
  it('trata timestamp sem fuso como UTC, não como hora local', () => {
    expect(parseUtc('2026-01-29T00:30:00')?.toISOString()).toBe('2026-01-29T00:30:00.000Z');
  });

  it('aceita data pura', () => {
    expect(parseUtc('2026-01-29')?.toISOString()).toBe('2026-01-29T00:00:00.000Z');
  });

  it('respeita fuso explícito quando vem na string', () => {
    expect(parseUtc('2026-01-29T00:30:00Z')?.toISOString()).toBe('2026-01-29T00:30:00.000Z');
  });

  it('devolve null pra lixo', () => {
    expect(parseUtc('nao é data')).toBeNull();
    expect(parseUtc(null)).toBeNull();
  });
});

describe('fmtTime', () => {
  it('mostra o horário em BRT, não em UTC', () => {
    expect(fmtTime('2026-01-29T00:30:00')).toBe('21:30');
    expect(fmtTime('2026-07-29T20:00:00')).toBe('17:00');
  });

  it('devolve string vazia sem kickoff', () => {
    expect(fmtTime(null)).toBe('');
  });
});

describe('brtDateStr', () => {
  it('formata como YYYY-MM-DD, que ordena como string', () => {
    const dias = [
      brtDateStr(new Date('2026-02-01T15:00:00Z')),
      brtDateStr(new Date('2026-01-29T15:00:00Z')),
      brtDateStr(new Date('2026-12-02T15:00:00Z')),
    ];
    expect([...dias].sort()).toEqual(['2026-01-29', '2026-02-01', '2026-12-02']);
  });
});

describe('addDays', () => {
  it('anda e volta um dia', () => {
    expect(addDays('2026-07-29', 1)).toBe('2026-07-30');
    expect(addDays('2026-07-29', -1)).toBe('2026-07-28');
  });

  it('atravessa virada de mês e de ano', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('acerta 29 de fevereiro em ano bissexto', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('fmtDayHeader', () => {
  it('monta cabeçalho com dia da semana capitalizado', () => {
    expect(fmtDayHeader('2026-07-29')).toBe('Quarta-feira, 29 de jul');
  });

  it('não escorrega pro dia vizinho', () => {
    expect(fmtDayHeader('2026-08-01')).toContain('01');
    expect(fmtDayHeader('2026-08-01')).not.toContain('31');
  });

  it('aguenta chave ausente ou inválida', () => {
    expect(fmtDayHeader(null)).toBe('—');
    expect(fmtDayHeader('xx')).toBe('—');
  });
});

describe('fmtDayChip', () => {
  it('devolve dia da semana curto e dia/mês', () => {
    expect(fmtDayChip('2026-07-29')).toEqual({ weekday: 'Qua', day: '29/07' });
  });
});

describe('fmtDayShort / yearOf', () => {
  it('omite o dia da semana', () => {
    expect(fmtDayShort('2026-03-21')).toBe('21 de mar');
  });

  it('inclui o ano quando pedido', () => {
    expect(fmtDayShort('2027-05-30', true)).toBe('30 de mai de 2027');
  });

  it('yearOf serve pra decidir se a temporada atravessa o ano', () => {
    expect(yearOf('2026-08-15')).toBe('2026');
    expect(yearOf('2027-05-30')).toBe('2027');
    expect(yearOf(null)).toBeNull();
  });

  it('aguenta chave ausente', () => {
    expect(fmtDayShort(null)).toBe('—');
  });
});

describe('isFinished / isLive', () => {
  it('encerrado cobre prorrogação e pênaltis', () => {
    ['FT', 'AET', 'PEN'].forEach((s) => expect(isFinished(s)).toBe(true));
  });

  it('não confunde ao vivo com encerrado', () => {
    ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].forEach((s) => {
      expect(isLive(s)).toBe(true);
      expect(isFinished(s)).toBe(false);
    });
  });

  it('jogo não começado não é nenhum dos dois', () => {
    expect(isFinished('NS')).toBe(false);
    expect(isLive('NS')).toBe(false);
    expect(isFinished(null)).toBe(false);
    expect(isLive(null)).toBe(false);
  });
});
