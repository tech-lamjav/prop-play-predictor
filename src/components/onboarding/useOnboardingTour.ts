import { useCallback, useEffect, useState } from 'react';
import { usePesquisaPendente } from '@/hooks/use-pesquisa-pendente';

// Controla quando um tour roda e lembra que o usuário já o viu.
// Fase 1: persistência em localStorage (por navegador). Upgrade futuro:
// espelhar num campo do Supabase pra valer entre dispositivos.

const storageKey = (tourId: string) => `sb_onboarding_${tourId}_done`;

function wasSeen(tourId: string): boolean {
  try {
    return localStorage.getItem(storageKey(tourId)) === '1';
  } catch {
    return false;
  }
}

/** Esquece que o usuário viu um tour específico — ele volta a auto-iniciar. */
export function resetOnboardingTour(tourId: string) {
  try {
    localStorage.removeItem(storageKey(tourId));
  } catch {
    /* noop */
  }
}

/** Esquece TODOS os tours (hub + produtos) de uma vez. Usado pelo "Rever tour"
 * nas Configurações, pra reabrir a experiência guiada inteira. */
export function resetAllOnboarding() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb_onboarding_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

type Options = {
  /** Só arma o auto-início quando a tela estiver pronta (alvos montados). */
  enabled?: boolean;
  /** Espera antes de iniciar, pra garantir que os alvos já renderizaram. */
  delay?: number;
};

export function useOnboardingTour(tourId: string, { enabled = true, delay = 700 }: Options = {}) {
  const [run, setRun] = useState(false);
  // A pesquisa de perfil tem prioridade sobre qualquer tour. O bloqueio mora
  // AQUI, num lugar só, e não nos dezessete pontos de chamada: assim não existe
  // uma décima oitava tela que alguém esqueceu de bloquear, e um pop-up por
  // cima de um tour não vira bug de tela em tela. Quando a pesquisa sai da
  // frente — respondida ou adiada — este efeito roda de novo e o tour começa
  // logo em seguida, na mesma visita. (#523)
  const pesquisaPendente = usePesquisaPendente();

  useEffect(() => {
    // ⚠️ RECOLHE um tour que já tenha começado, e não só impede de começar.
    // O sinal da pesquisa só liga depois que a sessão do usuário resolve, e há
    // tela armando tour em 700ms sem esperar carregamento nenhum — a de bolão é
    // uma. Sem este `setRun(false)`, uma sessão lenta deixaria o tour subir
    // primeiro e nada o tiraria da frente do pop-up.
    if (pesquisaPendente) {
      setRun(false);
      return;
    }
    if (!enabled || wasSeen(tourId)) return;
    const t = setTimeout(() => setRun(true), delay);
    return () => clearTimeout(t);
  }, [tourId, enabled, delay, pesquisaPendente]);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey(tourId), '1');
    } catch {
      /* localStorage indisponível — segue sem persistir */
    }
    setRun(false);
  }, [tourId]);

  const restart = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(tourId));
    } catch {
      /* noop */
    }
    setRun(true);
  }, [tourId]);

  return { run, finish, restart };
}
