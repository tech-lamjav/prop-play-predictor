// ============================================================
// telegram-api.ts — chamadas e mensagens padrão do bot
// ============================================================
// Extraído de index.ts na Onda 6b da revisão (split mecânico, move-only).
import { TELEGRAM_BOT_TOKEN, TELEGRAM_API_BASE, DAILY_BET_LIMIT, BETS_DASHBOARD_URL } from "./config.ts"
import type { TelegramFile } from "./types.ts"

async function telegramCall<T = any>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  if (!TELEGRAM_API_BASE) {
    console.error("Missing TELEGRAM_BOT_TOKEN")
    return null
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Telegram API error ${method}: ${response.status} - ${errorText}`)
    return null
  }

  return await response.json()
}

async function sendTelegramMessage(chatId: string | number, text: string, options: Record<string, unknown> = {}): Promise<void> {
  await telegramCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...options
  })
}

async function sendTelegramPhoto(chatId: string | number, photoUrl: string, caption?: string): Promise<void> {
  await telegramCall("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: "Markdown"
  })
}

async function getTelegramFileUrl(fileId: string): Promise<string | null> {
  if (!TELEGRAM_API_BASE) return null
  const getFile = await telegramCall<{ result?: TelegramFile }>("getFile", { file_id: fileId })
  const filePath = getFile?.result?.file_path
  if (!filePath) return null
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`
}

async function sendContactRequest(chatId: string | number): Promise<void> {
  const keyboard = {
    keyboard: [[{ text: "📲 Enviar meu número", request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true
  }

  const text = [
    "Para continuar, preciso confirmar seu telefone e vincular sua conta.",
    "Toque em *Enviar meu número* abaixo para compartilhar seu contato."
  ].join("\n")

  await sendTelegramMessage(chatId, text, { reply_markup: keyboard })
}

// Welcome em 2 mensagens (onboarding redesign): (1) valor em 3 linhas,
// (2) pedido explícito da 1ª aposta com exemplo copiável — o momento-aha
// é registrar a primeira aposta em <5 min do cadastro.
async function sendWelcomeMessageTelegram(chatId: string | number, userName?: string): Promise<void> {
  const welcome = [
    `✅ *Conectado${userName ? `, ${userName}` : ""}!* Eu sou o Betinho.`,
    "",
    "A partir de agora, por aqui você:",
    "📸 registra apostas por print, texto ou áudio",
    "📊 acompanha seu ROI real, liquidação e banca",
    "📬 recebe as oportunidades do dia e avisos"
  ].join("\n")

  const firstBetAsk = [
    "*Bora registrar sua primeira aposta?*",
    "",
    "Manda um print da aposta (1 por print — se faltar o valor, escreve na mesma mensagem), ou copia e adapta:",
    "",
    "`Flamengo x Palmeiras - Flamengo vence - Odd 1.85 - R$ 50`"
  ].join("\n")

  await sendTelegramMessage(chatId, welcome)
  await sendTelegramMessage(chatId, firstBetAsk)
}

async function sendHelpMessageTelegram(chatId: string | number): Promise<void> {
  const helpMessage = [
    "🏀 *COMO ENVIAR SUAS APOSTAS:*",
    "",
    "*📸 Screenshot da aposta:*",
    "• 1 aposta por print",
    "• Se faltar algo (valor), escreva junto",
    "• Exemplo: [IMAGEM] + \"100 reais\"",
    "",
    "*✍️ Texto:*",
    "`Lakers vs Warriors - LeBron 25+ pontos - Odd 1.85 - R$ 50`",
    "",
    "⚠️ *IMPORTANTE:*",
    "• 1 mensagem = 1 aposta",
    "• Envie tudo junto (imagem + texto)",
    "• Se não recebeu confirmação, reenvie a imagem"
  ].join("\n")

  await sendTelegramMessage(chatId, helpMessage)
}

async function sendPaywallMessageTelegram(chatId: string | number): Promise<void> {
  const paywallUrl = "https://www.smartbetting.app/planos"
  const paywallMessage = [
    "🚫 *Limite Diário Atingido!*",
    "",
    `Você atingiu o limite de ${DAILY_BET_LIMIT} apostas grátis por dia.`,
    "",
    "Para continuar apostando, acesse:",
    paywallUrl
  ].join("\n")

  await sendTelegramMessage(chatId, paywallMessage)
}

async function sendConfirmationMessageTelegram(
  chatId: string | number,
  betDetails: {
    bet_type: string
    sport: string
    league?: string | null
    match_description: string
    bet_description: string
    odds: number
    stake_amount: number
    potential_return: number
  },
  streakLine?: string | null // item 18: linha de milestone da sequência (flag-gated)
): Promise<void> {
  const betTypeText: Record<string, string> = {
    single: "Simples",
    multiple: "Múltipla",
    system: "Sistema"
  }

  const dashboardUrl = "https://www.smartbetting.app/bets"

  const confirmationMessage = [
    "🎯 *Aposta Registrada com Sucesso!*",
    "",
    "📊 *Detalhes da Aposta:*",
    `• *Tipo:* ${betTypeText[betDetails.bet_type] || betDetails.bet_type}`,
    `• *Esporte:* ${betDetails.sport}${betDetails.league ? ` (${betDetails.league})` : ""}`,
    `• *Jogo:* ${betDetails.match_description}`,
    `• *Aposta:* ${betDetails.bet_description}`,
    `• *Odds:* ${betDetails.odds}`,
    `• *Valor:* R$ ${betDetails.stake_amount.toFixed(2)}`,
    `• *Retorno Potencial:* R$ ${betDetails.potential_return.toFixed(2)}`,
    ...(streakLine ? ["", streakLine] : []),
    "",
    "✅ Sua aposta foi salva no dashboard e você pode acompanhar o resultado em tempo real!",
    "",
    `🔗 Acesse seu dashboard: ${dashboardUrl}`,
    "",
    "⚠️ *IMPORTANTE:*",
    "Se você enviou uma imagem de aposta e não recebeu esta mensagem, envie a imagem novamente."
  ].join("\n")

  await sendTelegramMessage(chatId, confirmationMessage)
}

// ============================================================
// Liquidação por botão — [✅ Green] [❌ Red] do lembrete (notify-settlement)
// ============================================================

// Escapa HTML (os lembretes e suas edições usam parse_mode HTML)
function escHtml(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

const formatBRL = (v: number) => `R$ ${Number(v ?? 0).toFixed(2).replace(".", ",")}`

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await telegramCall("answerCallbackQuery", { callback_query_id: callbackQueryId, text })
}

// Reescreve a mensagem do lembrete como recibo da liquidação (some o teclado)
async function editSettledMessage(chatId: string | number, messageId: number, html: string): Promise<void> {
  await telegramCall("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true
  })
}

function settledHtml(bet: any, status: string): string {
  const jogo = bet.match_description ? `\n${escHtml(bet.match_description)}` : ""
  const base = `<b>${escHtml(bet.bet_description)}</b>${jogo}`
  if (status === "won") {
    const lucro = (bet.potential_return ?? 0) - (bet.stake_amount ?? 0)
    return `✅ <b>Green registrado!</b>\n\n${base}\nLucro: +${formatBRL(lucro)}\n\nBanca atualizada 📊 ${BETS_DASHBOARD_URL}`
  }
  if (status === "lost") {
    return `❌ <b>Red registrado.</b>\n\n${base}\nPrejuízo: −${formatBRL(bet.stake_amount)}\n\nFaz parte. Banca atualizada 📊 ${BETS_DASHBOARD_URL}`
  }
  return `Registrada como <b>${escHtml(status)}</b>.\n\n${base}`
}

export {
  telegramCall, sendTelegramMessage, sendTelegramPhoto, getTelegramFileUrl,
  sendContactRequest, sendWelcomeMessageTelegram, sendHelpMessageTelegram,
  sendPaywallMessageTelegram, sendConfirmationMessageTelegram,
  escHtml, formatBRL, answerCallbackQuery, editSettledMessage, settledHtml,
}
