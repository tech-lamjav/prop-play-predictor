import { describe, expect, it } from 'vitest';
import { resumoDoDia } from './futebol-settlement';

// ============================================================================
// O resumo do dia conta o que NÃO liquidou (issue #323)
// ============================================================================
// Em 29/08/2026 a tela publicou seis oportunidades e a manchete disse "2 de 3
// deram green". As outras três não estavam erradas nem certas: sumiram. O
// resumo só contava linha com resultado, então oportunidade sem placar
// desaparecia da conta sem deixar rastro.
//
// A causa de fundo (a lista fixa de ligas) foi corrigida. Isto cobre o resíduo:
// quando ainda assim faltar resultado — por falta de fixture OU por jogo adiado
// —, a conta precisa dizer, em vez de encolher o denominador em silêncio.
// ============================================================================

const liquidada = (resultado: 'won' | 'lost' | 'push' | 'half_won' | 'half_lost') =>
  ({ temFixture: true, resultado } as const);
const aguardando = { temFixture: true, resultado: null } as const;
const semFixture = { temFixture: false, resultado: null } as const;

describe('resumoDoDia', () => {
  it('conta acerto, erro e anulada como antes', () => {
    const r = resumoDoDia([liquidada('won'), liquidada('half_won'), liquidada('lost'), liquidada('push')]);
    expect(r).toMatchObject({ hit: 2, miss: 1, push: 1, settled: 4, pendentes: 0 });
  });

  it('o total é o que foi publicado, não o que liquidou', () => {
    // O caso de 29/08: seis publicadas, três com placar.
    const r = resumoDoDia([
      liquidada('won'), liquidada('won'), liquidada('lost'),
      semFixture, semFixture, semFixture,
    ]);
    expect(r.settled).toBe(3);
    expect(r.total).toBe(6);
    expect(r.pendentes).toBe(3);
    expect(r.semFixture).toBe(3);
  });

  it('separa a causa: quem espera o jogo e quem não tem jogo', () => {
    const r = resumoDoDia([aguardando, semFixture]);
    expect(r.aguardando).toBe(1);
    expect(r.semFixture).toBe(1);
    expect(r.settled).toBe(0);
  });

  it('jogo adiado também conta como pendente, e não some da conta', () => {
    // O defeito recriado com outra causa: num dia passado, jogo adiado tem
    // fixture e não tem resultado. Contar só `semFixture` faria a manchete
    // dizer "2 de 2" num dia de três — o mesmo denominador encolhido.
    const r = resumoDoDia([liquidada('won'), liquidada('lost'), aguardando]);
    expect(r.settled).toBe(2);
    expect(r.total).toBe(3);
    expect(r.pendentes).toBe(1);
    expect(r.semFixture).toBe(0);
  });

  it('não sobra nem falta linha na conta', () => {
    const linhas = [liquidada('won'), liquidada('lost'), aguardando, semFixture];
    const r = resumoDoDia(linhas);
    expect(r.settled + r.pendentes).toBe(r.total);
    expect(r.aguardando + r.semFixture).toBe(r.pendentes);
    expect(r.total).toBe(linhas.length);
  });

  it('linha sem fixture que por algum motivo tem resultado conta como liquidada', () => {
    // Defensivo: o que manda é ter resultado. Se um dia o placar vier por outra
    // via, a linha liquidou — não é pendência.
    const r = resumoDoDia([{ temFixture: false, resultado: 'won' }]);
    expect(r).toMatchObject({ hit: 1, settled: 1, pendentes: 0, semFixture: 0 });
  });

  it('dia vazio não inventa pendência', () => {
    expect(resumoDoDia([])).toMatchObject({
      hit: 0, miss: 0, push: 0, settled: 0, aguardando: 0, semFixture: 0, pendentes: 0, total: 0,
    });
  });
});
