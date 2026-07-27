import { useCallback, useEffect, useState } from 'react';
import { usePostHog } from '@posthog/react';
import { canUseCrossSellFutebol } from '@/config/environment';

/**
 * Cross-sell da Plataforma Futebol para usuários do bolão da Copa.
 *
 * Regra de exibição:
 *  - 1x por dia (chave datada em localStorage), site-wide;
 *  - respeita opt-out permanente ("não mostrar de novo");
 *  - kill switch via env (VITE_CROSSSELL_FUTEBOL=off).
 *
 * O gate de rota/usuário fica no CrossSellManager; aqui só cuidamos da
 * regra de frequência + persistência + eventos de analytics.
 */

const LAST_SHOWN_KEY = 'crosssell_futebol_last_shown';
const OPTED_OUT_KEY = 'crosssell_futebol_opted_out';

/** Data local no formato YYYY-MM-DD (não UTC — o "dia" é o do usuário). */
function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* localStorage indisponível (modo privado etc.) — falha silenciosa */
  }
}

interface UseCrossSellFutebolOptions {
  /** Só arma o gatilho quando true (usuário logado, rota permitida). */
  enabled: boolean;
  /** Força a exibição ignorando 1x/dia, opt-out e kill switch (preview via ?crosssell). */
  force?: boolean;
  /** Atraso após o load antes de abrir, pra não estourar no paint. */
  delayMs?: number;
}

export function useCrossSellFutebol({ enabled, force = false, delayMs = 1200 }: UseCrossSellFutebolOptions) {
  const posthog = usePostHog();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (!force) {
      // Gate normal (pulado no modo force de preview).
      if (!canUseCrossSellFutebol) return;
      if (safeGet(OPTED_OUT_KEY) === '1') return;
      if (safeGet(LAST_SHOWN_KEY) === todayKey()) return;
    }

    const timer = setTimeout(() => {
      // Só marca como exibido quando de fato abre — se o usuário sair antes,
      // o pop-up ainda pode aparecer numa próxima rota elegível hoje.
      // No modo force não gravamos nada (é só preview).
      if (!force) safeSet(LAST_SHOWN_KEY, todayKey());
      setIsOpen(true);
      posthog?.capture('crosssell_futebol_shown', {
        trigger: force ? 'forced_preview' : 'daily_first_visit',
      });
    }, force ? 300 : delayMs);

    return () => clearTimeout(timer);
    // posthog é estável; enabled/force são os gatilhos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, force]);

  /** Fecha o pop-up. Se dontShowAgain, grava opt-out permanente. */
  const dismiss = useCallback(
    (dontShowAgain: boolean) => {
      if (dontShowAgain) {
        safeSet(OPTED_OUT_KEY, '1');
        posthog?.capture('crosssell_futebol_opted_out');
      }
      posthog?.capture('crosssell_futebol_dismissed', {
        opted_out: dontShowAgain,
        at: 'teaser',
      });
      setIsOpen(false);
    },
    [posthog],
  );

  return { isOpen, dismiss };
}
