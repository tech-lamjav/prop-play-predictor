// ============================================================
// callbacks.ts — todos os botões inline (settle/mute/fix/regbet/stk/prefs)
// ============================================================
// Extraído de index.ts na Onda 6b da revisão (split mecânico, move-only).
import { BETS_DASHBOARD_URL } from "./config.ts"
import type { TelegramCallbackQuery } from "./types.ts"
import {
  telegramCall, escHtml, formatBRL, answerCallbackQuery, editSettledMessage, settledHtml,
} from "./telegram-api.ts"
import { effectiveUnit, registerPickBet, pickReceiptHtml, sendStakePrompt } from "./picks.ts"
import { findUserByTelegram } from "./users.ts"
import { prefsKeyboard, prefsText } from "./prefs.ts"
import { trackEvent } from "../shared/posthog.ts"
import { receiptStreakLineFor } from "../shared/streak.ts"

async function handleCallbackQuery(
  supabase: any,
  cq: TelegramCallbackQuery,
  traceId: string
): Promise<Response> {
  const ok = (msg: string) =>
    new Response(JSON.stringify({ success: true, message: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })

  const data = cq.data || ""
  const chatId = cq.message?.chat?.id
  const messageId = cq.message?.message_id

  if (!chatId || !messageId) {
    await answerCallbackQuery(cq.id).catch(() => {})
    return ok("callback without message")
  }

  const user = await findUserByTelegram(
    supabase,
    cq.from?.id ? String(cq.from.id) : undefined,
    String(chatId),
    traceId
  )
  if (!user) {
    await answerCallbackQuery(cq.id, "Não achei sua conta. Manda /start pra sincronizar.")
    return ok("callback user not found")
  }

  // 🔕 mute:<bet_id> — para os lembretes; mantém os botões de liquidar desta aposta
  if (data.startsWith("mute:")) {
    const betId = data.slice("mute:".length)
    await supabase.from("users").update({ settlement_reminders_muted: true }).eq("id", user.id)
    await telegramCall("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Green", callback_data: `settle:${betId}:won` },
            { text: "❌ Red", callback_data: `settle:${betId}:lost` }
          ],
          [{ text: "Outras opções ↗", url: BETS_DASHBOARD_URL }]
        ]
      }
    })
    await answerCallbackQuery(cq.id, "🔕 Ok, sem mais lembretes. Reative mandando /lembretes.")
    await trackEvent(
      "settlement_reminders_muted",
      { via: "button", channel: "telegram" },
      user.id,
      traceId
    ).catch(() => {})
    return ok("reminders muted")
  }

  // mutew — botão "Silenciar resumo" da DM do resumo semanal (item 04).
  // Opt-out independente da liquidação; /resumo reativa.
  if (data === "mutew") {
    await supabase.from("users").update({ weekly_summary_muted: true }).eq("id", user.id)
    // remove só a linha do silenciar; "Ver minha banca" continua útil
    await telegramCall("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[{ text: "Ver minha banca", url: BETS_DASHBOARD_URL }]]
      }
    })
    await answerCallbackQuery(cq.id, "Ok, sem mais resumos semanais. Pra voltar: /resumo")
    await trackEvent(
      "weekly_summary_muted",
      { via: "button", channel: "telegram" },
      user.id,
      traceId
    ).catch(() => {})
    return ok("weekly summary muted")
  }

  // prefliq / prefres — toggles do centro de controle /mensagens (Onda 6).
  // Alterna a preferência e REESCREVE a própria mensagem com o estado novo.
  if (data === "prefliq" || data === "prefres") {
    const { data: cur } = await supabase
      .from("users").select("settlement_reminders_muted, weekly_summary_muted").eq("id", user.id).maybeSingle()
    const p = {
      settlementMuted: cur?.settlement_reminders_muted ?? false,
      weeklyMuted: cur?.weekly_summary_muted ?? false,
    }
    let toast: string
    if (data === "prefliq") {
      p.settlementMuted = !p.settlementMuted
      await supabase.from("users").update({ settlement_reminders_muted: p.settlementMuted }).eq("id", user.id)
      toast = p.settlementMuted ? "🔕 Liquidação silenciada." : "🔔 Liquidação reativada."
      await trackEvent(
        p.settlementMuted ? "settlement_reminders_muted" : "settlement_reminders_unmuted",
        { via: "prefs", channel: "telegram" }, user.id, traceId
      ).catch(() => {})
    } else {
      p.weeklyMuted = !p.weeklyMuted
      await supabase.from("users").update({ weekly_summary_muted: p.weeklyMuted }).eq("id", user.id)
      toast = p.weeklyMuted ? "Resumo semanal silenciado." : "📊 Resumo semanal reativado."
      await trackEvent(
        p.weeklyMuted ? "weekly_summary_muted" : "weekly_summary_unmuted",
        { via: "prefs", channel: "telegram" }, user.id, traceId
      ).catch(() => {})
    }
    await telegramCall("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: prefsText(p),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: prefsKeyboard(p) },
    })
    await answerCallbackQuery(cq.id, toast)
    return ok("prefs toggled")
  }

  // 📋 regbet:<pick_id> — tocou "Registrar no Betinho" no daily
  if (data.startsWith("regbet:")) {
    const pickId = data.slice("regbet:".length)
    const { data: pick } = await supabase
      .from("daily_opportunity_picks").select("id, bet_description, odds").eq("id", pickId).maybeSingle()
    if (!pick) {
      await answerCallbackQuery(cq.id, "Essa oportunidade expirou 🕑")
      return ok("regbet: pick not found")
    }
    const unit = await effectiveUnit(supabase, user.id)
    if (unit) {
      // COM unidade: atalhos de valor + "Outro valor" (que aí faz sentido)
      await telegramCall("sendMessage", {
        chat_id: chatId,
        text: `📋 Registrar <b>${escHtml(pick.bet_description)}</b> (odd ${Number(pick.odds)})\nQuanto você vai colocar?`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [
          [
            { text: `1 unidade · ${formatBRL(unit)}`, callback_data: `stk:${pickId}:u1` },
            { text: `½ unidade · ${formatBRL(unit / 2)}`, callback_data: `stk:${pickId}:uh` }
          ],
          [{ text: "Outro valor", callback_data: `stk:${pickId}:ot` }]
        ] }
      })
    } else {
      // SEM unidade: vai DIRETO pra pergunta (sem botão órfão, sem pergunta dupla)
      await sendStakePrompt(supabase, chatId, user.id, pickId,
        `📋 Registrar <b>${escHtml(pick.bet_description)}</b> (odd ${Number(pick.odds)})\nQuanto você colocou? Responde com o valor aqui 👇`)
    }
    await answerCallbackQuery(cq.id)
    return ok("regbet: asked stake")
  }

  // 💰 stk:<pick_id>:<u1|uh|ot> — escolha do valor
  if (data.startsWith("stk:")) {
    const [, pickId, code] = data.split(":")
    const { data: pick } = await supabase
      .from("daily_opportunity_picks").select("*").eq("id", pickId).maybeSingle()
    if (!pick) {
      await answerCallbackQuery(cq.id, "Essa oportunidade expirou 🕑")
      return ok("stk: pick not found")
    }

    // "Outro valor" → pergunta curta por force_reply (o "Registrar X — quanto?"
    // já foi mostrado com os botões; aqui não repete)
    if (code === "ot") {
      await sendStakePrompt(supabase, chatId, user.id, pickId, `Qual valor? Responde com o número aqui 👇`)
      await answerCallbackQuery(cq.id)
      return ok("stk: force reply")
    }

    const unit = await effectiveUnit(supabase, user.id)
    if (!unit) {
      await answerCallbackQuery(cq.id, "Configure sua unidade no site ou toque em Outro valor.")
      return ok("stk: no unit")
    }
    const stake = code === "uh" ? Math.round((unit / 2) * 100) / 100 : unit
    const { data: bet, error } = await registerPickBet(supabase, user.id, pick, stake)
    if (error || !bet) {
      await answerCallbackQuery(cq.id, "Deu ruim ao registrar — tenta de novo.")
      return ok("stk: insert failed")
    }
    const streakLine = await receiptStreakLineFor(supabase, user.id) // item 18 (flag-gated)
    await editSettledMessage(chatId, messageId, pickReceiptHtml(pick, stake, streakLine))
    await answerCallbackQuery(cq.id, "✅ Registrado!")
    await trackEvent(
      "opportunity_bet_registered",
      { bet_id: bet.id, pick_id: pickId, stake, via: "unit_button", channel: "telegram" },
      user.id, traceId
    ).catch(() => {})
    return ok("stk: registered")
  }

  // ↩️ fix:<bet_id> — desfaz a AUTO-liquidação (notify-settlement): volta pra
  // pendente e devolve os botões clássicos pro usuário dizer o resultado certo
  if (data.startsWith("fix:")) {
    const betId = data.slice("fix:".length)

    const { data: bet } = await supabase
      .from("bets")
      .select("id, user_id, status, bet_description, match_description, stake_amount, potential_return, processed_data")
      .eq("id", betId)
      .maybeSingle()

    if (!bet || bet.user_id !== user.id) {
      await answerCallbackQuery(cq.id, "Não achei essa aposta na sua conta.")
      return ok("fix: bet not found or not owner")
    }
    const REVERTIBLE = ["won", "lost", "void", "half_won", "half_lost"] // nunca cashout
    if (!REVERTIBLE.includes(bet.status)) {
      await answerCallbackQuery(cq.id, "Essa aposta não está mais liquidada 👍")
      return ok("fix: invalid status")
    }

    const pd = bet.processed_data && typeof bet.processed_data === "object" && !Array.isArray(bet.processed_data)
      ? bet.processed_data
      : {}
    const { error: fixErr } = await supabase
      .from("bets")
      .update({
        status: "pending",
        processed_data: {
          ...pd,
          auto_settle: { ...((pd as any).auto_settle ?? {}), corrected_at: new Date().toISOString() },
        },
      })
      .eq("id", betId)
      .in("status", ["won", "lost", "void", "half_won", "half_lost"]) // nunca reverte cashout

    if (fixErr) {
      await answerCallbackQuery(cq.id, "Deu ruim ao desfazer — tenta de novo.")
      return ok("fix: update failed")
    }

    await telegramCall("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: `↩️ Desfeito — voltou pra pendente.\n\n<b>${escHtml(bet.bet_description)}</b>${bet.match_description ? `\n${escHtml(bet.match_description)}` : ""}\n\nComo foi essa?`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Green", callback_data: `settle:${betId}:won` },
            { text: "❌ Red", callback_data: `settle:${betId}:lost` }
          ],
          [{ text: "Outras opções ↗", url: BETS_DASHBOARD_URL }]
        ]
      }
    })
    await answerCallbackQuery(cq.id, "↩️ Desfeito.")
    await trackEvent(
      "auto_settle_corrected",
      { bet_id: betId, previous_status: bet.status, channel: "telegram" },
      user.id,
      traceId
    ).catch(() => {})
    return ok("auto settle corrected")
  }

  // ✅/❌ settle:<bet_id>:<won|lost>
  if (data.startsWith("settle:")) {
    const [, betId, outcome] = data.split(":")
    if (!betId || (outcome !== "won" && outcome !== "lost")) {
      await answerCallbackQuery(cq.id, "Não entendi esse toque 🤔")
      return ok("bad callback data")
    }

    const { data: bet } = await supabase
      .from("bets")
      .select("id, user_id, status, bet_description, match_description, stake_amount, potential_return, odds, created_at, channel")
      .eq("id", betId)
      .maybeSingle()

    // dono confere? (callback vem do Telegram; a aposta TEM que ser deste usuário)
    if (!bet || bet.user_id !== user.id) {
      await answerCallbackQuery(cq.id, "Não achei essa aposta na sua conta.")
      return ok("bet not found or not owner")
    }

    if (bet.status !== "pending") {
      await answerCallbackQuery(cq.id, "Essa já estava registrada 👍")
      await editSettledMessage(chatId, messageId, settledHtml(bet, bet.status)).catch(() => {})
      return ok("already settled")
    }

    const { data: updated, error: updErr } = await supabase
      .from("bets")
      .update({ status: outcome })
      .eq("id", betId)
      .eq("status", "pending") // guarda otimista: dois toques ≠ duas liquidações
      .select()
      .maybeSingle()

    if (updErr || !updated) {
      await answerCallbackQuery(cq.id, "Deu ruim ao registrar — tenta de novo.")
      return ok("settle update failed")
    }

    await editSettledMessage(chatId, messageId, settledHtml(updated, outcome)).catch(() => {})
    await answerCallbackQuery(cq.id, outcome === "won" ? "✅ Green registrado!" : "❌ Red registrado.")
    await trackEvent(
      "settlement_settled_via_bot",
      { bet_id: betId, outcome, channel: "telegram" },
      user.id,
      traceId
    ).catch(() => {})
    // Evento canônico da métrica central de retenção (mesmo schema dos 4 caminhos da web em
    // Bets.tsx). O settlement_settled_via_bot acima fica por continuidade de histórico.
    await trackEvent(
      "bet_settled",
      {
        product: "betinho",
        channel: bet.channel ?? "telegram",
        status: outcome,
        days_to_settle: bet.created_at
          ? Math.round((Date.now() - new Date(bet.created_at).getTime()) / 86400000)
          : null,
        settled_by: "user_manual",
        via: "bot_reminder",
        batch: false,
        count: 1,
      },
      user.id,
      traceId
    ).catch(() => {})
    return ok("bet settled")
  }

  await answerCallbackQuery(cq.id).catch(() => {})
  return ok("unknown callback")
}

export { handleCallbackQuery }
