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
 *
 * Estética: forest deep + amber dourado (paleta "Direção A"). Forest escuro
 * dá contraste forte no feed do WhatsApp/Stories sem quebrar a identidade.
 */
export const AchievementShareImage = forwardRef<HTMLDivElement, AchievementShareImageProps>(
  ({ icon: Icon, title, description, bolaoName }, ref) => {
    return (
      <div
        ref={ref}
        className="absolute -left-[9999px] top-0 w-[1080px] h-[1080px] flex flex-col items-center justify-center p-20 overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 50% 35%, rgba(212,160,23,0.20) 0%, transparent 55%), linear-gradient(180deg, #0a3d2e 0%, #0f5238 55%, #0a3d2e 100%)',
          fontFamily: '"Inter", system-ui, sans-serif',
          color: '#f6f7f5',
        }}
      >
        {/* Logo Smart Betting top */}
        <div className="absolute top-12 left-12 flex items-center gap-3">
          <img
            src="/logo-sem-texto.png"
            alt="Smart Betting"
            className="w-12 h-12 object-contain opacity-95"
            crossOrigin="anonymous"
          />
          <span
            className="text-base font-bold uppercase"
            style={{ letterSpacing: '0.2em', lineHeight: 1.5, color: '#f6f7f5', opacity: 0.9 }}
          >
            smartbetting
          </span>
        </div>

        {/* Etiqueta CONQUISTA */}
        <p
          className="text-sm font-bold uppercase mb-4"
          style={{ letterSpacing: '0.5em', lineHeight: 1.6, color: '#d4a017' }}
        >
          Conquista desbloqueada
        </p>

        {/* Ícone gigante */}
        <div
          className="relative mb-8"
          style={{
            filter: 'drop-shadow(0 0 60px rgba(212, 160, 23, 0.55))',
          }}
        >
          <div
            className="w-48 h-48 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #d4a017 0%, #b8870f 100%)',
            }}
          >
            <Icon className="w-24 h-24" strokeWidth={2.5} style={{ color: '#0a3d2e' }} />
          </div>
        </div>

        {/* Título */}
        <h1
          className="text-7xl font-black text-center mb-6 max-w-[900px]"
          style={{
            lineHeight: 1.15,
            paddingBottom: '12px',
            wordBreak: 'break-word',
            color: '#f6f7f5',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h1>

        {/* Descrição */}
        <p
          className="text-3xl font-medium text-center mb-12 max-w-[850px]"
          style={{ lineHeight: 1.4, paddingBottom: '6px', color: '#f6f7f5', opacity: 0.85 }}
        >
          {description}
        </p>

        {/* Bolão context */}
        {bolaoName && (
          <p
            className="text-xl text-center"
            style={{ lineHeight: 1.5, paddingBottom: '4px', color: '#f6f7f5', opacity: 0.7 }}
          >
            no <span className="font-bold" style={{ color: '#d4a017', opacity: 1 }}>{bolaoName}</span>
          </p>
        )}

        {/* Footer URL */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center">
          <p
            className="text-base font-bold"
            style={{
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              lineHeight: 1.5,
              color: '#f6f7f5',
              opacity: 0.7,
            }}
          >
            smartbetting.app/bolao
          </p>
        </div>
      </div>
    );
  }
);

AchievementShareImage.displayName = 'AchievementShareImage';
