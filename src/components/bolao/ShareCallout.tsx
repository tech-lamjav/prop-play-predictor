import React, { useEffect, useState } from 'react';
import { PartyPopper, Copy, Check, MessageCircle, Send, X } from 'lucide-react';

interface ShareCalloutProps {
  bolaoId: string;
  bolaoName: string;
  inviteCode: string;
}

/**
 * Big "invite friends" call-to-action shown on bolão detail page when
 * the bolão has ≤ 1 member. Dismissible (per-bolão, persisted in
 * localStorage), reappears if user navigates away and back.
 */
export const ShareCallout: React.FC<ShareCalloutProps> = ({ bolaoId, bolaoName, inviteCode }) => {
  const dismissKey = `bolao_share_callout_dismissed_${bolaoId}`;
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Read dismiss state on mount only — clears when user re-navigates here.
  useEffect(() => {
    setDismissed(sessionStorage.getItem(dismissKey) === '1');
  }, [dismissKey]);

  if (dismissed) return null;

  const inviteUrl = `${window.location.origin}/bolao/entrar/${inviteCode}`;
  const shareText = `Participe do bolão "${bolaoName}" da Copa do Mundo 2026!\n${inviteUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Participe do bolão "${bolaoName}" da Copa do Mundo 2026!`)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  return (
    <div className="relative rounded-lg border border-terminal-border bg-terminal-dark-gray/30 p-4 sm:p-5 mb-5">
      <button
        onClick={handleDismiss}
        aria-label="Dispensar aviso de compartilhamento"
        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded text-terminal-text/40 hover:text-terminal-text/80 hover:bg-terminal-gray/30 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 mb-3 pr-8">
        <div className="w-10 h-10 rounded-full bg-terminal-blue/15 border border-terminal-blue/30 flex items-center justify-center shrink-0">
          <PartyPopper className="w-5 h-5 text-terminal-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-bold text-terminal-text">
            Bolão criado! Agora chame os amigos
          </p>
          <p className="text-xs sm:text-sm text-terminal-text/60 mt-0.5">
            Sem competição não tem graça. Mande o link em 1 clique:
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          aria-label="Copiar link de convite do bolão"
          className="flex items-center gap-2 h-11 px-4 rounded-lg border border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue hover:bg-terminal-blue/20 active:bg-terminal-blue/30 font-medium text-sm transition-colors flex-1 sm:flex-none justify-center"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copiar link</span>
            </>
          )}
        </button>
        <button
          onClick={handleWhatsApp}
          aria-label="Compartilhar bolão no WhatsApp"
          className="flex items-center gap-2 h-11 px-4 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 active:bg-[#25D366]/30 font-medium text-sm transition-colors flex-1 sm:flex-none justify-center"
        >
          <MessageCircle className="w-4 h-4" />
          <span>WhatsApp</span>
        </button>
        <button
          onClick={handleTelegram}
          aria-label="Compartilhar bolão no Telegram"
          className="flex items-center gap-2 h-11 px-4 rounded-lg border border-[#229ED9]/40 bg-[#229ED9]/10 text-[#229ED9] hover:bg-[#229ED9]/20 active:bg-[#229ED9]/30 font-medium text-sm transition-colors flex-1 sm:flex-none justify-center"
        >
          <Send className="w-4 h-4" />
          <span>Telegram</span>
        </button>
      </div>

      <p className="text-[11px] opacity-50 mt-3">
        Código: <span className="font-mono font-bold text-terminal-text">{inviteCode}</span>
      </p>
    </div>
  );
};
