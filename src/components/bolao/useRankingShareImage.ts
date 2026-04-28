import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import { shareImage, SHARE_MESSAGES, type ShareResult } from '@/components/bolao/share-utils';

interface UseRankingShareImageOptions {
  bolaoName: string;
  /** Slug do filename (sem extensão) — ex: "ranking-bolao-da-firma" */
  filenameSlug?: string;
}

/**
 * Hook que captura um nó React (passado via ref retornado) com html2canvas,
 * gera PNG e dispara compartilhamento (mobile share OU clipboard desktop).
 *
 * Uso:
 *   const { captureRef, share, isSharing } = useRankingShareImage({ bolaoName });
 *   ...
 *   <RankingShareImage ref={captureRef} ... />
 *   <button onClick={share}>Compartilhar imagem</button>
 */
export function useRankingShareImage(options: UseRankingShareImageOptions) {
  const { bolaoName, filenameSlug } = options;
  const [isSharing, setIsSharing] = useState(false);
  const [lastResult, setLastResult] = useState<ShareResult | null>(null);

  // Ref callback — usuário do hook usa como `ref={captureRef}`
  const [node, setNode] = useState<HTMLElement | null>(null);
  const captureRef = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  const share = useCallback(async (): Promise<ShareResult> => {
    if (!node) {
      const err: ShareResult = { success: false, method: 'error', error: 'Imagem não está pronta' };
      setLastResult(err);
      return err;
    }

    setIsSharing(true);
    try {
      // html2canvas: tira screenshot do nó. scale 2 = retina-ish.
      // backgroundColor null → respeita o background do próprio elemento.
      const canvas = await html2canvas(node, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const blob: Blob | null = await new Promise(resolve =>
        canvas.toBlob(b => resolve(b), 'image/png', 0.95)
      );

      if (!blob) {
        const err: ShareResult = { success: false, method: 'error', error: 'Falha ao gerar imagem' };
        setLastResult(err);
        return err;
      }

      const slug = filenameSlug ?? slugify(bolaoName);
      const filename = `ranking-${slug}.png`;

      const result = await shareImage(blob, {
        filename,
        title: `Ranking ${bolaoName}`,
        text: SHARE_MESSAGES.rankingImage(bolaoName),
      });
      setLastResult(result);
      return result;
    } catch (err: any) {
      const errResult: ShareResult = { success: false, method: 'error', error: err?.message ?? 'Erro' };
      setLastResult(errResult);
      return errResult;
    } finally {
      setIsSharing(false);
    }
  }, [node, bolaoName, filenameSlug]);

  return { captureRef, share, isSharing, lastResult };
}

/** Slug simples: "Bolão da Firma!" → "bolao-da-firma" */
function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
