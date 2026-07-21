// ============================================================
// types.ts — interfaces do Telegram e da extração
// ============================================================
// Extraído de index.ts na Onda 6b da revisão (split mecânico, move-only).
interface TelegramFile {
  file_id: string
  file_unique_id: string
  file_size?: number
  file_path?: string
  mime_type?: string
}

interface TelegramUser {
  id: number
  is_bot: boolean
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  phone_number?: string
}

interface TelegramMessage {
  message_id: number
  date: number
  chat: { id: number; type: string; title?: string; username?: string; first_name?: string; last_name?: string }
  from?: TelegramUser
  text?: string
  caption?: string
  contact?: { phone_number: string; user_id?: number }
  photo?: TelegramFile[]
  voice?: TelegramFile
  audio?: TelegramFile
  document?: TelegramFile
  // Telegram sends thumbnails as "thumbnail" in documents; not used directly
  thumbnail?: TelegramFile
  // resposta a uma mensagem do bot (force_reply do "Outro valor")
  reply_to_message?: { message_id: number }
}

// Toque num botão inline (lembrete de liquidação do notify-settlement)
interface TelegramCallbackQuery {
  id: string
  from?: TelegramUser
  message?: { message_id: number; chat: { id: number } }
  data?: string
}

interface ProcessedBet {
  bet_type: string
  sport: string
  league?: string
  betting_market?: string
  matches: Array<{
    description: string
    bet_description: string
    odds: number
    match_date?: string
    is_combined_odd?: boolean
  }>
  stake_amount: number
  bet_date: string
  odds_are_individual?: boolean
}


export type { TelegramFile, TelegramUser, TelegramMessage, TelegramCallbackQuery, ProcessedBet }
