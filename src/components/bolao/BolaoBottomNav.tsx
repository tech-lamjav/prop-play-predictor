import React from 'react';
import { Target, Trophy, Star, Lock } from 'lucide-react';

interface BolaoBottomNavProps {
  pendingPredictions: number;
  hasChampionPick: boolean;
  championEnabled: boolean;
  specialEnabled: boolean;
  isPremium: boolean;
  onOpenPredictions: () => void;
  onOpenChampion: () => void;
  onOpenSpecial: () => void;
}

/**
 * Bottom navigation fixa em mobile (lg:hidden) com 3 ações principais
 * do bolão. Substitui o FAB anterior — descoberta zero, 1 click pra cada ação.
 *
 * Quando o palpite de campeão ou especiais está desabilitado pelo owner,
 * o botão fica desabilitado mas continua visível pra manter consistência.
 *
 * Free users veem cadeado no botão de Especiais (Premium-only).
 */
export const BolaoBottomNav: React.FC<BolaoBottomNavProps> = ({
  pendingPredictions,
  hasChampionPick,
  championEnabled,
  specialEnabled,
  isPremium,
  onOpenPredictions,
  onOpenChampion,
  onOpenSpecial,
}) => {
  const specialLocked = !isPremium;

  return (
    <nav
      role="navigation"
      aria-label="Ações do bolão"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-terminal-bg/95 backdrop-blur-md border-t border-terminal-border-subtle"
      // pb-safe: pads for iOS bottom safe area (notch / home indicator)
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-16">
        {/* 1. Palpitar — sempre visível */}
        <button
          type="button"
          onClick={onOpenPredictions}
          aria-label={
            pendingPredictions > 0
              ? `Fazer palpites — ${pendingPredictions} pendentes`
              : 'Fazer palpites'
          }
          className="relative flex-1 flex flex-col items-center justify-center gap-0.5 text-terminal-blue hover:bg-terminal-blue/10 active:bg-terminal-blue/20 transition-colors min-h-11"
        >
          <div className="relative">
            <Target className="w-5 h-5" />
            {pendingPredictions > 0 && (
              <span
                className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-terminal-red text-white text-[10px] font-bold flex items-center justify-center leading-none"
                aria-hidden
              >
                {pendingPredictions > 99 ? '99+' : pendingPredictions}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Palpitar</span>
        </button>

        {/* 2. Campeão — visível só se habilitado */}
        {championEnabled && (
          <>
            <div className="w-px bg-terminal-border-subtle" />
            <button
              type="button"
              onClick={onOpenChampion}
              aria-label={hasChampionPick ? 'Alterar palpite de campeão' : 'Escolher campeão da Copa'}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 text-yellow-400 hover:bg-yellow-500/10 active:bg-yellow-500/20 transition-colors min-h-11"
            >
              <div className="relative">
                <Trophy className="w-5 h-5" />
                {!hasChampionPick && (
                  <span
                    className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-yellow-400 animate-pulse"
                    aria-hidden
                  />
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Campeão</span>
            </button>
          </>
        )}

        {/* 3. Especiais — visível só se habilitado */}
        {specialEnabled && (
          <>
            <div className="w-px bg-terminal-border-subtle" />
            <button
              type="button"
              onClick={onOpenSpecial}
              disabled={specialLocked}
              aria-label={
                specialLocked
                  ? 'Palpites especiais (premium)'
                  : 'Ver palpites especiais'
              }
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-11 ${
                specialLocked
                  ? 'text-terminal-text/30 cursor-not-allowed'
                  : 'text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20'
              }`}
            >
              <div className="relative">
                <Star className="w-5 h-5" />
                {specialLocked && (
                  <Lock
                    className="absolute -top-1 -right-1.5 w-3 h-3 text-yellow-400 bg-terminal-bg rounded-full p-0.5"
                    aria-hidden
                  />
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">Especiais</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
};
