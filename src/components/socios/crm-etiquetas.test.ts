import { describe, expect, it } from 'vitest';
import {
  diasDeTesteRestantes,
  DIAS_PARA_VENCER,
  etiquetaDe,
  ETIQUETAS,
  EXPLICACAO_DA_ETIQUETA,
  ROTULO_DA_ETIQUETA,
} from './crm-etiquetas';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';

const HOJE = '2026-09-12';

/** Teste começado há `dias` dias, contando hoje como dia 1. */
const comecouHa = (dias: number) => {
  const d = new Date(`${HOJE}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return `${d.toISOString().slice(0, 10)}T15:00:00Z`;
};

describe('etiquetaDe', () => {
  it('quem nunca testou não tem etiqueta', () => {
    // A ausência é informação. Não existe etiqueta "nunca testou" porque isso é
    // o normal da base, e etiqueta para o normal não distingue nada.
    expect(etiquetaDe(cadastro({ futebol_trial_started_at: null }), HOJE)).toBeNull();
  });

  it('teste no começo é "em teste"', () => {
    expect(etiquetaDe(cadastro({ futebol_trial_started_at: comecouHa(0) }), HOJE)).toBe(
      'trial_ativo',
    );
  });

  it('o penúltimo dia já é "vencendo"', () => {
    // Sete dias de teste, começado há cinco: sobram hoje e amanhã. É a véspera,
    // e é quando a conversa tem que acontecer.
    expect(etiquetaDe(cadastro({ futebol_trial_started_at: comecouHa(5) }), HOJE)).toBe(
      'trial_vencendo',
    );
  });

  it('o último dia também é "vencendo", e não vencido', () => {
    // Hoje a pessoa ainda entra. Chamar de vencido mandaria a mensagem de
    // retomada para quem ainda está com o acesso na mão.
    expect(etiquetaDe(cadastro({ futebol_trial_started_at: comecouHa(6) }), HOJE)).toBe(
      'trial_vencendo',
    );
  });

  it('o dia seguinte é "vencido"', () => {
    expect(etiquetaDe(cadastro({ futebol_trial_started_at: comecouHa(7) }), HOJE)).toBe(
      'trial_vencido',
    );
  });

  it('teste velho continua vencido, e não some', () => {
    // A etiqueta de vencido é o que permite a conversa de retomada. Sumir com
    // ela apagaria da tela todo mundo que já testou.
    expect(etiquetaDe(cadastro({ futebol_trial_started_at: comecouHa(90) }), HOJE)).toBe(
      'trial_vencido',
    );
  });

  it('"vencendo" ganha de "em teste" quando os dois caberiam', () => {
    // Quem vence amanhã também está ativo. Mostrar a menos urgente das duas é
    // perder o motivo da etiqueta existir.
    const vencendo = etiquetaDe(cadastro({ futebol_trial_started_at: comecouHa(6) }), HOJE);
    expect(vencendo).toBe('trial_vencendo');
  });

  it('quem já assina não recebe etiqueta de teste', () => {
    // A pessoa converteu. Lembrar que ela um dia testou não muda conversa
    // nenhuma, e a etiqueta pediria uma cobrança que não faz sentido.
    const assinante = cadastro({
      futebol_trial_started_at: comecouHa(6),
      betinho_subscription_status: 'premium',
    });
    expect(etiquetaDe(assinante, HOJE)).toBeNull();
  });

  it('carimbo ilegível não vira etiqueta', () => {
    expect(etiquetaDe(cadastro({ futebol_trial_started_at: 'sei lá' }), HOJE)).toBeNull();
  });

  it('a madrugada conta pelo dia de Brasília', () => {
    // 02:00Z do dia 13 ainda é o dia 12 aqui. Com a data crua, o teste começado
    // na madrugada vence um dia antes do que deveria.
    const madrugada = cadastro({ futebol_trial_started_at: '2026-09-06T02:00:00Z' });
    // Dia 5 aqui, então o sétimo dia é 11: já venceu.
    expect(etiquetaDe(madrugada, HOJE)).toBe('trial_vencido');
  });
});

describe('diasDeTesteRestantes', () => {
  it('conta hoje como dia que ainda vale', () => {
    expect(diasDeTesteRestantes(cadastro({ futebol_trial_started_at: comecouHa(6) }), HOJE)).toBe(
      0,
    );
    expect(diasDeTesteRestantes(cadastro({ futebol_trial_started_at: comecouHa(5) }), HOJE)).toBe(
      1,
    );
  });

  it('negativo para quem já venceu, e não zero', () => {
    // Zero significa "acaba hoje", que é outra conversa. Empatar os dois faria
    // a mensagem dizer "acaba hoje" para quem perdeu o acesso na semana passada.
    expect(
      diasDeTesteRestantes(cadastro({ futebol_trial_started_at: comecouHa(10) }), HOJE),
    ).toBeLessThan(0);
  });

  it('sem carimbo, não inventa número', () => {
    expect(diasDeTesteRestantes(cadastro({ futebol_trial_started_at: null }), HOJE)).toBeNull();
  });
});

describe('o vocabulário das etiquetas', () => {
  it('toda etiqueta tem rótulo e explicação', () => {
    // Sem isto, somar uma etiqueta nova deixaria a tela com `undefined` no
    // filtro, e a dica vazia.
    for (const e of ETIQUETAS) {
      expect(ROTULO_DA_ETIQUETA[e], e).toBeTruthy();
      expect(EXPLICACAO_DA_ETIQUETA[e], e).toBeTruthy();
    }
  });

  it('a mais urgente vem primeiro na lista', () => {
    // A ordem é a da tela. "Vencendo" antes de "ativo" porque é ela que tem
    // prazo, e prazo é o que decide para quem o sócio liga primeiro.
    expect(ETIQUETAS[0]).toBe('trial_vencendo');
  });

  it('o corte da véspera é declarado, e não um número solto no código', () => {
    expect(DIAS_PARA_VENCER).toBe(1);
  });
});
