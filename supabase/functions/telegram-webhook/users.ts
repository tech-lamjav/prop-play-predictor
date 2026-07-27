// ============================================================
// users.ts — vínculo Telegram↔conta (lookup por chat/telefone)
// ============================================================
// Extraído de index.ts na Onda 6b da revisão (split mecânico, move-only).
import { normalizePhoneCandidates, maskPhone } from "../shared/phone.ts"

async function findUserByTelegram(
  supabase: any,
  telegramUserId?: string,
  chatId?: string,
  traceId?: string
): Promise<{ id: string; name?: string | null; telegram_chat_id?: string | null; whatsapp_number?: string | null } | null> {
  if (!telegramUserId && !chatId) {
    console.log("daily_limit_user_resolution_missing_ids", {
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      trace_id: traceId
    })
    return null
  }

  const ors: string[] = []
  if (chatId) ors.push(`telegram_chat_id.eq.${chatId}`)
  if (telegramUserId) ors.push(`telegram_user_id.eq.${telegramUserId}`)

  if (ors.length === 0) {
    console.log("daily_limit_user_resolution_no_conditions", {
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      trace_id: traceId
    })
    return null
  }

  console.log("daily_limit_user_resolution_start", {
    telegram_user_id: telegramUserId,
    chat_id: chatId,
    trace_id: traceId,
    query_conditions: ors.join(",")
  })

  const { data, error } = await supabase
    .from("users")
    .select("id, name, telegram_chat_id, whatsapp_number")
    .or(ors.join(","))
    .limit(1)
    .maybeSingle()

  if (error) {
    console.log("daily_limit_user_resolution_error", {
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      trace_id: traceId,
      error: JSON.stringify(error)
    })
    return null
  }

  if (!data) {
    console.log("daily_limit_user_resolution_not_found", {
      telegram_user_id: telegramUserId,
      chat_id: chatId,
      trace_id: traceId
    })
    return null
  }

  console.log("daily_limit_user_resolution_success", {
    telegram_user_id: telegramUserId,
    chat_id: chatId,
    resolved_user_id: data.id,
    trace_id: traceId
  })

  return data
}

async function findUserByPhone(supabase: any, phone: string): Promise<any | null> {
  if (!phone) return null
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

export { findUserByTelegram, findUserByPhone }
