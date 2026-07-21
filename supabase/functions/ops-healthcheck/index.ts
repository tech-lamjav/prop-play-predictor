// ============================================================
// ops-healthcheck — vigia dos crons (Onda 2 da revisão do Betinho)
// ============================================================
// Cron diário (8h BRT; migration 088). Chama get_cron_health() e manda DM pro
// admin SÓ quando há problema — silêncio = tudo bem (mesma filosofia do produto).
//
// O que denuncia:
//   • cron cujo comando referencia vault secret que NÃO existe (o "cron mudo"
//     que já aconteceu 3x: kickoff, opportunities/fixtures, quase o weekly)
//   • cron com >= 3 falhas nas últimas 5 execuções
//
// Admin: ops_config['admin_telegram_chat_id'] (tabela, não env — auditável por
// SQL e sem depender de secret de função que ninguém confere).
//
// ?mode=report → só devolve o JSON (não manda DM). ?mode=test → manda uma DM
// de teste pro admin (valida o canal no ensaio).
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const FAIL_THRESHOLD = 3; // de 5 execuções recentes

interface JobHealth {
  jobname: string;
  active: boolean;
  missing_secrets: string[];
  failed_recent: number;
  total_recent: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function sendAdminDm(chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);
  const mode = new URL(req.url).searchParams.get("mode") || "alert";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  try {
    const { data: cfg } = await supabase
      .from("ops_config").select("value").eq("key", "admin_telegram_chat_id").maybeSingle();
    const adminChat: string | null = cfg?.value ?? null;

    if (mode === "test") {
      if (!adminChat) return json({ ok: false, motivo: "admin_telegram_chat_id não configurado em ops_config" }, 500);
      await sendAdminDm(adminChat, "🩺 ops-healthcheck: DM de teste — canal do admin funcionando.");
      return json({ ok: true, mode, sent: true });
    }

    const { data, error } = await supabase.rpc("get_cron_health");
    if (error) throw error;
    const jobs: JobHealth[] = data ?? [];

    const problems = jobs.filter(
      (j) => j.active && (j.missing_secrets.length > 0 || j.failed_recent >= FAIL_THRESHOLD)
    );

    if (mode !== "report" && problems.length > 0) {
      const lines = ["🚨 ops-healthcheck — crons com problema:", ""];
      for (const p of problems) {
        if (p.missing_secrets.length > 0) {
          lines.push(`• ${p.jobname}: SECRETS FALTANDO no vault → ${p.missing_secrets.join(", ")} (job roda mas não chama nada — o "cron mudo")`);
        }
        if (p.failed_recent >= FAIL_THRESHOLD) {
          lines.push(`• ${p.jobname}: ${p.failed_recent}/${p.total_recent} execuções recentes FALHARAM`);
        }
      }
      lines.push("", "Runbook: criar os secrets (vault.create_secret) ou investigar cron.job_run_details.");
      if (adminChat) {
        await sendAdminDm(adminChat, lines.join("\n"));
      } else {
        console.error("ops-healthcheck: problemas encontrados mas admin_telegram_chat_id não configurado:", JSON.stringify(problems));
      }
    }

    return json({
      ok: true,
      mode,
      jobs_total: jobs.length,
      problems: problems.map((p) => ({
        jobname: p.jobname,
        missing_secrets: p.missing_secrets,
        failed_recent: p.failed_recent,
        total_recent: p.total_recent,
      })),
      admin_configured: adminChat != null,
    });
  } catch (e) {
    console.error("ops-healthcheck error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
