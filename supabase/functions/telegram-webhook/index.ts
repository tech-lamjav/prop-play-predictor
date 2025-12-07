import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { normalizePhoneNumber, normalizePhoneCandidates, maskPhone } from "../shared/phone.ts"
import { generateTraceId, identifyUser, trackEvent, trackLLMGeneration } from "../shared/posthog.ts"

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")
const OPENAI_API_URL = "https://api.openai.com/v1"
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")

const TELEGRAM_API_BASE = TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
  : ""

const DAILY_BET_LIMIT = 3
const TIMEZONE_GMT3 = "America/Cuiaba"

// Simple in-memory guard to avoid reprocessing the same update_id on retries
const processedUpdateIds = new Set<number>()

interface TelegramFile {
  file_id: string
  file_unique_id: string
  file_size?: number
  file_path?: string
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
}

interface ProcessedBet {
  bet_type: string
  sport: string
  league?: string
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

// JSON Schema for structured outputs (parity with WhatsApp)
const BETTING_INFO_SCHEMA = {
  type: "object",
  properties: {
    bet_type: { type: "string", enum: ["single", "multiple", "system"] },
    sport: { type: "string" },
    league: { type: ["string", "null"] },
    matches: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["description", "bet_description", "odds", "match_date", "is_combined_odd"],
        properties: {
          description: { type: "string" },
          bet_description: { type: "string" },
          odds: { type: "number", minimum: 1.01 },
          match_date: { type: ["string", "null"] },
          is_combined_odd: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    stake_amount: { type: "number", minimum: 0 },
    bet_date: { type: "string" },
    odds_are_individual: { type: "boolean" }
  },
  required: ["bet_type", "sport", "matches", "stake_amount", "bet_date", "odds_are_individual", "league"],
  additionalProperties: false
}

// Calculator tool definition (parity with WhatsApp)
const CALCULATE_ODDS_TOOL = {
  type: "function",
  function: {
    name: "calculate_multiple_odds",
    description: "Calculate the combined odds for multiple bets by multiplying individual odds together. Use this tool when you need to verify or calculate odds for a multiple bet, especially when uncertain about whether odds are individual or already combined.",
    parameters: {
      type: "object",
      properties: {
        odds: { type: "array", items: { type: "number" }, description: "Array of individual odds to multiply together" }
      },
      required: ["odds"]
    }
  }
}

// Calculator function implementation
async function calculateMultipleOdds(odds: number[]): Promise<number> {
  if (!odds || odds.length === 0) return 1
  const result = odds.reduce((acc, odd) => {
    if (odd < 1.01) return acc * 1.01
    return acc * odd
  }, 1)
  return Math.round(result * 100) / 100
}

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

async function sendWelcomeMessageTelegram(chatId: string | number, userName?: string): Promise<void> {
  const welcomeMessage = [
    `👋 *Bem-vindo${userName ? `, ${userName}` : ""} ao Smartbetting!*`,
    "",
    "Sua conta Telegram foi sincronizada com sucesso! 🎉",
    "",
    "*📸 MELHOR FORMA - Screenshot da aposta:*",
    "• Tire print da sua aposta (1 aposta por print)",
    "• Envie a imagem aqui",
    "• Se faltar alguma info (como valor), escreva na mesma mensagem",
    "• Exemplo: [IMAGEM] + \"100 reais\"",
    "",
    "*✍️ OU escreva algo como:*",
    "`Lakers vs Warriors - LeBron 25+ pontos - Odd 1.85 - R$ 50`",
    "",
    "⚠️ *IMPORTANTE:*",
    "• 1 mensagem = 1 aposta",
    "• Envie TUDO junto (imagem + texto na mesma mensagem)",
    "• Se você enviou uma imagem e não recebeu confirmação, envie novamente",
    "",
    "Vamos começar! Envie sua primeira aposta! 🚀"
  ].join("\n")

  await sendTelegramMessage(chatId, welcomeMessage)
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
  const paywallUrl = "https://smartbetting.app/paywall"
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
  }
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

async function getDailyBetCount(supabase: any, userId: string): Promise<number> {
  try {
    const nowUTC = new Date()
    const gmt3Offset = -3 * 60 * 60 * 1000
    const nowGMT3 = new Date(nowUTC.getTime() + gmt3Offset)

    const year = nowGMT3.getUTCFullYear()
    const month = String(nowGMT3.getUTCMonth() + 1).padStart(2, "0")
    const day = String(nowGMT3.getUTCDate()).padStart(2, "0")
    const gmt3DateString = `${year}-${month}-${day}`

    const startOfDayUTC = new Date(`${gmt3DateString}T03:00:00.000Z`)

    const tomorrowGMT3 = new Date(nowGMT3.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowYear = tomorrowGMT3.getUTCFullYear()
    const tomorrowMonth = String(tomorrowGMT3.getUTCMonth() + 1).padStart(2, "0")
    const tomorrowDay = String(tomorrowGMT3.getUTCDate()).padStart(2, "0")
    const gmt3TomorrowDateString = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`
    const startOfTomorrowUTC = new Date(`${gmt3TomorrowDateString}T03:00:00.000Z`)

    const { count, error } = await supabase
      .from("bets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("bet_date", startOfDayUTC.toISOString())
      .lt("bet_date", startOfTomorrowUTC.toISOString())

    if (error) {
      console.error("Error counting daily bets:", error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error("Error getting daily bet count:", error)
    return 0
  }
}

async function hasReachedDailyLimit(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("subscription_status")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("Error fetching user subscription status:", userError)
      return false
    }

    if (user?.subscription_status === "premium") {
      return false
    }

    const betCount = await getDailyBetCount(supabase, userId)
    return betCount >= DAILY_BET_LIMIT
  } catch (error) {
    console.error("Error checking daily limit:", error)
    return false
  }
}

async function transcribeAudio(audioUrl: string, userId: string, traceId: string): Promise<string> {
  const startTime = Date.now()

  try {
    const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file: audioUrl,
        model: "whisper-1",
        language: "pt"
      })
    })

    const latency = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      await trackEvent(
        "openai_api_error",
        { error_type: "transcribe_audio_error", error_message: errorText.substring(0, 500), model: "whisper-1", operation: "transcribe_audio", channel: "telegram" },
        userId,
        traceId
      ).catch(() => {})
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    const estimatedUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    await trackLLMGeneration(
      "transcribe_audio",
      "whisper-1",
      [{ role: "user", content: audioUrl }],
      { choices: [{ message: { content: result.text } }] },
      estimatedUsage,
      latency,
      userId,
      traceId,
      { channel: "telegram" }
    ).catch(() => {})

    return result.text
  } catch (error) {
    await trackEvent(
      "processing_error",
      { error_type: "transcribe_audio_error", error_message: error.message?.substring(0, 500), operation: "transcribe_audio", channel: "telegram" },
      userId,
      traceId
    ).catch(() => {})
    throw new Error(`Failed to transcribe audio: ${error.message}`)
  }
}

async function processImage(imageUrl: string, userId: string, traceId: string): Promise<string> {
  const startTime = Date.now()

  try {
    const messages = [{
      role: "user" as const,
      content: [
        {
          type: "text",
          text: `Analise esta imagem de aposta esportiva e extraia TODAS as informações possíveis em português.

CRÍTICO - Reconhecer Múltiplas Seções de Apostas Múltiplas:
- Se a imagem mostrar VÁRIAS seções de "CRIAR APOSTA" ou múltiplas apostas COM SUAS PRÓPRIAS ODDS COMBINADAS (ex: uma seção mostra "1.86" e outra mostra "4.60"), cada seção é uma MÚLTIPLA APOSTA separada com sua odd já combinada
- Cada seção de "CRIAR APOSTA" com uma odd mostrada (como "1.86" ou "4.60") representa UMA múltipla aposta já combinada
- Se houver múltiplas seções, você precisa identificar a ODD COMBINADA de cada seção (não as odds individuais dos jogadores)

CASO 1: Uma única seção com múltiplas apostas individuais
- Se houver apenas UMA seção com vários jogadores e uma odd combinada no topo (ex: "3.20")
- Extraia cada jogador individualmente com suas odds individuais
- Exemplo: "Jogador 1 - Tipo - Odd: 2.80, Jogador 2 - Tipo - Odd: 3.20"

CASO 2: Múltiplas seções de "CRIAR APOSTA" com odds combinadas
- Se houver VÁRIAS seções de "CRIAR APOSTA", cada uma com sua própria odd combinada
- Para cada seção, identifique a ODD COMBINADA mostrada (ex: "1.86" ou "4.60")
- Liste cada seção como uma "perna" com a odd combinada
- Exemplo: "SEÇÃO 1: Odd combinada 1.86 (Royce O'Neale + Devin Booker)"
         "SEÇÃO 2: Odd combinada 4.60 (Jerami Grant + Deni Avdija)"

Para cada seção/aposta identifique:
- Times/atletas envolvidos
- Tipo de aposta (pontos, assistências, rebotes, etc.)
- Se houver odd combinada mostrada claramente na seção, use essa odd (é uma múltipla aposta já calculada)
- Se não houver odd combinada, extraia odds individuais
- Valor apostado (se visível, geralmente no final)
- Esporte e liga/campeonato

Retorne apenas o texto estruturado, sem explicações adicionais.`
        },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }]

    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: 800 })
    })

    const latency = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      await trackEvent(
        "openai_api_error",
        { error_type: "process_image_error", error_message: errorText.substring(0, 500), model: "gpt-4o", operation: "process_image", channel: "telegram" },
        userId,
        traceId
      ).catch(() => {})
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    await trackLLMGeneration(
      "process_image",
      "gpt-4o",
      messages,
      result,
      usage,
      latency,
      userId,
      traceId,
      { channel: "telegram" }
    ).catch(() => {})

    return result.choices[0].message.content
  } catch (error) {
    await trackEvent(
      "processing_error",
      { error_type: "process_image_error", error_message: error.message?.substring(0, 500), operation: "process_image", channel: "telegram" },
      userId,
      traceId
    ).catch(() => {})
    throw new Error(`Failed to process image: ${error.message}`)
  }
}

async function extractBettingInfo(content: string, userId: string, traceId: string): Promise<ProcessedBet | null> {
  try {
    console.log("extract_betting_request", { content_preview: content.slice(0, 200) })
    const prompt = `Analise a seguinte mensagem e determine se é uma aposta esportiva válida. Se NÃO for uma aposta, retorne null imediatamente.

MENSAGEM: "${content}"

IMPORTANTE - VALIDAÇÃO PRÉVIA:
- Se a mensagem for apenas um cumprimento (ex: "oi", "olá", "tudo bem"), retorne null
- Se a mensagem não mencionar nenhum time/jogador/esporte, retorne null
- Se a mensagem não mencionar odds ou valores relacionados a apostas, retorne null
- Se a mensagem for muito curta e não contiver informações de aposta, retorne null
- APENAS extraia informações se for claramente uma aposta esportiva com odds, times/jogadores e tipo de aposta

INSTRUÇÕES (APENAS SE FOR UMA APOSTA VÁLIDA):
1. Identifique se é uma aposta simples, múltipla ou sistema
   - "single" = 1 única aposta
   - "multiple" = 2 ou mais apostas combinadas
   - "system" = sistema de apostas
2. Extraia TODOS os jogos/eventos mencionados
   - Cada JOGO diferente = uma entrada no array matches
   - Se múltiplos jogadores estão no MESMO JOGO e há uma "ODD COMBINADA" no topo, combine-os em UMA única entrada
   - Se jogadores estão em jogos diferentes, cada jogo = uma entrada separada
3. Para cada match, identifique: times/jogo, atletas envolvidos (se múltiplos no mesmo jogo), tipo de aposta, e a odd
4. Identifique o valor apostado (stake)
5. Identifique datas quando mencionadas

IDENTIFICAÇÃO DE TIPO DE ODDS (CRÍTICO):

CENÁRIO A: Múltiplas seções com odds já combinadas
- Se a mensagem mencionar MÚLTIPLAS "SEÇÃO" ou "CRIAR APOSTA" com odds diferentes (ex: "SEÇÃO 1: Odd 1.86", "SEÇÃO 2: Odd 4.60")
- Cada seção é uma perna com sua odd já combinada
- Marque "odds_are_individual": false
- Marque "is_combined_odd": true para cada match que tiver odd combinada

CENÁRIO B: Uma única seção com múltiplas apostas individuais
- Se houver múltiplos jogadores/atletas listados, mas cada um tem sua própria odd individual claramente mostrada
- Cada jogador/atleta deve ser uma entrada separada no array matches
- Marque "odds_are_individual": true
- Marque "is_combined_odd": false

CENÁRIO C: Apenas uma aposta simples
- Marque "bet_type": "single"
- Marque "odds_are_individual": true
- "is_combined_odd": false

REQUISITOS DE SAÍDA:
- Sem texto extra, retorne JSON válido seguindo o schema abaixo
- matches é um array de jogos; odds sempre >= 1.01
- stake_amount pode ser 0 se não informado

SCHEMA:
{
  bet_type: "single" | "multiple" | "system",
  sport: string,
  league: string | null,
  matches: [{
    description: string,
    bet_description: string,
    odds: number,
    match_date: string | null,
    is_combined_odd: boolean
  }],
  stake_amount: number,
  bet_date: string,
  odds_are_individual: boolean
}`

    const messages = [{ role: "user" as const, content: prompt }]

    const startTime = Date.now()

    const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        tools: [CALCULATE_ODDS_TOOL],
        tool_choice: "auto",
        response_format: {
          type: "json_schema",
          json_schema: { name: "betting_info", strict: true, schema: BETTING_INFO_SCHEMA }
        },
        max_tokens: 2000,
        temperature: 0.1
      })
    })

    const initialLatency = Date.now() - startTime

    if (!response.ok) {
      const errorText = await response.text()
      await trackEvent(
        "openai_api_error",
        { error_type: "extract_betting_error", error_message: errorText.substring(0, 500), model: "gpt-4o", operation: "extract_betting", channel: "telegram" },
        userId,
        traceId
      ).catch(() => {})
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    let result = await response.json()
    let message = result.choices[0].message
    let totalLatency = initialLatency
    let totalUsage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    const usedToolCalling = !!(message.tool_calls && message.tool_calls.length > 0)

    console.log("extract_betting_first_choice", {
      content_preview: typeof message.content === "string" ? message.content.slice(0, 200) : "",
      tool_calls_len: message.tool_calls?.length || 0
    })

    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0]
      if (toolCall.function?.name === "calculate_multiple_odds") {
        try {
          const args = JSON.parse(toolCall.function.arguments || "{}")
          const odds = args.odds as number[]
          const combinedOdd = await calculateMultipleOdds(odds)
          const toolResponse = { role: "tool" as const, tool_call_id: toolCall.id, content: JSON.stringify({ combined_odd: combinedOdd }) }

          const followUp = await fetch(`${OPENAI_API_URL}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [...messages, message, toolResponse],
              tools: [CALCULATE_ODDS_TOOL],
              tool_choice: "none",
              response_format: { type: "json_schema", json_schema: { name: "betting_info", strict: true, schema: BETTING_INFO_SCHEMA } },
              max_tokens: 1500,
              temperature: 0.1
            })
          })

          const followLatency = Date.now() - startTime - initialLatency
          const followResult = await followUp.json()
          totalLatency += followLatency
          const followUsage = followResult.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          totalUsage = {
            prompt_tokens: (totalUsage.prompt_tokens || 0) + (followUsage.prompt_tokens || 0),
            completion_tokens: (totalUsage.completion_tokens || 0) + (followUsage.completion_tokens || 0),
            total_tokens: (totalUsage.total_tokens || 0) + (followUsage.total_tokens || 0)
          }

          message = followResult.choices[0].message
          result = followResult
          console.log("extract_betting_after_tool", {
            content_preview: typeof message.content === "string" ? message.content.slice(0, 200) : "",
            tool_calls_len: message.tool_calls?.length || 0
          })
        } catch (err) {
          await trackEvent(
            "processing_error",
            { error_type: "tool_call_error", error_message: (err as any)?.message?.substring(0, 500), operation: "extract_betting", channel: "telegram" },
            userId,
            traceId
          ).catch(() => {})
          return null
        }
      }
    }

    await trackLLMGeneration(
      "extract_betting",
      "gpt-4o",
      messages,
      result,
      totalUsage,
      totalLatency,
      userId,
      traceId,
      { channel: "telegram", used_tool_calling: usedToolCalling }
    ).catch(() => {})

    console.log("extract_betting_raw_content", {
      content_preview: typeof message.content === "string" ? message.content.slice(0, 300) : "",
      tool_calls: message.tool_calls?.length || 0
    })

    let bettingInfo: ProcessedBet
    try {
      bettingInfo = JSON.parse(message.content) as ProcessedBet
    } catch (err) {
      console.error("extract_betting_parse_error", { error: (err as any)?.message, content: message.content })
      await trackEvent(
        "processing_error",
        { error_type: "extract_betting_parse_error", error_message: (err as any)?.message?.substring(0, 500), operation: "extract_betting", channel: "telegram" },
        userId,
        traceId
      ).catch(() => {})
      return null
    }
    if (!bettingInfo.matches || bettingInfo.matches.length === 0) {
      console.log("extract_betting_no_matches", {
        content_preview: message.content?.slice ? message.content.slice(0, 200) : "",
        raw_message_type: typeof message.content
      })
      await trackEvent(
        "bet_extraction_failed",
        { message: "no_matches_extracted", channel: "telegram" },
        userId,
        traceId
      ).catch(() => {})
      return null
    }
    return bettingInfo
  } catch (error) {
    await trackEvent(
      "processing_error",
      { error_type: "extract_betting_error", error_message: (error as any)?.message?.substring(0, 500), operation: "extract_betting", channel: "telegram" },
      userId,
      traceId
    ).catch(() => {})
    return null
  }
}

async function processMessage(
  supabase: any,
  messageId: string,
  content: string,
  userId: string,
  traceId: string,
  chatId: string | number
): Promise<void> {
  try {
    await supabase.from("message_queue").update({ status: "processing" }).eq("id", messageId)

    const normalizedContent = content.toLowerCase().trim()
    const simpleGreetings = ["oi", "olá", "ola", "hello", "hi", "hey", "eae", "e aí", "eai", "tudo bem", "tudo bom", "ok", "okay", "beleza", "blz"]
    const isSimpleGreeting = simpleGreetings.some(greeting => normalizedContent === greeting)
    const isTooShort = normalizedContent.length < 10 && !normalizedContent.match(/\d/)
    const bettingKeywords = ["odd", "odds", "aposta", "apost", "jogo", "time", "times", "vs", "pontos", "gols", "assist", "rebote", "stake", "valor", "reais", "r$", "bet", "betting"]
    const hasBettingKeywords = bettingKeywords.some(keyword => normalizedContent.includes(keyword))

    console.log("process_message_start", {
      message_id: messageId,
      user_id: userId,
      content_length: content.length,
      isSimpleGreeting,
      isTooShort,
      hasBettingKeywords
    })

    if (isSimpleGreeting || (isTooShort && !hasBettingKeywords)) {
      await trackEvent(
        "bet_extraction_skipped",
        { message_id: messageId, reason: isSimpleGreeting ? "simple_greeting" : "too_short_without_keywords", content_length: content.length, channel: "telegram" },
        userId,
        traceId
      ).catch(() => {})

      await supabase.from("message_queue").update({ status: "failed", error_message: "Message does not appear to be a betting message" }).eq("id", messageId)
      await sendHelpMessageTelegram(chatId)
      return
    }

    await trackEvent(
      "bet_extraction_started",
      { message_id: messageId, content_length: content.length, channel: "telegram" },
      userId,
      traceId
    ).catch(() => {})

    let bettingInfo = await extractBettingInfo(content, userId, traceId)
    console.log("bet_extraction_result", {
      message_id: messageId,
      has_betting_info: !!bettingInfo,
      matches_count: bettingInfo?.matches?.length,
      bet_type: bettingInfo?.bet_type
    })

    if (bettingInfo && bettingInfo.matches && bettingInfo.matches.length > 0) {
      const validMatches = bettingInfo.matches.filter(match =>
        match.description &&
        match.description.trim().length > 0 &&
        match.bet_description &&
        match.bet_description.trim().length > 0 &&
        match.odds &&
        match.odds >= 1.01
      )

      if (validMatches.length === 0) {
        console.log("bet_extraction_valid_matches_empty", { message_id: messageId, raw_matches: bettingInfo.matches })
        await trackEvent(
          "bet_extraction_failed",
          { message_id: messageId, reason: "invalid_matches_extracted", channel: "telegram" },
          userId,
          traceId
        ).catch(() => {})

        await supabase.from("message_queue").update({ status: "failed", error_message: "Extracted matches are invalid" }).eq("id", messageId)
        await sendHelpMessageTelegram(chatId)
        return
      }

      const limitReached = await hasReachedDailyLimit(supabase, userId)

      if (limitReached) {
        await trackEvent(
          "daily_limit_reached",
          { user_id: userId, daily_limit: DAILY_BET_LIMIT, channel: "telegram" },
          userId,
          traceId
        ).catch(() => {})

        await supabase
          .from("message_queue")
          .update({ status: "completed", processed_at: new Date().toISOString(), error_message: "Daily bet limit reached" })
          .eq("id", messageId)

        await sendPaywallMessageTelegram(chatId)
        return
      }

      const MAX_INDIVIDUAL_ODD = 20.0

      if (bettingInfo.matches.length > 1 && bettingInfo.bet_type !== "multiple") {
        bettingInfo.bet_type = "multiple"
      }

      const validatedMatches = bettingInfo.matches.map((match) => {
        const odd = match.odds || 1
        if (odd > MAX_INDIVIDUAL_ODD) {
          trackEvent(
            "bet_validation_warning",
            { warning_type: "high_individual_odd", odds_value: odd, channel: "telegram" },
            userId,
            traceId
          ).catch(() => {})
          return { ...match, odds: Math.min(odd, MAX_INDIVIDUAL_ODD), original_odd: odd }
        }
        if (odd < 1.01) {
          trackEvent(
            "bet_validation_warning",
            { warning_type: "low_odd", odds_value: odd, channel: "telegram" },
            userId,
            traceId
          ).catch(() => {})
          return { ...match, odds: 1.01 }
        }
        return match
      })

      let totalOdds = 1

      if (bettingInfo.bet_type === "multiple" && validatedMatches.length > 1) {
        totalOdds = validatedMatches.reduce((acc, match) => acc * (match.odds || 1), 1)
      } else if (validatedMatches.length === 1) {
        totalOdds = validatedMatches[0]?.odds || 1
      } else {
        totalOdds = validatedMatches.reduce((acc, match) => acc * (match.odds || 1), 1)
      }

      const currentDate = new Date().toISOString()
      const stakeAmount = bettingInfo.stake_amount || 0
      const calculatedOdds = bettingInfo.bet_type === "multiple" ? totalOdds : (validatedMatches[0]?.odds || bettingInfo.matches[0]?.odds)

      bettingInfo.matches = validatedMatches

      const { data: bet, error: betError } = await supabase
        .from("bets")
        .insert({
          user_id: userId,
          bet_type: bettingInfo.bet_type,
          sport: bettingInfo.sport || "outros",
          league: bettingInfo.league || null,
          match_description: validatedMatches.length === 1 ? validatedMatches[0]?.description : `Múltipla (${validatedMatches.length} seleções)`,
          bet_description: validatedMatches.length === 1 ? validatedMatches[0]?.bet_description : validatedMatches.map((m, i) => `${m.description} - ${m.bet_description}`).join(" • "),
          odds: calculatedOdds,
          stake_amount: stakeAmount,
          potential_return: stakeAmount * calculatedOdds,
          bet_date: currentDate,
          match_date: validatedMatches[0]?.match_date || null,
          raw_input: content,
          processed_data: bettingInfo,
          channel: "telegram"
        })
        .select()
        .single()

      if (betError) {
        throw betError
      }

      await trackEvent(
        "bet_created",
        { bet_id: bet.id, bet_type: bettingInfo.bet_type, total_odds: calculatedOdds, stake_amount: stakeAmount, legs_count: validatedMatches.length, channel: "telegram" },
        userId,
        traceId
      ).catch(() => {})

      if (bettingInfo.bet_type === "multiple" && validatedMatches.length > 1) {
        for (let i = 0; i < validatedMatches.length; i++) {
          const match = validatedMatches[i]
          if (!match.description || !match.bet_description || !match.odds) continue
          await supabase
            .from("bet_legs")
            .insert({
              bet_id: bet.id,
              leg_number: i + 1,
              sport: bettingInfo.sport || "outros",
              match_description: match.description,
              bet_description: match.bet_description,
              odds: match.odds,
              status: "pending"
            })
        }
      }

      await supabase
        .from("message_queue")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", messageId)

      await sendConfirmationMessageTelegram(chatId, bet)
    } else {
      await trackEvent(
        "bet_extraction_failed",
        { message_id: messageId, reason: "no_matches_extracted", channel: "telegram" },
        userId,
        traceId
      ).catch(() => {})

      await supabase.from("message_queue").update({ status: "failed", error_message: "Could not extract betting information from message" }).eq("id", messageId)
      await sendHelpMessageTelegram(chatId)
    }
  } catch (error) {
    await trackEvent(
      "processing_error",
      { error_type: "message_processing_error", error_message: error.message?.substring(0, 500), message_id: messageId, channel: "telegram" },
      userId,
      traceId
    ).catch(() => {})

    await supabase.from("message_queue").update({ status: "failed", error_message: error.message }).eq("id", messageId)
  }
}

async function findUserByTelegram(
  supabase: any,
  telegramUserId?: string,
  chatId?: string
): Promise<{ id: string; name?: string | null; telegram_chat_id?: string | null; whatsapp_number?: string | null } | null> {
  if (!telegramUserId && !chatId) return null

  const ors: string[] = []
  if (chatId) ors.push(`telegram_chat_id.eq.${chatId}`)
  if (telegramUserId) ors.push(`telegram_user_id.eq.${telegramUserId}`)

  if (ors.length === 0) return null

  const { data, error } = await supabase
    .from("users")
    .select("id, name, telegram_chat_id, whatsapp_number")
    .or(ors.join(","))
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data
}

async function findUserByPhone(supabase: any, phone: string): Promise<any | null> {
  const normalizedCandidates = normalizePhoneCandidates(phone)
  const { data: users } = await supabase
    .from("users")
    .select("id, whatsapp_number, telegram_phone, name")

  if (!users) return null

  const found = users.find((u: any) => {
    const userPhones = [u.whatsapp_number, u.telegram_phone].filter(Boolean) as string[]
    const match = userPhones.some(p => {
      const userVariants = normalizePhoneCandidates(p)
      return userVariants.some(uv => normalizedCandidates.includes(uv))
    })
    if (match) {
      console.log('phone_match_found', {
        incoming_phone: maskPhone(phone),
        incoming_candidates: normalizedCandidates,
        user_id: u.id,
        user_phones: userPhones.map(maskPhone)
      })
    } else {
      console.log('phone_match_miss', {
        incoming_phone: maskPhone(phone),
        incoming_candidates: normalizedCandidates,
        user_id: u.id,
        user_phones: userPhones.map(maskPhone)
      })
    }
    return match
  }) || null

  if (!found) {
    console.log('phone_match_none', {
      incoming_phone: maskPhone(phone),
      incoming_candidates: normalizedCandidates,
      users_checked: users.length
    })
  }

  return found
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" } })
  }

  if (!TELEGRAM_BOT_TOKEN) {
    return new Response("Missing TELEGRAM_BOT_TOKEN", { status: 500 })
  }

  if (TELEGRAM_WEBHOOK_SECRET) {
    const provided = req.headers.get("x-telegram-bot-api-secret-token")
    if (provided !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  try {
    const payload = await req.json()
    const updateId: number | undefined = payload.update_id

    // Idempotency: if we already handled this update_id in this process, skip
    if (typeof updateId === "number") {
      if (processedUpdateIds.has(updateId)) {
        return new Response(JSON.stringify({ success: true, message: "Duplicate update ignored" }), { headers: { "Content-Type": "application/json" }, status: 200 })
      }
      processedUpdateIds.add(updateId)
    }

    const updateMessage: TelegramMessage | undefined = payload.message || payload.edited_message || payload.channel_post

    // Log raw payload (truncate to avoid huge logs)
    try {
      const raw = JSON.stringify(payload)
      console.log("telegram_raw_payload", raw.length > 4000 ? raw.slice(0, 4000) + "...(truncated)" : raw)
    } catch (_) {
      console.log("telegram_raw_payload_unstringifiable")
    }

    // Log summary
    console.log("telegram_update_received", {
      update_id: payload.update_id,
      has_message: !!payload.message,
      has_edited_message: !!payload.edited_message,
      has_channel_post: !!payload.channel_post,
      contact: payload.message?.contact ? { phone: maskPhone(payload.message.contact.phone_number) } : undefined,
      text_preview: (payload.message?.text || payload.message?.caption || "").slice(0, 100)
    })

    if (!updateMessage) {
      return new Response(JSON.stringify({ success: true, message: "No message to process" }), { headers: { "Content-Type": "application/json" }, status: 200 })
    }

    const chatId = updateMessage.chat.id
    const fromUser = updateMessage.from
    const text = updateMessage.text || updateMessage.caption || ""
    const traceId = generateTraceId()

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Debug info about message content fields
    console.log("telegram_message_debug", {
      update_id: payload.update_id,
      message_keys: Object.keys(updateMessage || {}),
      text: updateMessage?.text,
      caption: updateMessage?.caption,
      has_photo: !!updateMessage?.photo,
      photo_count: updateMessage?.photo?.length || 0,
      has_voice: !!updateMessage?.voice,
      has_audio: !!updateMessage?.audio,
      has_document: !!updateMessage?.document,
      document_mime: updateMessage?.document?.mime_type
    })

    // Handle contact sync first
    if (updateMessage.contact) {
      const contactPhone = updateMessage.contact.phone_number
    console.log('contact_received', {
      chat_id: chatId,
      from_user_id: fromUser?.id,
      contact_phone: maskPhone(contactPhone),
      raw_contact: contactPhone
    })
      const userMatch = await findUserByPhone(supabase, contactPhone)

      if (userMatch) {
        const { error: updateError } = await supabase
          .from("users")
          .update({
            telegram_user_id: fromUser?.id ? String(fromUser.id) : String(updateMessage.contact.user_id || ""),
            telegram_chat_id: String(chatId),
            telegram_username: fromUser?.username || null,
            telegram_phone: contactPhone,
            telegram_synced: true,
            telegram_synced_at: new Date().toISOString(),
            telegram_sync_source: "contact_share"
          })
          .eq("id", userMatch.id)

        if (!updateError) {
          await identifyUser(userMatch.id, {
            name: fromUser?.first_name || userMatch.name || undefined,
            phone: contactPhone,
            conversation_id: undefined,
            whatsapp_number: userMatch.whatsapp_number || undefined
          }).catch(() => {})

          await sendWelcomeMessageTelegram(chatId, fromUser?.first_name || userMatch.name || undefined)
          await trackEvent(
            "telegram_sync_success",
            { user_id: userMatch.id, chat_id: chatId, phone: contactPhone, channel: "telegram" },
            userMatch.id,
            traceId
          ).catch(() => {})

          return new Response(JSON.stringify({ success: true, message: "Telegram synced" }), { headers: { "Content-Type": "application/json" }, status: 200 })
        }
      }

      await sendTelegramMessage(chatId, "Não encontrei sua conta com esse número. Responda com o contato novamente ou fale com o suporte.")
      // Return 200 to avoid Telegram retrying the same contact message indefinitely
      return new Response(
        JSON.stringify({ success: true, error: "User not found for provided phone" }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    }

    // Find user by telegram ids
    const telegramUserId = fromUser?.id ? String(fromUser.id) : undefined
    const user = await findUserByTelegram(supabase, telegramUserId, String(chatId))

    if (!user) {
      await trackEvent(
        "telegram_user_missing",
        { chat_id: chatId, telegram_user_id: telegramUserId, channel: "telegram" },
        telegramUserId || "unknown",
        traceId
      ).catch(() => {})

      await sendContactRequest(chatId)
      // Return 200 to avoid Telegram retry loops that would resend the same message
      return new Response(
        JSON.stringify({ success: true, message: "Contact requested" }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    }

    await identifyUser(user.id, {
      name: fromUser?.first_name || user.name || undefined,
      phone: undefined,
      conversation_id: undefined,
      whatsapp_number: undefined
    }).catch(() => {})

    await trackEvent(
      "telegram_message_received",
      {
        chat_id: chatId,
        telegram_user_id: telegramUserId,
        has_photo: !!updateMessage.photo,
        has_voice: !!updateMessage.voice,
        content_length: text.length,
        channel: "telegram"
      },
      user.id,
      traceId
    ).catch(() => {})

    let actualContent = text
    let mediaUrl: string | null = null
    let messageType = "text"

    if (updateMessage.photo && updateMessage.photo.length > 0) {
      const largest = updateMessage.photo[updateMessage.photo.length - 1]
      mediaUrl = await getTelegramFileUrl(largest.file_id)
      messageType = "image"
      console.log("telegram_media_detected", { type: "photo", file_id: largest.file_id, mediaUrl, photos_count: updateMessage.photo.length })
    } else if (updateMessage.voice) {
      mediaUrl = await getTelegramFileUrl(updateMessage.voice.file_id)
      messageType = "audio"
      console.log("telegram_media_detected", { type: "voice", file_id: updateMessage.voice.file_id, mediaUrl })
    } else if (updateMessage.audio) {
      mediaUrl = await getTelegramFileUrl(updateMessage.audio.file_id)
      messageType = "audio"
      console.log("telegram_media_detected", { type: "audio", file_id: updateMessage.audio.file_id, mediaUrl })
    } else if (updateMessage.document) {
      // Some clients send images as document
      mediaUrl = await getTelegramFileUrl(updateMessage.document.file_id)
      messageType = "image"
      console.log("telegram_media_detected", { type: "document", mime: updateMessage.document.mime_type, file_id: updateMessage.document.file_id, mediaUrl })
    } else if (!actualContent || actualContent.trim().length === 0) {
      console.log("telegram_empty_content", {
        text: actualContent,
        mediaUrl,
        has_photo: !!updateMessage.photo,
        has_voice: !!updateMessage.voice,
        has_audio: !!updateMessage.audio,
        has_document: !!updateMessage.document
      })
      await sendTelegramMessage(chatId, "Não encontrei conteúdo na mensagem. Envie texto, foto ou áudio.")
      return new Response(JSON.stringify({ success: false, error: "Empty message" }), { headers: { "Content-Type": "application/json" }, status: 400 })
    }

    if (messageType === "audio" && mediaUrl) {
      const transcription = await transcribeAudio(mediaUrl, user.id, traceId)
      if (actualContent && actualContent.trim()) {
        actualContent = `Transcrição do áudio: ${transcription}\n\nTexto adicional: ${actualContent}`
      } else {
        actualContent = transcription
      }
      messageType = "text"
    } else if (messageType === "image" && mediaUrl) {
      const imageAnalysis = await processImage(mediaUrl, user.id, traceId)
      if (actualContent && actualContent.trim()) {
        actualContent = `Análise da imagem: ${imageAnalysis}\n\nTexto adicional do usuário: ${actualContent}`
      } else {
        actualContent = imageAnalysis
      }
      messageType = "text"
    }

    const { data: queueMessage, error: queueError } = await supabase
      .from("message_queue")
      .insert({
        user_id: user.id,
        message_type: messageType,
        content: actualContent,
        media_url: mediaUrl,
        status: "pending",
        channel: "telegram"
      })
      .select()
      .single()

    if (queueError) {
      console.error("queue_insert_error", queueError)
      throw new Error(queueError.message)
    }

    await processMessage(supabase, queueMessage.id, actualContent, user.id, traceId, chatId)

    return new Response(JSON.stringify({ success: true, message: "Message processed successfully", queue_id: queueMessage.id }), { headers: { "Content-Type": "application/json" }, status: 200 })
  } catch (error) {
    console.error("Error in Telegram webhook:", error)
    return new Response(JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }), { headers: { "Content-Type": "application/json" }, status: 500 })
  }
})

