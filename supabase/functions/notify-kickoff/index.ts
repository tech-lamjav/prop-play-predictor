// ============================================================
// notify-kickoff — aviso de kickoff no Telegram do dono do bolão
// ============================================================
// Job de cron (não user-facing). Roda nos minutos :00 e :30. Para cada jogo que
// começou na última janela, em cada bolão com opt-in (kickoff_notify_telegram) e
// dono com Telegram linkado, envia uma DM ao dono com os palpites de todos os
// membros (placar + quem avança no mata-mata + campeão). Idempotente via tabela
// bolao_kickoff_notifications.
//
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

const STAGE_LABEL: Record<string, string> = {
  group: "Fase de grupos",
  round_of_32: "16 avos",
  round_of_16: "Oitavas",
  quarter: "Quartas",
  semi: "Semifinais",
  third_place: "3º lugar",
  final: "Final",
};

// Escapa o que vai no HTML do Telegram (nomes de usuário/seleção podem ter < & >).
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

interface DueRow {
  bolao_id: string;
  bolao_name: string;
  match_id: number;
  owner_chat_id: string;
  stage: string;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
}
interface PickRow {
  user_name: string;
  predicted_home: number | null;
  predicted_away: number | null;
  champion_code: string | null;
  advance_code: string | null;
}

function buildMessage(row: DueRow, picks: PickRow[]): string {
  const stageLabel = STAGE_LABEL[row.stage] ?? row.stage;
  const isKnockout = row.stage !== "group";

  const lines = picks.map((p) => {
    const placar =
      p.predicted_home != null && p.predicted_away != null
        ? `${p.predicted_home} x ${p.predicted_away}`
        : "não palpitou";
    const parts = [`• ${esc(p.user_name)} — ${esc(placar)}`];
    if (isKnockout && p.advance_code) parts.push(`avança: ${esc(p.advance_code)}`);
    if (p.champion_code) parts.push(`🏆 ${esc(p.champion_code)}`);
    return parts.join("  ·  ");
  });

  const body = lines.length ? lines.join("\n") : "Ninguém no bolão ainda.";
  return (
    `🏁 <b>Vai começar!</b> · ${esc(stageLabel)}\n` +
    `${esc(row.home_team)} x ${esc(row.away_team)}\n` +
    `<i>${esc(row.bolao_name)}</i>\n\n` +
    `<b>Palpites (já travados):</b>\n${body}\n\n` +
    `Boa sorte! 🍀`
  );
}

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (!cronSecret || provided !== cronSecret) return json({ error: "Unauthorized" }, 401);
  if (!TELEGRAM_BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  try {
    const { data: due, error: dueErr } = await supabase.rpc("get_due_kickoff_notifications");
    if (dueErr) throw dueErr;

    const rows: DueRow[] = due ?? [];
    let sent = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const { data: picks, error: pErr } = await supabase.rpc("get_bolao_match_picks", {
          p_bolao_id: row.bolao_id,
          p_match_id: row.match_id,
        });
        if (pErr) throw pErr;

        await sendTelegramMessage(row.owner_chat_id, buildMessage(row, (picks ?? []) as PickRow[]));

        // Marca como notificado só após enviar (evita reenvio em runs futuros).
        const { error: insErr } = await supabase
          .from("bolao_kickoff_notifications")
          .insert({ bolao_id: row.bolao_id, match_id: row.match_id });
        if (insErr) throw insErr;
        sent++;
      } catch (e) {
        console.error(`notify ${row.bolao_id}/${row.match_id}:`, (e as Error)?.message);
        errors.push(`${row.bolao_id}/${row.match_id}: ${(e as Error)?.message}`);
      }
    }

    return json({ ok: true, due: rows.length, sent, errors });
  } catch (e) {
    console.error("notify-kickoff error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
