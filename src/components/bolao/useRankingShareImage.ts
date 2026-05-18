import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import { shareImage, shareImageToWhatsApp, downloadImage, SHARE_MESSAGES, type ShareResult } from '@/components/bolao/share-utils';

interface UseRankingShareImageOptions {
  bolaoName: string;
  /** Slug do filename (sem extensão) — ex: "ranking-bolao-da-firma" */
  filenameSlug?: string;
  /** "feed" 1080×1080 (default) | "stories" 1080×1920 */
  variant?: 'feed' | 'stories';
  /**
   * URL do bolão — incluída no texto compartilhado pra WhatsApp.
   * Pode ser tanto o link direto (`/bolao/{id}`) quanto o de convite
   * (`/bolao/entrar/{code}`); ambos resolvem pro bolão.
   */
  bolaoUrl?: string;
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
  const { bolaoName, filenameSlug, variant = 'feed', bolaoUrl } = options;
  const [isSharing, setIsSharing] = useState(false);
  const [lastResult, setLastResult] = useState<ShareResult | null>(null);

  // Ref callback — usuário do hook usa como `ref={captureRef}`
  const [node, setNode] = useState<HTMLElement | null>(null);
  const captureRef = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  /** Captura o nó como PNG blob. Reusado por share e download. */
  const capture = useCallback(async (): Promise<{ blob: Blob; filename: string } | null> => {
    if (!node) return null;
    const canvas = await html2canvas(node, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png', 0.95)
    );
    if (!blob) return null;
    const slug = filenameSlug ?? slugify(bolaoName);
    const filename = `ranking-${slug}${variant === 'stories' ? '-stories' : ''}.png`;
    return { blob, filename };
  }, [node, bolaoName, filenameSlug, variant]);

  /**
   * Compartilha a imagem via Web Share API (mobile abre sheet com a imagem
   * anexada → user escolhe WhatsApp/IG). Desktop faz download direto. Texto
   * inclui o link de convite quando inviteUrl é passado.
   */
  const share = useCallback(async (): Promise<ShareResult> => {
    if (!node) {
      const err: ShareResult = { success: false, method: 'error', error: 'Imagem não está pronta' };
      setLastResult(err);
      return err;
    }
    setIsSharing(true);
    try {
      const captured = await capture();
      if (!captured) {
        const err: ShareResult = { success: false, method: 'error', error: 'Falha ao gerar imagem' };
        setLastResult(err);
        return err;
      }
      const result = await shareImage(captured.blob, {
        filename: captured.filename,
        title: `Ranking ${bolaoName}`,
        text: SHARE_MESSAGES.rankingImage(bolaoName, bolaoUrl),
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
  }, [node, bolaoName, bolaoUrl, capture]);

  /**
   * Variante de share pra botão "WhatsApp" especificamente.
   * Mobile: Web Share API (sheet nativo); Desktop: download + WhatsApp Web.
   * Ver shareImageToWhatsApp() pro racional completo.
   */
  const shareToWhatsApp = useCallback(async (): Promise<ShareResult> => {
    if (!node) {
      const err: ShareResult = { success: false, method: 'error', error: 'Imagem não está pronta' };
      setLastResult(err);
      return err;
    }
    setIsSharing(true);
    try {
      const captured = await capture();
      if (!captured) {
        const err: ShareResult = { success: false, method: 'error', error: 'Falha ao gerar imagem' };
        setLastResult(err);
        return err;
      }
      const result = await shareImageToWhatsApp(captured.blob, {
        filename: captured.filename,
        title: `Ranking ${bolaoName}`,
        text: SHARE_MESSAGES.rankingImage(bolaoName, bolaoUrl),
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
  }, [node, bolaoName, bolaoUrl, capture]);

  /**
   * Download direto do PNG. Não passa por share sheet — só salva o arquivo.
   * Usado pelo botão "Baixar".
   */
  const download = useCallback(async (): Promise<ShareResult> => {
    if (!node) {
      const err: ShareResult = { success: false, method: 'error', error: 'Imagem não está pronta' };
      setLastResult(err);
      return err;
    }
    setIsSharing(true);
    try {
      const captured = await capture();
      if (!captured) {
        const err: ShareResult = { success: false, method: 'error', error: 'Falha ao gerar imagem' };
        setLastResult(err);
        return err;
      }
      const result = await downloadImage(captured.blob, captured.filename);
      setLastResult(result);
      return result;
    } catch (err: any) {
      const errResult: ShareResult = { success: false, method: 'error', error: err?.message ?? 'Erro' };
      setLastResult(errResult);
      return errResult;
    } finally {
      setIsSharing(false);
    }
  }, [node, capture]);

  return { captureRef, share, shareToWhatsApp, download, isSharing, lastResult };
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
