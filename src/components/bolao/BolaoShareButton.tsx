import React, { useState, useRef, useEffect } from 'react';
import { Share2, Copy, Check, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BolaoShareButtonProps {
  bolaoName: string;
  inviteCode: string;
  variant?: 'default' | 'icon' | 'compact';
}

export const BolaoShareButton: React.FC<BolaoShareButtonProps> = ({
  bolaoName,
  inviteCode,
  variant = 'default',
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const inviteUrl = `${window.location.origin}/bolao/entrar/${inviteCode}`;
  const shareText = `Participe do bolão "${bolaoName}" da Copa do Mundo 2026!\n${inviteUrl}`;

  // Close on outside click + ESC
  useEffect(() => {
    if (!open) return;
    const clickHandler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', clickHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

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
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1800);
  };

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      '_blank',
      'noopener,noreferrer'
    );
    setOpen(false);
  };

  const handleTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Participe do bolão "${bolaoName}" da Copa do Mundo 2026!`)}`,
      '_blank',
      'noopener,noreferrer'
    );
    setOpen(false);
  };

  const trigger =
    variant === 'icon' ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Compartilhar bolão"
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-11 w-11 text-terminal-text hover:text-terminal-blue"
      >
        <Share2 className="h-5 w-5" />
      </Button>
    ) : variant === 'compact' ? (
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-label="Compartilhar bolão"
        aria-expanded={open}
        aria-haspopup="menu"
        className="gap-1.5 text-xs opacity-70 hover:opacity-100 h-11 px-3"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Compartilhar</span>
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="border-terminal-green/50 text-terminal-green hover:bg-terminal-green/10 gap-2 h-11"
      >
        <Share2 className="w-4 h-4" />
        Convidar amigos
      </Button>
    );

  return (
    <div ref={ref} className="relative inline-block">
      {trigger}

      {open && (
        <div role="menu" aria-label="Opções de compartilhamento" className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-terminal-border bg-terminal-dark-gray shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-terminal-border-subtle">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-50">
              Convidar para o bolão
            </p>
            <p className="text-xs font-mono text-terminal-blue mt-0.5 truncate">{inviteUrl}</p>
          </div>

          {/* Actions */}
          <div className="p-2 flex flex-col gap-1">
            {/* Copy link */}
            <button
              role="menuitem"
              onClick={handleCopy}
              aria-label="Copiar link do convite"
              className="flex items-center gap-3 px-3 py-2.5 min-h-11 rounded hover:bg-terminal-gray/40 focus:bg-terminal-gray/40 focus:outline-none transition-colors w-full text-left"
            >
              <div className="w-8 h-8 rounded bg-terminal-gray/40 flex items-center justify-center shrink-0">
                {copied ? (
                  <Check className="w-4 h-4 text-terminal-green" />
                ) : (
                  <Copy className="w-4 h-4 text-terminal-text" />
                )}
              </div>
              <span className="text-sm font-medium">
                {copied ? 'Copiado!' : 'Copiar link'}
              </span>
            </button>

            {/* WhatsApp */}
            <button
              role="menuitem"
              onClick={handleWhatsApp}
              aria-label="Compartilhar via WhatsApp"
              className="flex items-center gap-3 px-3 py-2.5 min-h-11 rounded hover:bg-terminal-gray/40 focus:bg-terminal-gray/40 focus:outline-none transition-colors w-full text-left"
            >
              <div className="w-8 h-8 rounded bg-[#25D366]/10 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </div>
              <span className="text-sm font-medium">WhatsApp</span>
            </button>

            {/* Telegram */}
            <button
              role="menuitem"
              onClick={handleTelegram}
              aria-label="Compartilhar via Telegram"
              className="flex items-center gap-3 px-3 py-2.5 min-h-11 rounded hover:bg-terminal-gray/40 focus:bg-terminal-gray/40 focus:outline-none transition-colors w-full text-left"
            >
              <div className="w-8 h-8 rounded bg-[#229ED9]/10 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-[#229ED9]" />
              </div>
              <span className="text-sm font-medium">Telegram</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
