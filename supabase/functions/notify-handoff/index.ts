// ============================================================
// notify-handoff — DM de encerramento do bolão (H1, dia da final)
// ============================================================
// One-shot MANUAL (sem cron!). No dia 19/jul, depois da final encerrar,
// o dev roda 2 vezes:
//
//   1. ?mode=report → NÃO envia nada. Lista quem receberia (chat, nome,
//                     posição em cada bolão). Revisar antes de mandar.
//   2. ?mode=send   → manda a DM única por usuário (idempotente via
//                     bolao_handoff_notifications).
//
// A DM: posição definitiva no(s) bolão(ões) + as duas portas de
// continuação — Betinho pro casual, análise de futebol pro frequente.
// Mesma copy do cartão do ranking (BolaoHandoffCard), formato Telegram.
//
// GUARDA: só envia se a FINAL estiver encerrada em wc_matches (o bolão
// precisa ter acabado de verdade). `&force=true` pula a guarda — só pra
// ensaio em staging.
//
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const BETINHO_URL = "https://www.smartbetting.app/betinho/bolao";
const FUTEBOL_URL = "https://www.smartbetting.app/futebol/comecar";

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface TargetRow {
  user_id: string;
  chat_id: string;
  user_name: string | null;
  bolao_name: string;
  user_rank: number;
  total_players: number;
}

interface UserTarget {
  user_id: string;
  chat_id: string;
  user_name: string | null;
  boloes: Array<{ name: string; rank: number; total: number }>;
}

// agrupa as linhas (usuário, bolão) → 1 alvo por usuário
function groupTargets(rows: TargetRow[]): UserTarget[] {
  const byUser = new Map<string, UserTarget>();
  for (const r of rows) {
    let t = byUser.get(r.user_id);
    if (!t) {
      t = { user_id: r.user_id, chat_id: r.chat_id, user_name: r.user_name, boloes: [] };
      byUser.set(r.user_id, t);
    }
    t.boloes.push({ name: r.bolao_name, rank: Number(r.user_rank), total: Number(r.total_players) });
  }
  return [...byUser.values()];
}

function buildMessage(t: UserTarget): string {
  const posicoes = t.boloes.slice(0, 2).map((b) => {
    const medalha = b.rank === 1 && b.total > 1 ? " 🏆" : b.rank <= 3 && b.total >= 3 ? " 🏅" : "";
    return `• <b>${esc(b.name)}</b>: ${b.rank}º de ${b.total}${medalha}`;
  });
  const extras = t.boloes.length > 2 ? `\n• e mais ${t.boloes.length - 2} ${t.boloes.length - 2 === 1 ? "bolão" : "bolões"}` : "";

  return [
    `🏆 <b>${esc(t.user_name || "E aí")}, a Copa acabou — e com ela o bolão!</b>`,
    "",
    `Seu resultado definitivo:`,
    posicoes.join("\n") + extras,
    "",
    `Valeu demais por jogar com a gente. E se você aposta de verdade, o jogo continua:`,
    "",
    `<b>Tá no lucro ou no prejuízo?</b> A maioria não sabe. Manda o print da aposta no Telegram e o Betinho te responde: lucro, ROI e onde você acerta — sem planilha.`,
    "",
    `<b>Onde vale apostar na próxima rodada?</b> A análise de futebol te mostra: as principais oportunidades de cada jogo, com os prós e contras de cada aposta — sem achismo.`,
  ].join("\n");
}

async function sendHandoffDm(t: UserTarget): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: t.chat_id,
      text: buildMessage(t),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [{ text: "Conhecer o Betinho — grátis", url: BETINHO_URL }],
          [{ text: "Conhecer a análise de futebol", url: FUTEBOL_URL }],
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Unauthorized" }, 401);
  if (!TELEGRAM_BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "report";
  const force = url.searchParams.get("force") === "true";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
  const traceId = generateTraceId();

  try {
    // guarda: a final precisa ter acabado (o bolão só morre quando ela morre)
    const { data: finalMatch, error: fErr } = await supabase
      .from("wc_matches")
      .select("id, is_finished")
      .eq("stage", "final")
      .maybeSingle();
    if (fErr) throw fErr;
    const finalOver = finalMatch?.is_finished === true;
    if (!finalOver && !force) {
      return json({ ok: false, error: "A final ainda não encerrou — use &force=true só em ensaio de staging." }, 412);
    }

    const { data: rows, error } = await supabase.rpc("get_handoff_targets");
    if (error) throw error;
    const targets = groupTargets((rows ?? []) as TargetRow[]);

    if (mode === "report") {
      return json({
        ok: true, mode, final_encerrada: finalOver, alvos: targets.length,
        preview: targets.map((t) => ({
          user_name: t.user_name,
          boloes: t.boloes.map((b) => `${b.name}: ${b.rank}º/${b.total}`),
        })),
      });
    }

    if (mode === "send") {
      let sent = 0;
      const errors: string[] = [];
      for (const t of targets) {
        try {
          await sendHandoffDm(t);
          const { error: insErr } = await supabase
            .from("bolao_handoff_notifications")
            .insert({ user_id: t.user_id, boloes_count: t.boloes.length });
          if (insErr) throw insErr;
          sent++;
          await trackEvent(
            "bolao_handoff_dm_sent",
            {
              boloes_count: t.boloes.length,
              best_rank: Math.min(...t.boloes.map((b) => b.rank)),
              channel: "telegram",
            },
            t.user_id, traceId
          ).catch(() => {});
        } catch (e) {
          errors.push(`${t.user_id}: ${(e as Error)?.message}`);
        }
      }
      return json({ ok: true, mode, alvos: targets.length, sent, errors });
    }

    return json({ error: `mode inválido: ${mode} (use report|send)` }, 400);
  } catch (e) {
    console.error("notify-handoff error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
