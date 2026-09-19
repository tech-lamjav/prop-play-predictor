import { describe, expect, it } from 'vitest';
import { brtDateStr, brtDayOf, fmtDayChip, fmtTime, formatadorDeData } from './futebol-datas';

// ============================================================================
// O formatador de data é REAPROVEITADO
// ============================================================================
// Não é asseio: construir um `Intl.DateTimeFormat` custa ~216µs e reaproveitar
// um já construído custa ~3µs — 66 vezes, medido em 19/09/2026 num desktop.
//
// `brtDateStr` roda uma vez por jogo e uma vez por oportunidade, em vários
// laços a cada render. Com a agenda de um sábado cheio isso dava milhares de
// construções por troca de dia, e a tela travava 1,4 segundo no clique. Era a
// origem da interação de 2,8s que o PostHog media na home do Futebol.
//
// O teste prende a identidade do objeto, e não o tempo: cronômetro em suíte de
// teste mede a máquina do CI, não o código.
// ============================================================================

const OPCOES = { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' } as const;

describe('formatadorDeData', () => {
  it('devolve o MESMO objeto para as mesmas opções', () => {
    expect(formatadorDeData('pt-BR', { ...OPCOES })).toBe(formatadorDeData('pt-BR', { ...OPCOES }));
  });

  it('separa por idioma e por opções', () => {
    const a = formatadorDeData('pt-BR', { ...OPCOES });
    expect(formatadorDeData('en-CA', { ...OPCOES })).not.toBe(a);
    expect(formatadorDeData('pt-BR', { ...OPCOES, year: 'numeric' })).not.toBe(a);
  });

  it('formata igual a um formatador recém-construído', () => {
    const d = new Date('2026-09-19T23:30:00Z');
    expect(formatadorDeData('pt-BR', { ...OPCOES }).format(d))
      .toBe(new Intl.DateTimeFormat('pt-BR', { ...OPCOES }).format(d));
  });
});

// O reaproveitamento não pode ter mexido na resposta de ninguém — é uma troca
// de desempenho, e a conta de fuso continua exatamente a mesma.
describe('as datas do módulo continuam corretas', () => {
  // O caso que o arquivo inteiro existe para proteger: 21:30 de sábado em
  // Brasília é 00:30 de domingo em UTC, e o dia do jogo é o de Brasília.
  it('jogo noturno pertence ao dia BRT, não ao UTC', () => {
    expect(brtDayOf('2026-09-20T00:30:00')).toBe('2026-09-19');
    expect(brtDateStr(new Date('2026-09-20T00:30:00Z'))).toBe('2026-09-19');
  });

  it('a hora sai em BRT', () => {
    expect(fmtTime('2026-09-20T00:30:00')).toBe('21:30');
  });

  it('a pílula da régua traz dia da semana com inicial maiúscula', () => {
    expect(fmtDayChip('2026-09-19')).toEqual({ weekday: 'Sáb', day: '19/09' });
  });
});
