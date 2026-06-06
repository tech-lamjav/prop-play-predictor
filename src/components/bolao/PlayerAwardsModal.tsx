import React from 'react';
import { Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlayerAwardsSection } from '@/components/bolao/PlayerAwardsSection';
import type { WcMatch, SpecialDeadlinesConfig, PlayerAwardType } from '@/services/bolao.service';

interface PlayerAwardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bolaoId: string;
  bolaoName: string;
  matches: WcMatch[];
  /** Liga/desliga cada prêmio (config do bolão). */
  playerAwardsEnabled?: Record<string, boolean>;
  /** Pontos por prêmio (config do bolão). */
  playerAwardPoints?: Record<string, number>;
  specialDeadlines?: SpecialDeadlinesConfig | null;
}

/**
 * Modal dedicado aos Palpites de Jogador (artilheiro, craque, goleiro,
 * revelação). Separado dos Palpites Especiais de seleção pra dar um
 * storytelling próprio — "quem brilha" vs "quem avança".
 */
export const PlayerAwardsModal: React.FC<PlayerAwardsModalProps> = ({
  open,
  onOpenChange,
  bolaoId,
  bolaoName,
  matches,
  playerAwardsEnabled,
  playerAwardPoints,
  specialDeadlines,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-2xl max-h-[92vh] overflow-hidden p-0 flex flex-col rounded-rebrand-xl">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-4 shrink-0 border-b border-line bg-white">
          <div className="flex items-start gap-3 pr-7">
            <div className="w-9 h-9 rounded-rebrand-md bg-amber/10 border border-amber/30 flex items-center justify-center text-amber-2 shrink-0">
              <Star className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3 mb-0.5">
                {bolaoName}
              </p>
              <DialogTitle className="font-display text-[20px] sm:text-[22px] font-bold text-ink leading-tight">
                Palpites de jogador
              </DialogTitle>
              <p className="text-[12px] text-ink-2 mt-1 leading-snug">
                Quem vai brilhar na Copa — artilheiro, craque, goleiro e revelação.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto minimal-scrollbar px-5 sm:px-6 py-5">
          <PlayerAwardsSection
            bolaoId={bolaoId}
            enabled={playerAwardsEnabled as Partial<Record<PlayerAwardType, boolean>> | undefined}
            pointsConfig={playerAwardPoints as Partial<Record<PlayerAwardType, number>> | undefined}
            matches={matches}
            specialDeadlines={specialDeadlines}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
