// ============================================================
// config.ts — env e constantes do bot
// ============================================================
// Extraído de index.ts na Onda 6b da revisão (split mecânico, move-only).
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")
const OPENAI_API_URL = "https://api.openai.com/v1"
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")

const TELEGRAM_API_BASE = TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
  : ""

const DAILY_BET_LIMIT = 3
const TIMEZONE_GMT3 = "America/Cuiaba"
const BETS_DASHBOARD_URL = "https://www.smartbetting.app/bets"

export {
  OPENAI_API_KEY, OPENAI_API_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
  TELEGRAM_API_BASE, DAILY_BET_LIMIT, TIMEZONE_GMT3, BETS_DASHBOARD_URL,
}
