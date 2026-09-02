import { describe, expect, it } from 'vitest';
import { resumoDoDia } from './futebol-settlement';

// ============================================================================
// O resumo do dia conta o que NÃO liquidou (issue #323)
// ============================================================================
// Em 29/08/2026 a tela publicou seis oportunidades e a manchete disse "2 de 3
// deram green". As outras três não estavam erradas nem certas: sumiram. O
// resumo só contava linha com resultado, então oportunidade sem fixture — logo
// sem placar — desaparecia da conta sem deixar rastro.
//
// A causa de fundo (a lista fixa de ligas) foi corrigida. Isto cobre o resíduo:
// quando ainda assim faltar fixture, a conta precisa dizer, em vez de encolher
// o denominador em silêncio.
// ============================================================================

const liquidada = (resultado: 'won' | 'lost' | 'push' | 'half_won' | 'half_lost') =>
  ({ kickoff_utc: '2026-08-29T14:30:00Z', resultado } as const);
const aguardando = { kickoff_utc: '2026-08-29T14:30:00Z', resultado: null } as const;
const semFixture = { kickoff_utc: null, resultado: null } as const;

describe('resumoDoDia', () => {
  it('conta acerto, erro e anulada como antes', () => {
    const r = resumoDoDia([liquidada('won'), liquidada('half_won'), liquidada('lost'), liquidada('push')]);
    expect(r).toMatchObject({ hit: 2, miss: 1, push: 1, settled: 4 });
  });

  it('o total é o que foi publicado, não o que liquidou', () => {
    // O caso de 29/08: seis publicadas, três com placar.
    const r = resumoDoDia([
      liquidada('won'), liquidada('won'), liquidada('lost'),
      semFixture, semFixture, semFixture,
    ]);
    expect(r.settled).toBe(3);
    expect(r.total).toBe(6);
    expect(r.semFixture).toBe(3);
  });

  it('separa quem espera o jogo de quem não tem jogo', () => {
    // As duas não liquidaram, mas só uma é anomalia: a linha sem fixture aponta
    // pick publicado num jogo que o calendário não trouxe. A outra é só o
    // relógio.
    const r = resumoDoDia([aguardando, semFixture]);
    expect(r.aguardando).toBe(1);
    expect(r.semFixture).toBe(1);
    expect(r.settled).toBe(0);
  });

  it('não sobra nem falta linha na conta', () => {
    const linhas = [liquidada('won'), liquidada('lost'), aguardando, semFixture];
    const r = resumoDoDia(linhas);
    expect(r.settled + r.aguardando + r.semFixture).toBe(r.total);
    expect(r.total).toBe(linhas.length);
  });

  it('dia vazio não inventa pendência', () => {
    expect(resumoDoDia([])).toMatchObject({
      hit: 0, miss: 0, push: 0, settled: 0, aguardando: 0, semFixture: 0, total: 0,
    });
  });
});
