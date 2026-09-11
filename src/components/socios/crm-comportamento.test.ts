import { describe, expect, it } from 'vitest';
import { historiaTruncada, tempoDeTela, type Comportamento } from './crm-comportamento';

const comportamento = (over: Partial<Comportamento> = {}): Comportamento => ({
  primeiroEvento: '2026-09-01T12:00:00Z',
  ultimoEvento: '2026-09-10T12:00:00Z',
  eventos: 40,
  sessoes: 5,
  segundosDeTela: 3600,
  paginas: [],
  ...over,
});

describe('tempoDeTela', () => {
  it('minutos, quando não chega a uma hora', () => {
    expect(tempoDeTela(600)).toBe('10min');
  });

  it('horas e minutos', () => {
    expect(tempoDeTela(8100)).toBe('2h 15min');
  });

  it('hora redonda não vira "2h 0min"', () => {
    expect(tempoDeTela(7200)).toBe('2h');
  });

  it('cinquenta e nove minutos e meio não viram "2h 60min"', () => {
    // O arredondamento dos minutos estoura para sessenta, e sem tratar isso
    // sai um horário que não existe.
    expect(tempoDeTela(7195)).toBe('2h');
  });

  it('menos de um minuto é dito, e não vira zero', () => {
    // "0min" é lido como ausência, e a pessoa esteve lá.
    expect(tempoDeTela(30)).toBe('menos de 1min');
  });

  it('sem tempo nenhum é dito com palavra', () => {
    expect(tempoDeTela(0)).toBe('sem tempo registrado');
    expect(tempoDeTela(Number.NaN)).toBe('sem tempo registrado');
  });
});

describe('historiaTruncada', () => {
  it('primeiro evento muito depois do cadastro significa história cortada', () => {
    // Quem se cadastrou em março e tem evento só desde setembro não sumiu: o
    // plano do PostHog descartou o que era mais antigo. "2 sessões" ali parece
    // abandono e é outra coisa.
    expect(
      historiaTruncada(
        comportamento({ primeiroEvento: '2026-09-01T12:00:00Z' }),
        '2026-03-05T12:00:00Z',
      ),
    ).toBe(true);
  });

  it('primeiro evento junto do cadastro é história inteira', () => {
    expect(
      historiaTruncada(
        comportamento({ primeiroEvento: '2026-03-05T12:05:00Z' }),
        '2026-03-05T12:00:00Z',
      ),
    ).toBe(false);
  });

  it('sem evento nenhum, não afirma que cortou', () => {
    // Pessoa sem evento é pessoa que não usou, e isso não é truncamento.
    expect(historiaTruncada(comportamento({ primeiroEvento: null }), '2026-03-05T12:00:00Z')).toBe(
      false,
    );
  });

  it('sem data de cadastro, não há comparação a fazer', () => {
    expect(historiaTruncada(comportamento(), null)).toBe(false);
  });
});
