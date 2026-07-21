// ============================================================
// telegram-webhook — roteador de updates do bot (Onda 6b: modularizado)
// ============================================================
// index.ts é o ROTEADOR: auth do webhook, dedupe de update_id e o fluxo de
// mensagem (onboarding link_, /comandos, interceptador de valor, registro de
// aposta). O resto vive em módulos:
//   config.ts (env/constantes) · types.ts · telegram-api.ts (chamadas/copy)
//   callbacks.ts (todos os botões) · picks.ts (item 15) · extraction.ts
//   (pipeline LLM + limites) · users.ts (vínculo) · stake.ts/prefs.ts (puros)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import { maskPhone } from "../shared/phone.ts"
import { generateTraceId, identifyUser, trackEvent } from "../shared/posthog.ts"
import { isBareNumber, parseStake } from "./stake.ts"
import { prefsKeyboard, prefsText } from "./prefs.ts"
import { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET } from "./config.ts"
import type { TelegramMessage, TelegramCallbackQuery } from "./types.ts"
import {
  sendTelegramMessage, getTelegramFileUrl, sendContactRequest, sendWelcomeMessageTelegram,
} from "./telegram-api.ts"
import { registerPickBet, pickReceiptHtml } from "./picks.ts"
import { receiptStreakLineFor } from "../shared/streak.ts"
import { handleCallbackQuery } from "./callbacks.ts"
import { transcribeAudio, processImage, processMessage } from "./extraction.ts"
import { findUserByTelegram, findUserByPhone } from "./users.ts"


// Simple in-memory guard to avoid reprocessing the same update_id on retries
const processedUpdateIds = new Set<number>()

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

    // Toque em botão inline (lembrete de liquidação) — trata e sai antes do fluxo
    // de mensagem. Requer setWebhook com allowed_updates incluindo callback_query.
    if (payload.callback_query) {
      const cbSupabaseUrl = Deno.env.get("SUPABASE_URL")
      const cbServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      if (!cbSupabaseUrl || !cbServiceKey) {
        console.error("Missing Supabase configuration (callback_query)")
        return new Response(
          JSON.stringify({ success: false, error: "Server configuration error" }),
          { headers: { "Content-Type": "application/json" }, status: 500 }
        )
      }
      return await handleCallbackQuery(
        createClient(cbSupabaseUrl, cbServiceKey),
        payload.callback_query as TelegramCallbackQuery,
        generateTraceId()
      )
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration")
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      )
    }

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

    // Handle /start force_contact (explicit resync flow from Settings)
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/)
      const param = parts[1]
      if (param === "force_contact") {
        await sendContactRequest(chatId)
        const telegramUserId = fromUser?.id ? String(fromUser.id) : undefined
        await trackEvent(
          "telegram_start_force_contact",
          { chat_id: String(chatId), telegram_user_id: telegramUserId, channel: "telegram" },
          telegramUserId || "unknown",
          traceId
        ).catch(() => {})
        return new Response(
          JSON.stringify({ success: true, message: "Contact requested via /start" }),
          { headers: { "Content-Type": "application/json" }, status: 200 }
        )
      }

      // Deep-link de vínculo (onboarding redesign): /start link_<token>.
      // Vincula por chat_id via token de uso único — sem matching por telefone,
      // que gerava beco quando o nº do Telegram ≠ nº do cadastro.
      // O fluxo de contato logo abaixo permanece como fallback.
      if (param && param.startsWith("link_")) {
        const token = param.slice("link_".length)
        const { data: tok } = await supabase
          .from("telegram_link_tokens")
          .select("token, user_id, expires_at, used_at")
          .eq("token", token)
          .maybeSingle()

        if (!tok || tok.used_at || new Date(tok.expires_at).getTime() < Date.now()) {
          await sendTelegramMessage(chatId, "Esse link de conexão expirou. Volte ao site e clique em *Conectar meu Telegram* de novo — ou vincule pelo número abaixo.")
          await sendContactRequest(chatId)
          return new Response(
            JSON.stringify({ success: true, message: "Link token invalid or expired" }),
            { headers: { "Content-Type": "application/json" }, status: 200 }
          )
        }

        const { error: linkErr } = await supabase
          .from("users")
          .update({
            telegram_chat_id: String(chatId),
            telegram_user_id: fromUser?.id ? String(fromUser.id) : null,
            telegram_synced_at: new Date().toISOString(),
            telegram_sync_source: "deep_link"
          })
          .eq("id", tok.user_id)

        if (linkErr) {
          console.error("deep_link_sync_failed", { user_id: tok.user_id, error: linkErr.message })
          await sendTelegramMessage(chatId, "Não consegui vincular sua conta agora — volte ao site e tente de novo.")
          return new Response(
            JSON.stringify({ success: true, error: "Deep link update failed" }),
            { headers: { "Content-Type": "application/json" }, status: 200 }
          )
        }

        await supabase
          .from("telegram_link_tokens")
          .update({ used_at: new Date().toISOString() })
          .eq("token", token)

        await identifyUser(tok.user_id, {
          name: fromUser?.first_name || undefined
        }).catch(() => {})

        await sendWelcomeMessageTelegram(chatId, fromUser?.first_name || undefined)
        await trackEvent(
          "telegram_sync_success",
          { user_id: tok.user_id, chat_id: String(chatId), channel: "telegram", sync_source: "deep_link" },
          tok.user_id,
          traceId
        ).catch(() => {})

        return new Response(
          JSON.stringify({ success: true, message: "Telegram linked via deep link" }),
          { headers: { "Content-Type": "application/json" }, status: 200 }
        )
      }
    }

    // Handle contact sync first
    if (updateMessage.contact) {
      const contactPhone = updateMessage.contact.phone_number
      if (!contactPhone) {
        console.log('contact_received_no_phone', { chat_id: chatId })
        await sendTelegramMessage(chatId, "Não consegui identificar seu número de telefone. Tente novamente.")
        return new Response(
          JSON.stringify({ success: true, error: "Contact without phone" }),
          { headers: { "Content-Type": "application/json" }, status: 200 }
        )
      }
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
            { user_id: userMatch.id, chat_id: chatId, phone: contactPhone, channel: "telegram", sync_source: "contact_share" },
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
    const user = await findUserByTelegram(supabase, telegramUserId, String(chatId), traceId)

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

    console.log("daily_limit_user_mapped", {
      telegram_user_id: telegramUserId,
      chat_id: String(chatId),
      resolved_user_id: user.id,
      trace_id: traceId
    })

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

    // Preferência dos lembretes de liquidação (par do botão 🔕 do notify-settlement)
    const command = text.trim().toLowerCase()
    if (command === "/silenciar" || command === "/lembretes") {
      const mute = command === "/silenciar"
      await supabase.from("users").update({ settlement_reminders_muted: mute }).eq("id", user.id)
      await sendTelegramMessage(
        chatId,
        mute
          ? "🔕 Beleza — parei com os lembretes de liquidação. Pra voltar, é só mandar /lembretes."
          : "🔔 Lembretes reativados! Quando um jogo seu terminar, eu te chamo aqui pra fechar a aposta."
      )
      await trackEvent(
        mute ? "settlement_reminders_muted" : "settlement_reminders_unmuted",
        { via: "command", channel: "telegram" },
        user.id,
        traceId
      ).catch(() => {})
      return new Response(
        JSON.stringify({ success: true, message: "Reminder preference updated" }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    }

    // /resumo — toggle do resumo semanal (par do botão "Silenciar resumo")
    if (command === "/resumo") {
      const { data: pref } = await supabase
        .from("users").select("weekly_summary_muted").eq("id", user.id).maybeSingle()
      const mute = !(pref?.weekly_summary_muted ?? false)
      await supabase.from("users").update({ weekly_summary_muted: mute }).eq("id", user.id)
      await sendTelegramMessage(
        chatId,
        mute
          ? "Ok — parei com o resumo semanal. Pra voltar, é só mandar /resumo de novo."
          : "📊 Resumo semanal reativado! Toda segunda de manhã eu te mando como fecharam seus últimos 7 dias."
      )
      await trackEvent(
        mute ? "weekly_summary_muted" : "weekly_summary_unmuted",
        { via: "command", channel: "telegram" },
        user.id,
        traceId
      ).catch(() => {})
      return new Response(
        JSON.stringify({ success: true, message: "Weekly summary preference updated" }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    }

    // /mensagens — centro de controle: o que o Betinho manda + toggles num
    // lugar só (Onda 6 da revisão; embrião do item 17 do Marco 2)
    if (command === "/mensagens") {
      const { data: pref } = await supabase
        .from("users").select("settlement_reminders_muted, weekly_summary_muted").eq("id", user.id).maybeSingle()
      const p = {
        settlementMuted: pref?.settlement_reminders_muted ?? false,
        weeklyMuted: pref?.weekly_summary_muted ?? false,
      }
      await sendTelegramMessage(chatId, prefsText(p), {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: prefsKeyboard(p) },
      })
      await trackEvent("message_prefs_viewed", { channel: "telegram" }, user.id, traceId).catch(() => {})
      return new Response(
        JSON.stringify({ success: true, message: "Prefs shown" }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      )
    }

    // Resposta ao "Outro valor" (force_reply do registrar-oportunidade).
    // ROBUSTO: nem todo cliente Telegram anexa reply_to_message ao force_reply,
    // então intercepta se (a) é reply ao nosso prompt OU (b) é um NÚMERO PURO
    // logo após um prompt recente pendente. Um registro de aposta real nunca é
    // só um número → não há risco de sequestrar aposta de verdade.
    {
      const { data: prompt } = await supabase
        .from("stake_prompts")
        .select("pick_id, message_id, created_at")
        .eq("chat_id", String(chatId))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (prompt) {
        const replyToId = updateMessage.reply_to_message?.message_id
        const isReply = replyToId != null && Number(replyToId) === Number(prompt.message_id)
        const bareNumber = isBareNumber(text)
        const fresh = Date.now() - new Date(prompt.created_at).getTime() < 30 * 60_000
        if (isReply || (bareNumber && fresh)) {
          const stake = parseStake(text)
          if (stake == null) {
            await sendTelegramMessage(chatId, "Não entendi o valor 🤔 Manda só o número, ex: 50")
            return new Response(JSON.stringify({ success: true, message: "stake reply invalid" }), { headers: { "Content-Type": "application/json" }, status: 200 })
          }
          // consome o prompt antes de registrar (um número não vira duas apostas)
          await supabase.from("stake_prompts").delete().eq("chat_id", String(chatId)).eq("message_id", prompt.message_id)
          const { data: pick } = await supabase
            .from("daily_opportunity_picks").select("*").eq("id", prompt.pick_id).maybeSingle()
          if (pick) {
            const { data: bet, error } = await registerPickBet(supabase, user.id, pick, stake)
            if (error || !bet) {
              await sendTelegramMessage(chatId, "Deu ruim ao registrar — tenta de novo.")
            } else {
              const streakLine = await receiptStreakLineFor(supabase, user.id) // item 18 (flag-gated)
              await sendTelegramMessage(chatId, pickReceiptHtml(pick, stake, streakLine), { parse_mode: "HTML", disable_web_page_preview: true })
              await trackEvent(
                "opportunity_bet_registered",
                { bet_id: bet.id, pick_id: prompt.pick_id, stake, via: isReply ? "force_reply" : "bare_number", channel: "telegram" },
                user.id, traceId
              ).catch(() => {})
            }
          }
          return new Response(JSON.stringify({ success: true, message: "stake reply handled" }), { headers: { "Content-Type": "application/json" }, status: 200 })
        }

        // Não foi resposta de valor válida. A pergunta pendente não pode ficar
        // "esperando" e grudar num número futuro — então limpa aqui.
        await supabase.from("stake_prompts").delete().eq("chat_id", String(chatId))

        if (bareNumber) {
          // número puro, mas o prompt esfriou (>30min): não vira aposta-lixo —
          // avisa e encerra (não segue pro fluxo de extração)
          // reaquecimento (Onda 6): reenvia o botão do pick aqui mesmo — sem
          // obrigar o usuário a rolar o histórico atrás do Registrar original
          await sendTelegramMessage(chatId, "Essa oportunidade esfriou 🕑 Se ainda quiser registrar, toca abaixo que eu te pergunto o valor de novo.", {
            reply_markup: { inline_keyboard: [[{ text: "📋 Registrar de novo", callback_data: `regbet:${prompt.pick_id}` }]] },
          })
          return new Response(JSON.stringify({ success: true, message: "stale stake prompt cleared" }), { headers: { "Content-Type": "application/json" }, status: 200 })
        }
        // qualquer outra coisa (print, aposta em texto...) → pendência limpa e
        // a mensagem SEGUE o fluxo normal de registro (sem return)
      }
    }

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
  } catch (error: any) {
    console.error("Error in Telegram webhook:", error)
    return new Response(JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }), { headers: { "Content-Type": "application/json" }, status: 500 })
  }
})


