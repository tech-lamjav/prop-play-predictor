import React, { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';

interface AchievementShareImageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  bolaoName?: string;
}

/**
 * Card 1080×1080 capturável pra compartilhar uma conquista desbloqueada.
 * Renderizado off-screen, capturado via html2canvas.
 */
export const AchievementShareImage = forwardRef<HTMLDivElement, AchievementShareImageProps>(
  ({ icon: Icon, title, description, bolaoName }, ref) => {
    return (
      <div
        ref={ref}
        className="absolute -left-[9999px] top-0 w-[1080px] h-[1080px] flex flex-col items-center justify-center p-20 overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 50% 35%, rgba(250,204,21,0.18) 0%, transparent 60%), linear-gradient(180deg, #050a14 0%, #0f1a2e 50%, #0a1628 100%)',
          fontFamily: '"Inter", system-ui, sans-serif',
          color: '#e8eef0',
        }}
      >
        {/* Logo Smart Betting top */}
        <div className="absolute top-12 left-12 flex items-center gap-3">
          <img
            src="/logo-sem-texto.png"
            alt="Smart Betting"
            className="w-12 h-12 object-contain opacity-90"
            crossOrigin="anonymous"
          />
          <span
            className="text-base font-bold uppercase opacity-80"
            style={{ letterSpacing: '0.2em', lineHeight: 1.5 }}
          >
            smartbetting
          </span>
        </div>

        {/* Etiqueta CONQUISTA */}
        <p
          className="text-sm font-bold uppercase text-yellow-400 mb-4"
          style={{ letterSpacing: '0.5em', lineHeight: 1.6 }}
        >
          Conquista desbloqueada
        </p>

        {/* Ícone gigante */}
        <div
          className="relative mb-8"
          style={{
            filter: 'drop-shadow(0 0 60px rgba(250, 204, 21, 0.5))',
          }}
        >
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 flex items-center justify-center">
            <Icon className="w-24 h-24 text-terminal-bg" strokeWidth={2.5} />
          </div>
        </div>

        {/* Título */}
        <h1
          className="text-7xl font-black text-center mb-6 max-w-[900px]"
          style={{
            lineHeight: 1.15,
            paddingBottom: '12px',
            wordBreak: 'break-word',
          }}
        >
          {title}
        </h1>

        {/* Descrição */}
        <p
          className="text-3xl font-medium text-center opacity-80 mb-12 max-w-[850px]"
          style={{ lineHeight: 1.4, paddingBottom: '6px' }}
        >
          {description}
        </p>

        {/* Bolão context */}
        {bolaoName && (
          <p
            className="text-xl opacity-60 text-center"
            style={{ lineHeight: 1.5, paddingBottom: '4px' }}
          >
            no <span className="font-bold text-terminal-text">{bolaoName}</span>
          </p>
        )}

        {/* Footer URL */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center">
          <p
            className="text-base font-bold opacity-70"
            style={{ fontFamily: 'monospace', letterSpacing: '0.1em', lineHeight: 1.5 }}
          >
            smartbetting.app/bolao
          </p>
        </div>
      </div>
    );
  }
);

AchievementShareImage.displayName = 'AchievementShareImage';
