// shared/runs.ts — telemetria dos carteiros (Onda 4).
// Grava o resumo do run em public.message_runs (migration 089). O consumidor
// é o ops-healthcheck: 3 runs consecutivos ok=false → DM pro admin.
// Telemetria NUNCA quebra o run — qualquer erro aqui é engolido.

export async function logMessageRun(
  supabase: any,
  fn: string,
  r: { candidates?: number; sent?: number; errors?: unknown[]; ok: boolean }
): Promise<void> {
  try {
    await supabase.from("message_runs").insert({
      fn,
      candidates: r.candidates ?? null,
      sent: r.sent ?? null,
      errors: r.errors && r.errors.length > 0 ? r.errors : null,
      ok: r.ok,
    });
  } catch (e) {
    console.error(`logMessageRun(${fn}):`, (e as Error)?.message);
  }
}
