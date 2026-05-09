/**
 * Helpers de compartilhamento (texto + imagem) com fallback gracioso.
 *
 * Estratégia:
 *  - Mobile com Web Share API + files: usa o sheet native (WhatsApp, Telegram,
 *    Instagram, etc) com a imagem já anexada
 *  - Desktop com Clipboard API: copia a imagem PNG → user cola no chat e
 *    a imagem aparece direto
 *  - Fallback: download do PNG (Firefox sem clipboard, browsers antigos)
 */

export interface ShareResult {
  success: boolean;
  method: 'native-share' | 'clipboard' | 'download' | 'error';
  error?: string;
}

/**
 * Verifica se o browser suporta Web Share API com arquivos.
 * Usado pra decidir se mostra "Compartilhar" (mobile) ou "Copiar imagem" (desktop).
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!('share' in navigator) || !('canShare' in navigator)) return false;
  // Cria um blob de teste — não chama share, só checa capabilities
  try {
    const testFile = new File(['test'], 'test.png', { type: 'image/png' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * Compartilha uma imagem (PNG blob).
 *
 * Comportamento por plataforma:
 *  - Mobile com Web Share API: abre sheet native (WhatsApp/Telegram/Instagram)
 *    com a imagem anexada. Cola direto no chat.
 *  - Desktop: DOWNLOAD direto. Razão: clipboard.write em desktop é
 *    pouco confiável pra colar em WhatsApp Web (depende de permissão e
 *    o WhatsApp Web às vezes não detecta como imagem). Download é 100%
 *    confiável: user arrasta o arquivo na conversa OU usa anexo.
 */
export async function shareImage(
  blob: Blob,
  options: { filename: string; title?: string; text?: string }
): Promise<ShareResult> {
  const { filename, title, text } = options;
  // Garante que o blob tem o tipo certo
  const typedBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
  const file = new File([typedBlob], filename, { type: 'image/png' });

  // 1. Mobile: Web Share API (sheet native com a imagem anexa)
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [file], title, text });
      return { success: true, method: 'native-share' };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { success: false, method: 'error', error: 'Cancelado' };
      // Caiu por outro motivo → fallback download
    }
  }

  // 2. Desktop / fallback: download direto
  // Mais confiável que clipboard.write pra colar em WhatsApp Web (que tem
  // detecção inconsistente). User arrasta o PNG na conversa.
  try {
    const url = URL.createObjectURL(typedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, method: 'download' };
  } catch (err: any) {
    return { success: false, method: 'error', error: err?.message ?? 'Erro ao salvar imagem' };
  }
}

/**
 * Compartilha apenas texto + URL via Web Share API (mobile) ou
 * abre WhatsApp Web direto no desktop.
 */
export async function shareTextOrLink(options: {
  title?: string;
  text: string;
  url?: string;
}): Promise<ShareResult> {
  const { title, text, url } = options;

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title, text, url });
      return { success: true, method: 'native-share' };
    } catch (err: any) {
      if (err?.name === 'AbortError') return { success: false, method: 'error', error: 'Cancelado' };
    }
  }

  // Fallback: abre WhatsApp Web com texto pré-formatado
  const message = url ? `${text}\n${url}` : text;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  return { success: true, method: 'native-share' };
}

/**
 * Salva uma imagem (PNG blob) como download direto, sem passar por sheet
 * de compartilhamento. Usado pelo botão "Baixar".
 */
export async function downloadImage(blob: Blob, filename: string): Promise<ShareResult> {
  try {
    const typedBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
    const url = URL.createObjectURL(typedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, method: 'download' };
  } catch (err: any) {
    return { success: false, method: 'error', error: err?.message ?? 'Erro ao salvar imagem' };
  }
}

/**
 * Mensagens contextuais por situação. Usadas pra o WhatsApp link
 * adaptar ao contexto (criar vs convidar vs ranking).
 */
export const SHARE_MESSAGES = {
  // Mensagem genérica sem nome do bolão pra evitar repetição (ex: "bolão
  // Bolão da firma" caso o user tenha posto "bolão" no próprio nome).
  invite: (_bolaoName: string, inviteCode: string, inviteUrl: string) =>
    `Pra entrar no bolão da Copa 2026:\n${inviteUrl}\n\nCódigo: ${inviteCode}`,

  rankingPosition: (bolaoName: string, rank: number, totalMembers: number, points: number) =>
    rank === 1
      ? `Tô em 1º no bolão "${bolaoName}" com ${points} pts! 🏆`
      : rank <= 3
        ? `Tô no top ${rank} do bolão "${bolaoName}" — ${points} pts. Vem disputar!`
        : `Tô em ${rank}º de ${totalMembers} no bolão "${bolaoName}". Vem participar!`,

  /**
   * Texto da imagem do ranking compartilhada via WhatsApp.
   * "Vem acompanhar" porque o bolão já tá rolando — convite a olhar o
   * andamento. Link aponta direto pro bolão (não pro convite/entrar).
   */
  rankingImage: (bolaoName: string, bolaoUrl?: string) =>
    bolaoUrl
      ? `Olha como tá o ranking do bolão "${bolaoName}" 👀\n\nVem acompanhar: ${bolaoUrl}`
      : `Olha como tá o ranking do bolão "${bolaoName}" 👀`,
};
