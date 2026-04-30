import React, { useEffect, useState } from 'react';
import { Share2, Copy, Check, MoreHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BrandIcon } from '@/components/bolao/BrandIcon';
import { useToast } from '@/hooks/use-toast';
import { SHARE_MESSAGES } from '@/components/bolao/share-utils';

interface BolaoShareButtonProps {
  bolaoName: string;
  inviteCode: string;
  variant?: 'default' | 'icon' | 'compact';
}

/**
 * Botão "Convidar amigos" — abre um Sheet (drawer lateral) com:
 * - Código do bolão em mono grande
 * - Link de convite read-only com Copy
 * - Botões dos canais: WhatsApp / Telegram / Mais (Web Share API)
 * - Texto sugerido editável
 *
 * Acessível em qualquer momento (não só quando faltam membros).
 */
export const BolaoShareButton: React.FC<BolaoShareButtonProps> = ({
  bolaoName,
  inviteCode,
  variant = 'default',
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/bolao/entrar/${inviteCode}`;
  const defaultMessage = SHARE_MESSAGES.invite(bolaoName, inviteCode, inviteUrl);
  const [shareText, setShareText] = useState(defaultMessage);

  // Reset texto editável quando abre o drawer (caso o nome do bolão mude)
  useEffect(() => {
    if (open) setShareText(defaultMessage);
  }, [open, defaultMessage]);

  const copyTo = async (
    text: string,
    setFlag: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      setTimeout(() => setFlag(false), 1800);
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
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
      `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText.replace(inviteUrl, '').trim())}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Bolão ${bolaoName}`,
          text: shareText,
          url: inviteUrl,
        });
      } catch {
        // user cancelou — nada a fazer
      }
    } else {
      // Desktop fallback: copia o texto completo
      await copyTo(shareText, setLinkCopied);
      toast({
        title: 'Texto copiado',
        description: 'Cole onde quiser compartilhar.',
      });
    }
  };

  const trigger =
    variant === 'icon' ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Compartilhar bolão"
        className="h-11 w-11"
      >
        <Share2 className="h-5 w-5" />
      </Button>
    ) : variant === 'compact' ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Compartilhar bolão"
        className="rounded-rebrand-md gap-1.5 text-ink-2 hover:text-ink hover:bg-canvas-2"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Compartilhar</span>
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline-forest"
        className="rounded-rebrand-md gap-2 h-11"
      >
        <Share2 className="w-4 h-4" />
        Convidar amigos
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-[480px] p-0 overflow-hidden rounded-rebrand-xl">
        <div className="px-6 pt-6 pb-4 border-b border-line pr-12">
          <DialogTitle className="font-display text-[22px] font-bold text-ink leading-tight">
            Convidar amigos
          </DialogTitle>
          <DialogDescription className="text-[13px] text-ink-2 mt-1">
            Bolão fica melhor cheio. Compartilha o link com a galera.
          </DialogDescription>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Hero do código */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2 mb-2">
              Código do bolão
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 h-14 rounded-rebrand-md border border-line bg-white flex items-center">
                <span className="font-mono text-[24px] font-bold tabular-nums text-ink tracking-wider">
                  {inviteCode}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyTo(inviteCode, setCodeCopied)}
                className="h-14 w-14 rounded-rebrand-md border border-line bg-white text-ink-2 hover:text-forest hover:border-forest/40 flex items-center justify-center transition-colors shrink-0"
                aria-label="Copiar código"
              >
                {codeCopied ? (
                  <Check className="w-5 h-5 text-status-success" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Link de convite */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2 mb-2">
              Link de convite
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteUrl.replace(/^https?:\/\//, '')}
                className="flex-1 h-11 px-3.5 rounded-rebrand-md border border-line bg-white text-[13px] font-mono text-ink truncate focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyTo(inviteUrl, setLinkCopied)}
                className="h-11 px-4 rounded-rebrand-md border border-line bg-white text-[12px] font-medium text-ink-2 hover:text-forest hover:border-forest/40 inline-flex items-center gap-1.5 transition-colors shrink-0"
                aria-label="Copiar link"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-status-success" />
                    <span className="text-status-success">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Texto sugerido editável */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2 mb-2">
              Mensagem sugerida
            </p>
            <textarea
              value={shareText}
              onChange={(e) => setShareText(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-rebrand-md border border-line bg-white text-[13px] text-ink focus:border-forest focus:ring-2 focus:ring-forest/15 focus:outline-none resize-none"
            />
            <p className="text-[11px] text-ink-3 mt-1">
              Edita se quiser personalizar. Os botões abaixo já enviam esse texto.
            </p>
          </div>

          {/* Canais */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2 mb-3">
              Compartilhar em
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleWhatsApp}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-rebrand-md border border-line bg-white hover:border-forest/40 hover:bg-canvas-2 transition-colors"
                aria-label="Compartilhar via WhatsApp"
              >
                <BrandIcon brand="whatsapp" className="w-7 h-7 text-[#25D366]" />
                <span className="text-[12px] font-medium text-ink">WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={handleTelegram}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-rebrand-md border border-line bg-white hover:border-forest/40 hover:bg-canvas-2 transition-colors"
                aria-label="Compartilhar via Telegram"
              >
                <BrandIcon brand="telegram" className="w-7 h-7 text-[#229ED9]" />
                <span className="text-[12px] font-medium text-ink">Telegram</span>
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-rebrand-md border border-line bg-white hover:border-forest/40 hover:bg-canvas-2 transition-colors"
                aria-label="Mais opções de compartilhamento"
              >
                <MoreHorizontal className="w-7 h-7 text-ink-2" />
                <span className="text-[12px] font-medium text-ink">Mais</span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
