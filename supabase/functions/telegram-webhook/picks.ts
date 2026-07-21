// ============================================================
// picks.ts — registro de aposta a partir do daily (item 15)
// ============================================================
// Extraído de index.ts na Onda 6b da revisão (split mecânico, move-only).
import { BETS_DASHBOARD_URL } from "./config.ts"
import { telegramCall, escHtml, formatBRL } from "./telegram-api.ts"

// ============================================================
// Registrar aposta da "oportunidade do dia" (item 15) — botões de stake
// ============================================================

// Unidade efetiva do usuário em R$ (fixo = valor; percentual = % da banca).
// null = não configurada → só oferece "Outro valor".
async function effectiveUnit(supabase: any, userId: string): Promise<number | null> {
  const { data } = await supabase
    .from("users")
    .select("unit_value, unit_calculation_method, bank_amount")
    .eq("id", userId)
    .maybeSingle()
  const u = Number(data?.unit_value)
  if (!u || u <= 0) return null
  if (data.unit_calculation_method === "percentual") {
    const bank = Number(data.bank_amount)
    if (!bank || bank <= 0) return null
    return Math.round(bank * (u / 100) * 100) / 100
  }
  return u
}

// Cria a aposta pendente a partir de um pick do daily. channel 'futebol' marca
// a origem (loop Análise→Betinho); processed_data guarda o pick pra auditoria.
async function registerPickBet(supabase: any, userId: string, pick: any, stake: number) {
  const odds = Number(pick.odds)
  return await supabase
    .from("bets")
    .insert({
      user_id: userId,
      bet_type: "single",
      sport: pick.sport || "Futebol",
      league: pick.league || null,
      betting_market: pick.betting_market || null,
      match_description: pick.match_description,
      bet_description: pick.bet_description,
      odds,
      stake_amount: stake,
      potential_return: Math.round(stake * odds * 100) / 100,
      status: "pending",
      bet_date: new Date().toISOString(),
      match_date: pick.match_date || null,
      channel: "futebol",
      raw_input: "[oportunidade do dia]",
      processed_data: { source: "daily_opportunity", pick_id: pick.id }
    })
    .select("id")
    .maybeSingle()
}

function pickReceiptHtml(pick: any, stake: number, streakLine?: string | null): string {
  const odds = Number(pick.odds)
  return [
    `✅ <b>Registrado no Betinho!</b>`,
    "",
    `<b>${escHtml(pick.bet_description)}</b>`,
    `${escHtml(pick.match_description)}`,
    `${formatBRL(stake)} · odd ${odds} · retorno ${formatBRL(Math.round(stake * odds * 100) / 100)}`,
    ...(streakLine ? ["", streakLine] : []), // item 18: milestone da sequência (flag-gated)
    "",
    `Tá pendente — quando o jogo acabar, eu fecho pra você. 📊 ${BETS_DASHBOARD_URL}`
  ].join("\n")
}

// pergunta o valor por force_reply e guarda o prompt (o interceptador lê depois)
async function sendStakePrompt(supabase: any, chatId: string | number, userId: string, pickId: string, text: string): Promise<void> {
  const sent = await telegramCall<{ result?: { message_id: number } }>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { force_reply: true, input_field_placeholder: "Ex: 50" }
  })
  const promptId = sent?.result?.message_id
  if (promptId) {
    await supabase.from("stake_prompts").insert({
      chat_id: String(chatId), message_id: promptId, pick_id: pickId, user_id: userId
    })
  }
}


export { effectiveUnit, registerPickBet, pickReceiptHtml, sendStakePrompt }
