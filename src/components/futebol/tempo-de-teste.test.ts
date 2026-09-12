import { describe, expect, it } from 'vitest';
import type { FutebolAccess } from '@/services/futebol-data.service';
import { horasRestantes, tempoDeTeste } from './tempo-de-teste';

// ============================================================================
// O contador do teste grátis, agora que o teste dura 48 horas
// ============================================================================
// Em dias arredondados, um teste de 48 horas só consegue dizer "2 dias" e
// depois "1 dia" — e some. Isso é o oposto da urgência que motivou encurtar, e
// é por isso que a contagem passa a ser em horas.
//
// O detalhe que obriga as duas unidades a conviverem: existem DUAS coortes
// vivas. Quem começou antes do corte tem até 7 dias (168 horas) gravados, e
// "faltam 161 horas" não é informação, é ruído. Então a unidade acompanha a
// ordem de grandeza: acima de 48 horas fala em dias, dentro de 48 fala em
// horas.
// ============================================================================

const AGORA = Date.parse('2026-09-12T12:00:00Z');

/** Um acesso em teste que termina daqui a `h` horas. */
function emTeste(h: number, override: Partial<FutebolAccess> = {}): FutebolAccess {
  return {
    state: 'trial',
    unlocked: true,
    days_left: Math.max(0, Math.ceil(h / 24)),
    hours_left: Math.max(0, h),
    trial_ends_at: new Date(AGORA + h * 3600000).toISOString(),
    ...override,
  };
}

describe('horasRestantes', () => {
  it('acredita no servidor quando ele responde', () => {
    // O relógio do servidor é o que decide o acesso. Preferir o dele evita a
    // tela dizer "falta 1 hora" num celular com o horário adiantado.
    expect(horasRestantes(emTeste(30), AGORA)).toBe(30);
  });

  it('cai para a data de término quando o servidor não mandou as horas', () => {
    // Acontece de verdade em duas situações: resposta antiga guardada em cache
    // pelo react-query, e ambiente onde a migration 134 ainda não subiu.
    const semHoras = emTeste(30, { hours_left: null });
    expect(horasRestantes(semHoras, AGORA)).toBe(30);
  });

  it('arredonda para cima a fração de hora', () => {
    const meiaHora = emTeste(0, { hours_left: null, trial_ends_at: new Date(AGORA + 1800000).toISOString() });
    expect(horasRestantes(meiaHora, AGORA)).toBe(1);
  });

  it('não devolve número negativo', () => {
    expect(horasRestantes(emTeste(-5), AGORA)).toBe(0);
  });

  it('devolve nulo quando não há nada de onde tirar', () => {
    expect(horasRestantes({ state: 'anon', unlocked: false, days_left: null, hours_left: null, trial_ends_at: null }, AGORA)).toBeNull();
    expect(horasRestantes(undefined, AGORA)).toBeNull();
  });

  it('ignora data de término ilegível', () => {
    const quebrado = emTeste(0, { hours_left: null, trial_ends_at: 'sei lá' });
    expect(horasRestantes(quebrado, AGORA)).toBeNull();
  });
});

describe('tempoDeTeste dentro das 48 horas', () => {
  it('fala em horas', () => {
    expect(tempoDeTeste(emTeste(31), AGORA)).toMatchObject({
      curto: '31h',
      longo: 'faltam 31 horas',
    });
  });

  it('usa o singular na última hora', () => {
    expect(tempoDeTeste(emTeste(1), AGORA)).toMatchObject({
      curto: '1h',
      longo: 'falta 1 hora',
    });
  });

  it('nas 48 horas cheias ainda fala em horas', () => {
    // A borda é o valor que um teste novo tem no primeiro segundo.
    expect(tempoDeTeste(emTeste(48), AGORA)?.curto).toBe('48h');
  });

  it('avisa que acabou o tempo sem dizer zero', () => {
    // "0h restantes" numa pílula que existe só enquanto o teste vale é pior que
    // não dizer nada: a pessoa lê que perdeu o acesso que ainda tem.
    expect(tempoDeTeste(emTeste(0), AGORA)).toMatchObject({
      curto: '<1h',
      longo: 'falta menos de 1 hora',
    });
  });
});

describe('tempoDeTeste acima das 48 horas (a coorte de 7 dias)', () => {
  it('fala em dias', () => {
    expect(tempoDeTeste(emTeste(24 * 7), AGORA)).toMatchObject({
      curto: '7d',
      longo: 'faltam 7 dias',
    });
  });

  it('arredonda o dia para cima, como o servidor faz', () => {
    expect(tempoDeTeste(emTeste(49), AGORA)?.curto).toBe('3d');
  });

  it('usa o singular quando sobra um dia', () => {
    // Só alcançável por quem tem mais de 48h e menos de 24h ao mesmo tempo, o
    // que é impossível — a guarda existe para a frase não nascer errada se o
    // corte das 48 horas mudar de valor depois.
    expect(tempoDeTeste(emTeste(24), AGORA)?.longo).not.toBe('faltam 1 dias');
  });
});

describe('a última reta', () => {
  it('não está acabando com um dia e meio pela frente', () => {
    expect(tempoDeTeste(emTeste(36), AGORA)?.acabando).toBe(false);
  });

  it('está acabando nas últimas doze horas', () => {
    expect(tempoDeTeste(emTeste(12), AGORA)?.acabando).toBe(true);
    expect(tempoDeTeste(emTeste(2), AGORA)?.acabando).toBe(true);
  });

  it('a coorte de 7 dias também chega na última reta', () => {
    // O aviso é sobre o tempo que sobra, não sobre qual coorte a pessoa é.
    expect(tempoDeTeste(emTeste(5), AGORA)?.acabando).toBe(true);
  });
});

describe('tempoDeTeste fora do teste', () => {
  it('não inventa contador para quem não está em teste', () => {
    expect(tempoDeTeste({ state: 'subscribed', unlocked: true, days_left: null, hours_left: null, trial_ends_at: null }, AGORA)).toBeNull();
    expect(tempoDeTeste(undefined, AGORA)).toBeNull();
  });
});
