import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOnboardingTour } from './useOnboardingTour';
import { marcarPesquisaPendente } from '@/hooks/use-pesquisa-pendente';

// ============================================================================
// A pesquisa de perfil tem prioridade sobre o tour (#523)
// ============================================================================
// Dezesseis telas chamam este hook, e o sentinela da pesquisa pode abrir o
// pop-up em cima de qualquer uma delas. Bloquear aqui dentro é o que garante
// que não exista uma décima sétima tela esquecida.
//
// O que estes testes protegem, nesta ordem de importância:
//
//   · com a pesquisa na frente, nenhum tour arma;
//   · quando ela sai da frente, o tour arma LOGO EM SEGUIDA — respondida ou
//     adiada, tanto faz, porque o tour não pode ficar refém de uma resposta
//     que talvez nunca venha;
//   · sem pesquisa nenhuma, tudo segue exatamente como era.
// ============================================================================

const TOUR = 'teste_de_prioridade';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  marcarPesquisaPendente(false);
});

afterEach(() => {
  vi.useRealTimers();
  marcarPesquisaPendente(false);
});

describe('sem pesquisa na frente', () => {
  it('o tour arma depois do atraso, como sempre armou', () => {
    const { result } = renderHook(() => useOnboardingTour(TOUR, { delay: 700 }));
    expect(result.current.run).toBe(false);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(result.current.run).toBe(true);
  });

  it('quem já viu continua não vendo de novo', () => {
    localStorage.setItem(`sb_onboarding_${TOUR}_done`, '1');
    const { result } = renderHook(() => useOnboardingTour(TOUR, { delay: 700 }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.run).toBe(false);
  });
});

describe('com a pesquisa na frente', () => {
  it('o tour não arma, por mais que o tempo passe', () => {
    marcarPesquisaPendente(true);
    const { result } = renderHook(() => useOnboardingTour(TOUR, { delay: 700 }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.run).toBe(false);
  });

  it('assim que ela sai da frente, o tour arma na mesma visita', () => {
    marcarPesquisaPendente(true);
    const { result } = renderHook(() => useOnboardingTour(TOUR, { delay: 700 }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.run).toBe(false);

    // Respondeu ou apertou Pular — para o tour dá no mesmo.
    act(() => {
      marcarPesquisaPendente(false);
    });
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(result.current.run).toBe(true);
  });

  it('o bloqueio não gasta a marca de "já viu" de ninguém', () => {
    marcarPesquisaPendente(true);
    renderHook(() => useOnboardingTour(TOUR, { delay: 700 }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(localStorage.getItem(`sb_onboarding_${TOUR}_done`)).toBeNull();
  });
});

describe('o gate de tela continua valendo', () => {
  it('desligado é desligado, com ou sem pesquisa', () => {
    const { result } = renderHook(() => useOnboardingTour(TOUR, { enabled: false, delay: 700 }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.run).toBe(false);
  });
});
