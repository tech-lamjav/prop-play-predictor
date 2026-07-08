import React, { useEffect, useRef } from 'react';
import { usePostHog } from '@posthog/react';
import { ClipboardList, ArrowRight, Trophy, LineChart } from 'lucide-react';

interface BolaoHandoffCardProps {
  bolaoId: string;
  bolaoName: string;
  /** Posição final do usuário no ranking (null = não pontuou / não está no ranking) */
  myRank: number | null;
  totalPlayers: number;
}

/**
 * Cartão de encerramento — a "passagem de bastão" do dia da final (H1).
 * Aparece na aba Ranking APENAS quando a final da Copa está encerrada
 * (ou com ?handoff na URL, pra preview). O bolão morre por natureza no
 * dia 19/jul; este cartão é a última conversa com essa audiência:
 * casual → Betinho, apostador frequente → lista do futebol.
 *
 * Rotas de destino: /betinho/bolao (LP variante do bolão, já existe) e
 * /futebol/comecar (LP de acesso antecipado — entra com o PR #188).
 */
export const BolaoHandoffCard: React.FC<BolaoHandoffCardProps> = ({
  bolaoId,
  bolaoName,
  myRank,
  totalPlayers,
}) => {
  const posthog = usePostHog();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    posthog?.capture('bolao_handoff_view', {
      bolao_id: bolaoId,
      rank: myRank,
      total_players: totalPlayers,
    });
  }, [posthog, bolaoId, myRank, totalPlayers]);

  const handleClick = (destination: 'betinho' | 'futebol') => {
    posthog?.capture('bolao_handoff_click', {
      bolao_id: bolaoId,
      destination,
      rank: myRank,
    });
  };

  const isChampion = myRank === 1 && totalPlayers > 1;
  const headline = isChampion
    ? `Campeão do ${bolaoName}! 🏆`
    : myRank != null
      ? `Você fechou em ${myRank}º de ${totalPlayers}`
      : 'O bolão chegou ao fim';

  return (
    <div
      data-testid="bolao-handoff-card"
      className="relative overflow-hidden rounded-rebrand-xl bg-forest text-white mb-5"
    >
      {/* brilho âmbar no canto — mesmo tratamento do hero das LPs */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(212,160,23,0.20),transparent_55%)] pointer-events-none" />
      <div className="relative p-5 sm:p-7">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber mb-2.5 flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" />
          Bolão encerrado
        </p>
        <h3 className="font-display text-xl sm:text-2xl font-black leading-tight mb-2">
          {headline}
        </h3>
        <p className="text-[13.5px] sm:text-[14px] text-white/75 leading-relaxed mb-5 max-w-xl">
          A Copa acabou e o bolão termina aqui, valeu demais!
          Mas se você aposta de verdade, o jogo continua:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* trilho casual → Betinho */}
          <div className="rounded-rebrand-lg border border-white/15 bg-white/[0.05] p-4 flex flex-col">
            <p className="font-bold text-[14px] mb-1.5 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber shrink-0" />
              Tá no lucro ou no prejuízo?
            </p>
            <p className="text-[12.5px] text-white/70 leading-relaxed mb-3.5 flex-1">
              A maioria não sabe. Manda o print da aposta no Telegram e o Betinho
              te responde: lucro, ROI e onde você acerta — sem planilha.
            </p>
            <a
              href="/betinho/bolao"
              onClick={() => handleClick('betinho')}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[13px] shadow-md transition-colors"
            >
              Conhecer o Betinho — grátis
              <ArrowRight className="w-4 h-4 shrink-0" />
            </a>
          </div>
          {/* trilho frequente → Futebol */}
          <div className="rounded-rebrand-lg border border-white/15 bg-white/[0.05] p-4 flex flex-col">
            <p className="font-bold text-[14px] mb-1.5 flex items-center gap-2">
              <LineChart className="w-4 h-4 text-amber shrink-0" />
              Onde vale apostar na próxima rodada?
            </p>
            <p className="text-[12.5px] text-white/70 leading-relaxed mb-3.5 flex-1">
              A análise de futebol te mostra: as principais oportunidades de cada
              jogo, com os prós e contras de cada aposta — sem achismo.
            </p>
            <a
              href="/futebol/comecar"
              onClick={() => handleClick('futebol')}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-rebrand-md border border-white/30 bg-white/[0.06] text-white hover:bg-white/15 font-bold text-[13px] transition-colors"
            >
              Conhecer a análise de futebol
              <ArrowRight className="w-4 h-4 shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
