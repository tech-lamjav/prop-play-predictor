// ============================================================
// shared/streak.ts — Sequência de disciplina (item 18, Marco 2)
// ============================================================
// REGRA DE OURO (decisão de produto 2026-07-21, anti-LC224): o streak mede
// DISCIPLINA DE REGISTRO, não frequência de aposta. Dia sem aposta é NEUTRO
// (descansar não pune — streak nunca empurra "aposte todo dia"). Exceção
// anti-streak-eterno: mais de GAP_MAX_DAYS dias vazios seguidos = recomeço
// ("descansos de até uma semana não quebram").
//
// Aparece SÓ embutido em mensagens existentes (recibos em milestone; resumo
// semanal com streak >= 5 e nunca na semana negativa). Ligado por flag
// ops_config['streak_enabled'] — nasce DESLIGADO até o resumo (04) provar
// tração em prod (gate do roadmap).
//
// Parte pura testada no CI: tests/streak.test.ts (atenção à fronteira de dia
// BRT: aposta 23h30 BRT = 02h30 UTC do dia seguinte).

export const MILESTONES = [5, 10, 20, 30, 50, 100];
export const GAP_MAX_DAYS = 7;   // dias vazios tolerados entre dias-com-aposta
export const WEEKLY_MIN = 5;     // resumo só mostra streak a partir daqui
const BRT = "America/Sao_Paulo";

// dia-calendário BRT (YYYY-MM-DD) de um timestamp
export function brtDay(d: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BRT }).format(new Date(d));
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

export interface StreakInfo {
  days: number;           // dias-com-aposta consecutivos (gap <= GAP_MAX_DAYS)
  firstBetOfDay: boolean; // a aposta mais recente é a 1ª do dia? (anti-repetição de milestone)
}

// betDates: bet_date de TODAS as apostas recentes do usuário (inclui a recém-criada,
// quando chamado do recibo). now: referência de "hoje".
export function computeStreak(betDates: (string | Date)[], now: Date = new Date()): StreakInfo {
  if (betDates.length === 0) return { days: 0, firstBetOfDay: false };
  const today = brtDay(now);
  const dayList = betDates.map(brtDay);
  const todayCount = dayList.filter((d) => d === today).length;
  const distinct = [...new Set(dayList)].sort().reverse(); // mais recente primeiro

  // vivacidade: último dia-com-aposta longe demais de hoje → sequência morta
  if (dayDiff(today, distinct[0]) > GAP_MAX_DAYS) return { days: 0, firstBetOfDay: false };

  let days = 1;
  for (let i = 1; i < distinct.length; i++) {
    const emptyBetween = dayDiff(distinct[i - 1], distinct[i]) - 1;
    if (emptyBetween > GAP_MAX_DAYS) break;
    days++;
  }
  return { days, firstBetOfDay: todayCount === 1 };
}

// milestone alcançado AGORA (só na 1ª aposta do dia — não repete no mesmo dia)
export function milestoneReached(s: StreakInfo): number | null {
  return s.firstBetOfDay && MILESTONES.includes(s.days) ? s.days : null;
}

// linha do recibo (texto puro — funciona em Markdown e HTML). Celebra CONTROLE.
export function receiptStreakLine(s: StreakInfo): string | null {
  const m = milestoneReached(s);
  return m ? `🔥 ${m}º dia seguido com a banca em dia` : null;
}

// linha do resumo semanal (HTML). null abaixo do patamar — e o chamador NUNCA
// mostra na semana negativa (mesma régua do "melhor mercado").
export function weeklyStreakLine(days: number | null): string | null {
  if (days == null || days < WEEKLY_MIN) return null;
  return `🔥 Sequência viva: <b>${days} dias</b> de banca em dia`;
}

// ── IO (flag + busca) ────────────────────────────────────────
export async function isStreakEnabled(supabase: any): Promise<boolean> {
  const { data } = await supabase.from("ops_config").select("value").eq("key", "streak_enabled").maybeSingle();
  return data?.value === "true";
}

export async function getStreak(supabase: any, userId: string, now: Date = new Date()): Promise<StreakInfo> {
  const { data } = await supabase
    .from("bets")
    .select("bet_date")
    .eq("user_id", userId)
    .gte("bet_date", new Date(now.getTime() - 120 * 86_400_000).toISOString())
    .limit(2000);
  return computeStreak((data ?? []).map((r: any) => r.bet_date), now);
}

// atalho pros recibos: flag + busca + milestone numa chamada (null = nada a mostrar)
export async function receiptStreakLineFor(supabase: any, userId: string): Promise<string | null> {
  try {
    if (!(await isStreakEnabled(supabase))) return null;
    return receiptStreakLine(await getStreak(supabase, userId));
  } catch (_) {
    return null; // streak NUNCA quebra um recibo
  }
}
