import { describe, expect, it } from 'vitest';
import { faixaDeAcessoAparece, linhaBloqueada } from './futebol-bloqueio';
import type { FutebolAccess } from '@/services/futebol-data.service';

const acesso = (state: FutebolAccess['state']): FutebolAccess => ({
  state,
  unlocked: state === 'subscribed' || state === 'trial',
  days_left: null,
  hours_left: null,
  trial_ends_at: null,
});

describe('linhaBloqueada', () => {
  it('linha sem mercado é a que o banco fechou', () => {
    expect(linhaBloqueada({ market: null })).toBe(true);
    expect(linhaBloqueada({ market: 'over_under' })).toBe(false);
  });

  // "Sem linha nenhuma" não é "linha fechada": a tela diz frases diferentes.
  it('a ausência de linha não conta como bloqueio', () => {
    expect(linhaBloqueada(null)).toBe(false);
    expect(linhaBloqueada(undefined)).toBe(false);
  });
});

// A regra vale por dois leitores: o componente da faixa e o `useFaixaDeAcesso`,
// que reserva o espaço dela antes de o banco responder. É por precisarem da
// MESMA resposta que ela mora aqui, e não dentro do componente.
describe('faixaDeAcessoAparece', () => {
  it('deslogado e expirado veem a faixa — é hora de agir', () => {
    expect(faixaDeAcessoAparece(acesso('anon'))).toBe(true);
    expect(faixaDeAcessoAparece(acesso('expired'))).toBe(true);
  });

  // Quem está no teste em dia tem o chip do cabeçalho contando as horas; a
  // faixa forte em cima disso seria a mesma urgência dita duas vezes.
  it('assinante e teste em dia não veem', () => {
    expect(faixaDeAcessoAparece(acesso('subscribed'))).toBe(false);
    expect(faixaDeAcessoAparece(acesso('trial'))).toBe(false);
  });

  it('sem resposta ainda, não afirma nada', () => {
    expect(faixaDeAcessoAparece(undefined)).toBe(false);
    expect(faixaDeAcessoAparece(null)).toBe(false);
  });
});
