import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Trophy, Target, Medal, Star, Flame, Award, Share2 } from 'lucide-react';
import { AchievementShareImage } from '@/components/bolao/AchievementShareImage';
import { shareImage } from '@/components/bolao/share-utils';

/**
 * Sistema de conquistas (achievements) estilo Xbox/PlayStation.
 *
 * Como funciona:
 *  1. Componentes consumidores chamam `useAchievement().unlock(id, ...)`.
 *  2. O Provider mantém uma fila e mostra um badge flutuante por 3.5s.
 *  3. Cada achievement é registrado em localStorage pra evitar repetir.
 *
 * Como adicionar conquistas novas:
 *  - Adicionar entry em ACHIEVEMENTS abaixo
 *  - Chamar `unlock('achievement-id')` no momento certo
 *
 * Visual: drop-in do topo, badge dourado, ícone + nome + descrição.
 * Respeita prefers-reduced-motion (sem animação se usuário prefere parado).
 */

type AchievementId =
  | 'first-prediction'
  | 'first-exact-score'
  | 'reached-podium'
  | 'all-group-stage-done'
  | 'champion-picked'
  | 'streak-5-correct'
  | 'first-special-pick'
  | 'all-finalists-picked';

interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Persistir no localStorage (achievements grandes, "uma vez na vida") */
  persistent?: boolean;
}

const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  'first-prediction':       { id: 'first-prediction',      title: 'Primeiro palpite',          description: 'Você está no jogo',                icon: Target,  persistent: true },
  'first-exact-score':      { id: 'first-exact-score',     title: 'Cravou o placar!',          description: 'Acertou um placar exato',          icon: Flame,   persistent: true },
  'reached-podium':         { id: 'reached-podium',        title: 'No pódio',                  description: 'Top 3 no ranking',                 icon: Medal,   persistent: true },
  'all-group-stage-done':   { id: 'all-group-stage-done',  title: 'Fase de grupos completa',   description: 'Palpitou todos os 48 jogos',       icon: Award,   persistent: true },
  'champion-picked':        { id: 'champion-picked',       title: 'Apostou alto',              description: 'Escolheu o campeão',               icon: Trophy,  persistent: true },
  'streak-5-correct':       { id: 'streak-5-correct',      title: 'Sequência de 5',            description: 'Acertou 5 palpites seguidos',      icon: Star,    persistent: true },
  'first-special-pick':     { id: 'first-special-pick',    title: 'Olho de águia',             description: 'Primeira aposta em palpite especial', icon: Star,   persistent: true },
  'all-finalists-picked':   { id: 'all-finalists-picked',  title: 'Aposta final',              description: 'Escolheu seus 2 finalistas',       icon: Trophy,  persistent: true },
};

const STORAGE_PREFIX = 'achievement_unlocked_';

interface QueueItem {
  uid: number; // unique render key
  def: AchievementDef;
}

interface AchievementContextValue {
  unlock: (id: AchievementId, scopeKey?: string) => void;
}

const AchievementContext = createContext<AchievementContextValue | null>(null);

export const AchievementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [counter, setCounter] = useState(0);

  const unlock = useCallback((id: AchievementId, scopeKey?: string) => {
    const def = ACHIEVEMENTS[id];
    if (!def) return;

    if (def.persistent) {
      const key = STORAGE_PREFIX + id + (scopeKey ? '_' + scopeKey : '');
      try {
        if (localStorage.getItem(key) === '1') return; // já desbloqueado
        localStorage.setItem(key, '1');
      } catch {
        // localStorage indisponível — ainda mostra o badge
      }
    }

    setCounter(c => c + 1);
    setQueue(q => [...q, { uid: Date.now() + Math.random(), def }]);
  }, []);

  // Auto-dismiss after 3.5s
  useEffect(() => {
    if (queue.length === 0) return;
    const head = queue[0];
    const timer = setTimeout(() => {
      setQueue(q => q.filter(item => item.uid !== head.uid));
    }, 3500);
    return () => clearTimeout(timer);
  }, [queue]);

  const current = queue[0];

  return (
    <AchievementContext.Provider value={{ unlock }}>
      {children}
      {current && <AchievementBadge key={current.uid} def={current.def} />}
    </AchievementContext.Provider>
  );
};

export function useAchievement(): AchievementContextValue {
  const ctx = useContext(AchievementContext);
  if (!ctx) {
    // Fallback silencioso fora do provider — não quebra app
    return { unlock: () => {} };
  }
  return ctx;
}

// Badge visual — drop-in animation, fixed top-center
const AchievementBadge: React.FC<{ def: AchievementDef }> = ({ def }) => {
  const Icon = def.icon;
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sharing || !captureRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const blob: Blob | null = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b), 'image/png', 0.95)
      );
      if (!blob) return;
      await shareImage(blob, {
        filename: `conquista-${def.id}.png`,
        title: `Conquista: ${def.title}`,
        text: `${def.title} — ${def.description} 🏆`,
      });
    } catch {
      // ignore — toast já cuida via shareImage fallback
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="theme-bolao fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-achievement-drop motion-reduce:animate-none"
      >
        <div className="flex items-center gap-3 pl-2 pr-2 py-2 rounded-full border border-amber/60 bg-gradient-to-r from-amber-2/95 via-amber/95 to-amber/95 shadow-lg shadow-amber/30 backdrop-blur-sm min-w-[300px] max-w-[92vw]">
          <div className="w-10 h-10 rounded-full bg-white border border-amber/40 flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-amber-2" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2 leading-tight">
              Conquista
            </p>
            <p className="text-[14px] font-bold text-ink leading-tight truncate">
              {def.title}
            </p>
            <p className="text-[11px] text-ink-2 leading-tight truncate">
              {def.description}
            </p>
          </div>
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            aria-label="Compartilhar conquista"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-ink/10 hover:bg-ink/20 active:bg-ink/25 text-ink transition-colors disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Off-screen render do card 1080×1080 capturável */}
      <AchievementShareImage
        ref={captureRef}
        icon={def.icon}
        title={def.title}
        description={def.description}
      />
    </>
  );
};
