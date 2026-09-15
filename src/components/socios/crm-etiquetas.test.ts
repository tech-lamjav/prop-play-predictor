import { describe, expect, it } from 'vitest';
import {
  diasDeTesteRestantes,
  DIAS_PARA_VENCER,
  etiquetaDe,
  ETIQUETAS,
  EXPLICACAO_DA_ETIQUETA,
  ROTULO_DA_ETIQUETA,
  ultimoDiaDoTeste,
} from './crm-etiquetas';
import { cadastroDeTeste as cadastro, fimDoTesteEm } from './crm-cadastro-de-teste';

const HOJE = '2026-09-12';

/** Teste cujo ÚLTIMO DIA de acesso é daqui a `dias` dias. Zero é hoje. */
const terminaEm = (dias: number) => fimDoTesteEm(HOJE, dias);

describe('etiquetaDe', () => {
  it('quem nunca testou não tem etiqueta', () => {
    // A ausência é informação. Não existe etiqueta "nunca testou" porque isso é
    // o normal da base, e etiqueta para o normal não distingue nada.
    expect(etiquetaDe(cadastro({ futebol_trial_ends_at: null }), HOJE)).toBeNull();
  });

  it('teste com folga é "em teste"', () => {
    expect(etiquetaDe(cadastro({ futebol_trial_ends_at: terminaEm(2) }), HOJE)).toBe(
      'trial_ativo',
    );
  });

  it('a véspera já é "vencendo"', () => {
    // Sobram hoje e amanhã. É a véspera, e é quando a conversa tem que
    // acontecer.
    expect(etiquetaDe(cadastro({ futebol_trial_ends_at: terminaEm(1) }), HOJE)).toBe(
      'trial_vencendo',
    );
  });

  it('o último dia também é "vencendo", e não vencido', () => {
    // Hoje a pessoa ainda entra. Chamar de vencido mandaria a mensagem de
    // retomada para quem ainda está com o acesso na mão.
    expect(etiquetaDe(cadastro({ futebol_trial_ends_at: terminaEm(0) }), HOJE)).toBe(
      'trial_vencendo',
    );
  });

  it('o dia seguinte é "vencido"', () => {
    expect(etiquetaDe(cadastro({ futebol_trial_ends_at: terminaEm(-1) }), HOJE)).toBe(
      'trial_vencido',
    );
  });

  it('teste velho continua vencido, e não some', () => {
    // A etiqueta de vencido é o que permite a conversa de retomada. Sumir com
    // ela apagaria da tela todo mundo que já testou.
    expect(etiquetaDe(cadastro({ futebol_trial_ends_at: terminaEm(-90) }), HOJE)).toBe(
      'trial_vencido',
    );
  });

  it('vale o fim gravado, e não o início mais sete dias', () => {
    // ⚠️ O teste passou para 48 horas. Começado ontem, ele termina hoje. A regra
    // antiga somava sete dias ao início e diria "em teste" por mais cinco dias,
    // e a conversa de conversão chegaria depois de a pessoa ter perdido o
    // acesso.
    const quarentaEOito = cadastro({
      futebol_trial_started_at: terminaEm(-1),
      futebol_trial_ends_at: terminaEm(0),
    });
    expect(etiquetaDe(quarentaEOito, HOJE)).toBe('trial_vencendo');
  });

  it('quem começou antes da troca continua com os sete dias', () => {
    // A página prometeu sete dias a essa pessoa, e o fim gravado guarda a
    // promessa. Começado há três dias, ainda sobram quatro.
    const seteDias = cadastro({
      futebol_trial_started_at: terminaEm(-3),
      futebol_trial_ends_at: terminaEm(4),
    });
    expect(etiquetaDe(seteDias, HOJE)).toBe('trial_ativo');
  });

  it('quem já assina não recebe etiqueta de teste', () => {
    // A pessoa converteu. Lembrar que ela um dia testou não muda conversa
    // nenhuma, e a etiqueta pediria uma cobrança que não faz sentido.
    const assinante = cadastro({
      futebol_trial_ends_at: terminaEm(0),
      betinho_subscription_status: 'premium',
    });
    expect(etiquetaDe(assinante, HOJE)).toBeNull();
  });

  it('carimbo ilegível não vira etiqueta', () => {
    expect(etiquetaDe(cadastro({ futebol_trial_ends_at: 'sei lá' }), HOJE)).toBeNull();
  });

  it('fim à meia-noite daqui não dá aquele dia', () => {
    // 03:00Z do dia 12 é meia-noite do dia 12 em Brasília: o acesso acabou no
    // fim do dia 11. Pelo dia do carimbo, a etiqueta diria que hoje ainda vale.
    const meiaNoite = cadastro({ futebol_trial_ends_at: '2026-09-12T03:00:00Z' });
    expect(etiquetaDe(meiaNoite, HOJE)).toBe('trial_vencido');
  });

  it('fim às 22h daqui ainda é o mesmo dia, embora já seja o seguinte em Greenwich', () => {
    // 01:00Z do dia 13 é 22h do dia 12 aqui. Pelo dia UTC, o último dia seria
    // amanhã, e a pessoa apareceria com um dia a mais.
    const noite = cadastro({ futebol_trial_ends_at: '2026-09-13T01:00:00Z' });
    expect(diasDeTesteRestantes(noite, HOJE)).toBe(0);
  });
});

describe('diasDeTesteRestantes', () => {
  it('conta hoje como dia que ainda vale', () => {
    expect(diasDeTesteRestantes(cadastro({ futebol_trial_ends_at: terminaEm(0) }), HOJE)).toBe(0);
    expect(diasDeTesteRestantes(cadastro({ futebol_trial_ends_at: terminaEm(1) }), HOJE)).toBe(1);
  });

  it('negativo para quem já venceu, e não zero', () => {
    // Zero significa "acaba hoje", que é outra conversa. Empatar os dois faria
    // a mensagem dizer "acaba hoje" para quem perdeu o acesso na semana passada.
    expect(
      diasDeTesteRestantes(cadastro({ futebol_trial_ends_at: terminaEm(-4) }), HOJE),
    ).toBeLessThan(0);
  });

  it('sem fim gravado, não inventa número', () => {
    expect(diasDeTesteRestantes(cadastro({ futebol_trial_ends_at: null }), HOJE)).toBeNull();
  });
});

describe('ultimoDiaDoTeste', () => {
  it('é o dia de Brasília do instante anterior ao fim', () => {
    // A ficha usa esta mesma função no "termina em". Duas contas do último dia
    // divergiriam justamente na virada, que é onde o erro aparece.
    expect(ultimoDiaDoTeste('2026-09-12T15:00:00Z')).toBe('2026-09-12');
    expect(ultimoDiaDoTeste('2026-09-12T03:00:00Z')).toBe('2026-09-11');
    expect(ultimoDiaDoTeste('2026-09-13T01:00:00Z')).toBe('2026-09-12');
  });

  it('sem fim, ou com fim ilegível, é nulo', () => {
    expect(ultimoDiaDoTeste(null)).toBeNull();
    expect(ultimoDiaDoTeste('sei lá')).toBeNull();
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
