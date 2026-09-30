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
import { avisoDoPorteiro, failingStreaks, flakyFns, type RunRow } from "./health.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const FAIL_THRESHOLD = 3; // de 5 execuções recentes
const RUNS_WINDOW_H = 48;  // janela de message_runs lida a cada check

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

    // Onda 4: carteiros com streak de falha (message_runs, migration 089).
    // O cron pode dizer "succeeded" (o http_post saiu) e a FUNÇÃO ter falhado —
    // esta é a visão de dentro.
    // Janela por TEMPO, não por contagem: com "limit(60)" fixo, uma função
    // tagarela (o notify-published-opportunities grava todo run, de 10 em 10
    // min) empurrava as demais para fora da amostra e escondia falha alheia.
    const { data: runData } = await supabase
      .from("message_runs")
      .select("fn, ok, ran_at")
      .gte("ran_at", new Date(Date.now() - RUNS_WINDOW_H * 3_600_000).toISOString())
      .order("ran_at", { ascending: false })
      .limit(1000);
    const runs = (runData ?? []) as RunRow[];
    const failingFns = failingStreaks(runs, FAIL_THRESHOLD);
    const flaky = flakyFns(runs).filter((f) => !failingFns.includes(f.fn));

    // ── O porteiro que parou de saber de onde as pessoas vêm (#554) ────────
    //
    // A contagem sai do registro de presença, e não do log da função: log não
    // se consulta por SQL, e o que precisa ser vigiado é justamente o que fica
    // gravado. Efeito colateral aceito: visitante deslogado não gera linha, e
    // portanto não entra nesta conta — o sinal cobre quem tem conta, que é
    // quem a evidência fiscal precisa descrever.
    const desde = new Date(Date.now() - RUNS_WINDOW_H * 3_600_000).toISOString();
    const [{ count: totalPresenca }, { count: naoSeiPresenca }, cfgBloqueio, cfgLimite] =
      await Promise.all([
        supabase
          .from("registro_de_presenca")
          .select("*", { count: "exact", head: true })
          .gte("criado_em", desde),
        supabase
          .from("registro_de_presenca")
          .select("*", { count: "exact", head: true })
          .gte("criado_em", desde)
          .eq("origem", "nao_sei"),
        supabase.from("ops_config").select("value").eq("key", "bloqueio_brasil_ligado").maybeSingle(),
        supabase.from("ops_config").select("value").eq("key", "porteiro_nao_sei_minimo").maybeSingle(),
      ]);

    const limite = Number(cfgLimite.data?.value);
    const avisoPorteiro = avisoDoPorteiro(
      { naoSei: naoSeiPresenca ?? 0, total: totalPresenca ?? 0 },
      {
        bloqueioLigado: cfgBloqueio.data?.value === "sim",
        // Valor inválido na tabela cai no padrão do módulo em vez de virar NaN
        // — um limite NaN nunca dispara, e o aviso morreria calado.
        minimo: Number.isFinite(limite) && limite > 0 ? limite : undefined,
      },
    );

    if (
      mode !== "report" &&
      (problems.length > 0 || failingFns.length > 0 || flaky.length > 0 || avisoPorteiro)
    ) {
      const lines = ["🚨 ops-healthcheck — problemas encontrados:", ""];
      for (const p of problems) {
        if (p.missing_secrets.length > 0) {
          lines.push(`• ${p.jobname}: SECRETS FALTANDO no vault → ${p.missing_secrets.join(", ")} (job roda mas não chama nada — o "cron mudo")`);
        }
        if (p.failed_recent >= FAIL_THRESHOLD) {
          lines.push(`• ${p.jobname}: ${p.failed_recent}/${p.total_recent} execuções recentes FALHARAM (cron)`);
        }
      }
      for (const fn of failingFns) {
        lines.push(`• ${fn}: últimos ${FAIL_THRESHOLD} runs da FUNÇÃO falharam EM SEQUÊNCIA (message_runs) — quebrada`);
      }
      for (const f of flaky) {
        lines.push(`• ${f.fn}: ${f.failures} de ${f.total} runs falharam nas últimas 24h (message_runs) — intermitente, não quebrada`);
      }
      if (avisoPorteiro) {
        const pct = Math.round(avisoPorteiro.proporcao * 100);
        lines.push(
          `• porteiro: ${avisoPorteiro.naoSei} de ${avisoPorteiro.total} acessos das últimas ${RUNS_WINDOW_H}h sem origem conhecida (${pct}%) — o bloqueio está DEIXANDO ENTRAR quem não consegue identificar`,
        );
      }
      // Runbook sob medida: a linha fixa de antes mandava caçar secret em
      // incidente que não tinha secret nenhum envolvido.
      const dicas: string[] = [];
      if (problems.some((p) => p.missing_secrets.length > 0)) dicas.push("secret faltando → vault.create_secret");
      if (problems.some((p) => p.failed_recent >= FAIL_THRESHOLD)) dicas.push("falha de cron → cron.job_run_details");
      if (failingFns.length > 0 || flaky.length > 0) dicas.push("falha de função → message_runs.errors");
      if (avisoPorteiro) dicas.push("porteiro cego → logs da função porteiro, cabeçalho cf-connecting-ip");
      if (dicas.length > 0) lines.push("", `Runbook: ${dicas.join(" · ")}.`);
      if (adminChat) {
        await sendAdminDm(adminChat, lines.join("\n"));
      } else {
        console.error("ops-healthcheck: problemas encontrados mas admin_telegram_chat_id não configurado:", JSON.stringify({ problems, failingFns }));
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
      failing_message_fns: failingFns,
      flaky_message_fns: flaky,
      porteiro: avisoPorteiro,
      admin_configured: adminChat != null,
    });
  } catch (e) {
    console.error("ops-healthcheck error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
