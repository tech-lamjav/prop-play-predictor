// ============================================================
// extraction.ts — pipeline print/texto/áudio → aposta (LLM) + limites
// ============================================================
// Extraído de index.ts na Onda 6b da revisão (split mecânico, move-only).
import { OPENAI_API_KEY, OPENAI_API_URL, DAILY_BET_LIMIT, TIMEZONE_GMT3 } from "./config.ts"
import type { ProcessedBet } from "./types.ts"
import {
  sendHelpMessageTelegram, sendPaywallMessageTelegram, sendConfirmationMessageTelegram,
} from "./telegram-api.ts"
import { trackEvent, trackLLMGeneration } from "../shared/posthog.ts"

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
    odds_are_individual: { type: "boolean" },
    betting_market: { type: "string" }
  },
  required: ["bet_type", "sport", "matches", "stake_amount", "bet_date", "odds_are_individual", "league", "betting_market"],
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
async function getDailyBetCount(supabase: any, userId: string, traceId?: string): Promise<number> {
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

    console.log("daily_limit_window_calculation", {
      user_id: userId,
      trace_id: traceId,
      now_utc: nowUTC.toISOString(),
      now_gmt3: nowGMT3.toISOString(),
      start_of_day_utc: startOfDayUTC.toISOString(),
      start_of_tomorrow_utc: startOfTomorrowUTC.toISOString(),
      gmt3_date_string: gmt3DateString
    })

    if (traceId) {
      await trackEvent(
        "daily_limit_window_calculation",
        {
          user_id: userId,
          now_utc: nowUTC.toISOString(),
          now_gmt3: nowGMT3.toISOString(),
          start_of_day_utc: startOfDayUTC.toISOString(),
          start_of_tomorrow_utc: startOfTomorrowUTC.toISOString(),
          gmt3_date_string: gmt3DateString,
          channel: "telegram"
        },
        userId,
        traceId
      ).catch(() => {})
    }

    const { count, error } = await supabase
      .from("bets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("bet_date", startOfDayUTC.toISOString())
      .lt("bet_date", startOfTomorrowUTC.toISOString())

    if (error) {
      console.error("Error counting daily bets:", error)
      if (traceId) {
        await trackEvent(
          "daily_limit_count_error",
          {
            user_id: userId,
            error: JSON.stringify(error),
            channel: "telegram"
          },
          userId,
          traceId
        ).catch(() => {})
      }
      return 0
    }

    const betCount = count || 0

    console.log("daily_limit_bet_count", {
      user_id: userId,
      trace_id: traceId,
      bet_count: betCount,
      start_of_day_utc: startOfDayUTC.toISOString(),
      start_of_tomorrow_utc: startOfTomorrowUTC.toISOString()
    })

    if (traceId) {
      await trackEvent(
        "daily_limit_bet_count",
        {
          user_id: userId,
          bet_count: betCount,
          start_of_day_utc: startOfDayUTC.toISOString(),
          start_of_tomorrow_utc: startOfTomorrowUTC.toISOString(),
          channel: "telegram"
        },
        userId,
        traceId
      ).catch(() => {})
    }

    return betCount
  } catch (error: any) {
    console.error("Error getting daily bet count:", error)
    if (traceId) {
      await trackEvent(
        "daily_limit_count_exception",
        {
          user_id: userId,
          error_message: error instanceof Error ? error.message : String(error),
          channel: "telegram"
        },
        userId,
        traceId
      ).catch(() => {})
    }
    return 0
  }
}

async function hasReachedDailyLimit(supabase: any, userId: string, traceId?: string): Promise<boolean> {
  try {
    console.log("daily_limit_check_start", {
      user_id: userId,
      trace_id: traceId,
      daily_limit: DAILY_BET_LIMIT
    })

    // Check only betinho subscription status for daily limit
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("betinho_subscription_status")
      .eq("id", userId)
      .single()

    if (userError) {
      console.error("Error fetching user Betinho subscription status:", userError)
      console.log("daily_limit_user_lookup_error", {
        user_id: userId,
        trace_id: traceId,
        error: JSON.stringify(userError)
      })
      if (traceId) {
        await trackEvent(
          "daily_limit_user_lookup_error",
          {
            user_id: userId,
            error: JSON.stringify(userError),
            channel: "telegram"
          },
          userId,
          traceId
        ).catch(() => {})
      }
      return false
    }

    const subscriptionStatus = user?.betinho_subscription_status || null

    console.log("daily_limit_subscription_status", {
      user_id: userId,
      trace_id: traceId,
      betinho_subscription_status: subscriptionStatus
    })

    if (traceId) {
      await trackEvent(
        "daily_limit_subscription_status",
        {
          user_id: userId,
          betinho_subscription_status: subscriptionStatus,
          channel: "telegram"
        },
        userId,
        traceId
      ).catch(() => {})
    }

    // Premium users (betinho subscription) have no limit
    if (user?.betinho_subscription_status === "premium") {
      console.log("daily_limit_premium_bypass", {
        user_id: userId,
        trace_id: traceId,
        betinho_subscription_status: subscriptionStatus
      })
      if (traceId) {
        await trackEvent(
          "daily_limit_premium_bypass",
          {
            user_id: userId,
            betinho_subscription_status: subscriptionStatus,
            channel: "telegram"
          },
          userId,
          traceId
        ).catch(() => {})
      }
      return false
    }

    const betCount = await getDailyBetCount(supabase, userId, traceId)
    const limitReached = betCount >= DAILY_BET_LIMIT

    console.log("daily_limit_evaluation", {
      user_id: userId,
      trace_id: traceId,
      bet_count: betCount,
      daily_limit: DAILY_BET_LIMIT,
      limit_reached: limitReached,
      betinho_subscription_status: subscriptionStatus
    })

    if (traceId) {
      await trackEvent(
        "daily_limit_evaluation",
        {
          user_id: userId,
          bet_count: betCount,
          daily_limit: DAILY_BET_LIMIT,
          limit_reached: limitReached,
          betinho_subscription_status: subscriptionStatus,
          channel: "telegram"
        },
        userId,
        traceId
      ).catch(() => {})
    }

    return limitReached
  } catch (error: any) {
    console.error("Error checking daily limit:", error)
    console.log("daily_limit_check_exception", {
      user_id: userId,
      trace_id: traceId,
      error_message: error instanceof Error ? error.message : String(error)
    })
    if (traceId) {
      await trackEvent(
        "daily_limit_check_exception",
        {
          user_id: userId,
          error_message: error instanceof Error ? error.message : String(error),
          channel: "telegram"
        },
        userId,
        traceId
      ).catch(() => {})
    }
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
  } catch (error: any) {
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
  } catch (error: any) {
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

CLASSIFICAÇÃO DE ESPORTE:
 - Identifique o esporte com base nas informações da aposta
 - Padronize e retorne o nome do esporte de acordo com a lista abaixo:
  * Futebol
  * Basquete
  * Tênis
  * Futebol Americano
  * Futsal
  * Vôlei
  * eSports
  * MMA/UFC
  * Boxe
  * Hóquei no Gelo
  * Beisebol
  * Golfe
  * Tênis de Mesa
  * Handebol
  * Rugby
  * Corrida de Cavalos
  * Ciclismo
  * Críquete
  * Dardos
  * Snooker
  * Badminton
  * Futebol Australiano
  * Esqui
  * Biatlo
  * Automobilismo
  * Vôlei de Praia
  * Padel
  * Natação
  * Atletismo
 - Se não for possível identificar o esporte, retorne o esporte como string vazia.
 - Se o esporte for identificado e não estiver na lista, retorne ele como está.

CLASSIFICAÇÃO DE LIGAS:
 - Identifique a liga com base nas informações da aposta
 - Padronize e retorne o nome da liga de acordo com o campo "league" do seguinte json:

[
  {
    "league": "US - NBA",
    "sport": "Futebol"
  },
  {
    "league": "BR - Copa do Brasil",
    "sport": "Futebol"
  },
  {
    "league": "US - NBA",
    "sport": "Basquete"
  },
  {
    "league": "EU - Europa League",
    "sport": "Futebol"
  },
  {
    "league": "Mundial de Clubes FIFA",
    "sport": "Futebol"
  },
  {
    "league": "EN - Premier League",
    "sport": "Futebol"
  },
  {
    "league": "SAU - Pro League",
    "sport": "Futebol"
  },
  {
    "league": "AU - NBL",
    "sport": "Basquete"
  },
  {
    "league": "ITA - Série A",
    "sport": "Futebol"
  },
  {
    "league": "EU - Champions League",
    "sport": "Futebol"
  },
  {
    "league": "US - NFL",
    "sport": "Futebol Americano"
  },
  {
    "league": "ME - Liga Premier",
    "sport": "Futebol"
  },
  {
    "league": "EU - Conference League",
    "sport": "Futebol"
  },
  {
    "league": "AME - Copa Sul-Americana",
    "sport": "Futebol"
  },
  {
    "league": "AME - Copa Libertadores",
    "sport": "Futebol"
  },
  {
    "league": "AL - Bundesliga",
    "sport": "Futebol"
  },
  {
    "league": "FR - Ligue 1",
    "sport": "Futebol"
  },
  {
    "league": "Fórmula 1",
    "sport": "Automobilismo"
  },
  {
    "league": "HOL - Eerste Divisie",
    "sport": "Futebol"
  },
  {
    "league": "BR - Série B",
    "sport": "Futebol"
  },
  {
    "league": "TUR - Lig 1",
    "sport": "Futebol"
  },
  {
    "league": "ES - La Liga",
    "sport": "Futebol"
  },
  {
    "league": "EU - Eliminatória UEFA",
    "sport": "Futebol"
  },
  {
    "league": "PT - Primeira Liga",
    "sport": "Futebol"
  },
  {
    "league": "BR - Série A",
    "sport": "Futebol"
  },
  {
    "league": "BR - Paulistão",
    "sport": "Futebol"
  },
  {
    "league": "BEL - Pro League",
    "sport": "Futebol"
  }
]
- Se não for possível identificar a liga, retorne a liga como string vazia.
- Se a liga for identificada e não estiver na lista, retorne ela como está.
- Se forem identificadas múltiplas ligas, retorne "Diversos"

CLASSIFICAÇÃO DE MERCADO DA APOSTA:
- Identifique o mercado da aposta com base na descrição (tipo de aposta, odds, termos usados).
- Valores permitidos (use exatamente um):
  * "Múltipla" = múltiplas seleções combinadas (acumulada)
  * "Money Line" = aposta no vencedor do jogo/evento (1x2 em futebol, winner)
  * "Handicap" = linha de handicap (asiático ou europeu)
  * "Over/Under" = totais (over/under gols, pontos)
  * "Dupla Chance" = duas opções (ex: 1X, X2, 12)
  * "Ambas Marcam" = sim/não (ambas marcam, BTTS)
- Retorne string vazia "" se não for possível identificar o mercado.

SCHEMA:
{
  bet_type: "single" | "multiple" | "system",
  sport: string,
  league: string | null,
  betting_market: string,
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
      try {
        const toolResponses: Array<{ role: "tool"; tool_call_id: string; content: string }> = []
        for (const toolCall of message.tool_calls) {
          const id = toolCall.id
          const name = toolCall.function?.name
          const argsJson = toolCall.function?.arguments || "{}"
          if (name === "calculate_multiple_odds") {
            const args = JSON.parse(argsJson)
            const odds = (args?.odds as number[]) ?? []
            const combinedOdd = await calculateMultipleOdds(odds)
            toolResponses.push({ role: "tool" as const, tool_call_id: id, content: JSON.stringify({ combined_odd: combinedOdd }) })
          } else {
            toolResponses.push({ role: "tool" as const, tool_call_id: id, content: JSON.stringify({ error: "unknown_tool" }) })
          }
        }

        const followUp = await fetch(`${OPENAI_API_URL}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [...messages, message, ...toolResponses],
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

        const followChoice = followResult?.choices?.[0]
        if (!followChoice?.message) {
          const apiError = followResult?.error?.message || JSON.stringify(followResult).slice(0, 500)
          console.error("extract_betting_follow_no_choices", { followResult: followResult?.error || followResult })
          await trackEvent(
            "processing_error",
            { error_type: "tool_call_error", error_message: apiError, operation: "extract_betting", channel: "telegram" },
            userId,
            traceId
          ).catch(() => {})
          return null
        }

        message = followChoice.message
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
  } catch (error: any) {
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

      console.log("bet_validation_matches", {
        message_id: messageId,
        original_count: bettingInfo.matches.length,
        valid_count: validMatches.length
      })

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

      const limitReached = await hasReachedDailyLimit(supabase, userId, traceId)

      console.log("daily_limit_check_result", {
        user_id: userId,
        message_id: messageId,
        trace_id: traceId,
        limit_reached: limitReached,
        daily_limit: DAILY_BET_LIMIT
      })

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

      // BUGFIX: Use validMatches instead of bettingInfo.matches for bet_type check
      if (validMatches.length > 1 && bettingInfo.bet_type !== "multiple") {
        bettingInfo.bet_type = "multiple"
      }

      // BUGFIX: Use validMatches instead of bettingInfo.matches for validation
      const validatedMatches = validMatches.map((match) => {
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
      // BUGFIX: Use validatedMatches for fallback instead of bettingInfo.matches
      const calculatedOdds = bettingInfo.bet_type === "multiple" ? totalOdds : (validatedMatches[0]?.odds || 1.01)

      bettingInfo.matches = validatedMatches

      console.log("bet_insert_starting", {
        message_id: messageId,
        user_id: userId,
        bet_type: bettingInfo.bet_type,
        stake_amount: stakeAmount,
        calculated_odds: calculatedOdds,
        matches_count: validatedMatches.length
      })

      const { data: bet, error: betError } = await supabase
        .from("bets")
        .insert({
          user_id: userId,
          bet_type: bettingInfo.bet_type,
          sport: bettingInfo.sport || "outros",
          league: bettingInfo.league || null,
          betting_market: bettingInfo.betting_market || null,
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
        console.error("bet_insert_error", { message_id: messageId, error: betError })
        throw betError
      }

      console.log("bet_insert_success", { message_id: messageId, bet_id: bet.id })

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

      console.log("bet_sending_confirmation", { message_id: messageId, bet_id: bet.id, chat_id: chatId })
      await sendConfirmationMessageTelegram(chatId, bet)
      console.log("bet_confirmation_sent", { message_id: messageId, bet_id: bet.id })
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
  } catch (error: any) {
    await trackEvent(
      "processing_error",
      { error_type: "message_processing_error", error_message: error.message?.substring(0, 500), message_id: messageId, channel: "telegram" },
      userId,
      traceId
    ).catch(() => {})

    await supabase.from("message_queue").update({ status: "failed", error_message: error.message }).eq("id", messageId)
  }
}

export { getDailyBetCount, hasReachedDailyLimit, transcribeAudio, processImage, extractBettingInfo, processMessage }
