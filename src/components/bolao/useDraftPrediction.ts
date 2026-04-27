import { useEffect, useState } from 'react';

/**
 * Persists a single prediction draft (home/away score) in localStorage,
 * keyed by bolão + match. Cleared on successful server save (caller
 * is responsible for calling clearDraft() after upsert).
 *
 * Drafts older than 7 days are auto-cleared on read to avoid stale state.
 */
const PREFIX = 'bolao_draft_pred_';
const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface DraftPayload {
  home: string;
  away: string;
  ts: number;
}

function key(bolaoId: string, matchId: number) {
  return `${PREFIX}${bolaoId}_${matchId}`;
}

export function readDraft(bolaoId: string, matchId: number): { home: string; away: string } | null {
  try {
    const raw = localStorage.getItem(key(bolaoId, matchId));
    if (!raw) return null;
    const parsed: DraftPayload = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - parsed.ts > STALE_MS) {
      localStorage.removeItem(key(bolaoId, matchId));
      return null;
    }
    return { home: parsed.home ?? '', away: parsed.away ?? '' };
  } catch {
    return null;
  }
}

export function writeDraft(bolaoId: string, matchId: number, home: string, away: string) {
  try {
    if (home === '' && away === '') {
      // Empty draft → clear instead of persisting noise
      localStorage.removeItem(key(bolaoId, matchId));
      return;
    }
    const payload: DraftPayload = { home, away, ts: Date.now() };
    localStorage.setItem(key(bolaoId, matchId), JSON.stringify(payload));
  } catch {
    // localStorage may be unavailable (private mode, quota) — silently ignore
  }
}

export function clearDraft(bolaoId: string, matchId: number) {
  try {
    localStorage.removeItem(key(bolaoId, matchId));
  } catch {
    // ignore
  }
}

/**
 * Hook helper that wires together state + persistence. Returns the same
 * shape as a useState pair, plus a clearDraft callback for when the
 * server save succeeds.
 */
export function useDraftPrediction(
  bolaoId: string,
  matchId: number,
  serverHome?: number,
  serverAway?: number
) {
  // Initialize from server value first; if no server value, try draft.
  const [home, setHome] = useState<string>(() => {
    if (serverHome != null) return String(serverHome);
    return readDraft(bolaoId, matchId)?.home ?? '';
  });
  const [away, setAway] = useState<string>(() => {
    if (serverAway != null) return String(serverAway);
    return readDraft(bolaoId, matchId)?.away ?? '';
  });

  // Persist draft whenever the user types (debounced via state itself).
  // Skip persisting when values match the server (no need — already saved).
  useEffect(() => {
    const matchesServer =
      serverHome != null && serverAway != null
      && home === String(serverHome) && away === String(serverAway);
    if (matchesServer) return;
    writeDraft(bolaoId, matchId, home, away);
  }, [bolaoId, matchId, home, away, serverHome, serverAway]);

  const clear = () => clearDraft(bolaoId, matchId);

  return { home, setHome, away, setAway, clear };
}
