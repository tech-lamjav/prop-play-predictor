import { useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolTeamProfile, useFutebolTeamSeason, useFutebolStandings, useFutebolFixtures } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import type { Competition, FutebolScopeResult, FutebolScopeStats } from '@/services/futebol-data.service';

// Paleta do mockup (espelha theme-bolao)
const C = {
  forest: '#0a3d2e',
  ink: '#1a1d1a',
  ink2: '#4a4f48',
  ink3: '#8a8f86',
  line: '#e3e6e0',
  lineSoft: '#eef0ec',
  lineSoft2: '#f4f5f2',
  rose: '#be123c',
  greenBg: '#dcefe2', greenFg: '#0a3d2e',
  roseBg: '#fbe3e8', roseFg: '#be123c',
};

const COMP_LABEL: Record<string, string> = { brasileirao: 'Brasileirão Série A', copa_mundo: 'Copa do Mundo' };
const SCOPE_ORDER = ['geral', 'casa', 'fora'] as const;
const FINISHED = new Set(['FT', 'AET', 'PEN']);
const CARD = 'rounded-2xl overflow-hidden bg-white border border-line';

function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}

function Crest({ name, id, size = 28 }: { name: string; id: number | null | undefined; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = id ? getFutebolTeamLogoUrl(id) : null;
  if (logo && !err) {
    return <img src={logo} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain shrink-0" loading="lazy" />;
  }
  return (
    <div style={{ width: size, height: size, fontSize: size <= 24 ? 9 : size <= 40 ? 11 : 18 }}
      className="rounded-full bg-canvas-2 border border-line grid place-items-center font-bold text-ink-2 shrink-0">
      {crestInitials(name)}
    </div>
  );
}

// Forma do time (W/D/L da API) renderizada como V/E/D
function FormDots({ form, size = 16 }: { form: string; size?: number }) {
  const map: Record<string, { letter: string; bg: string }> = {
    W: { letter: 'V', bg: C.forest },
    D: { letter: 'E', bg: C.ink3 },
    L: { letter: 'D', bg: C.rose },
  };
  const last = form.slice(-5).split('');
  return (
    <span className="inline-flex items-center gap-1">
      {last.map((r, i) => {
        const m = map[r] || { letter: r, bg: C.ink3 };
        return (
          <span key={i} className="inline-flex items-center justify-center font-bold text-white"
            style={{ width: size, height: size, borderRadius: 4, fontSize: size <= 13 ? 8 : 9, background: m.bg }}>
            {m.letter}
          </span>
        );
      })}
    </span>
  );
}

function fmtAvg(v: number | null | undefined, pct = false): string {
  if (v == null) return '—';
  return `${v}${pct ? '%' : ''}`;
}

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '');
}

// Sequência corrente a partir do fim da string de forma (mais recente = último char)
function trailingStreak(form: string | null | undefined, keep: (c: string) => boolean): number {
  if (!form) return 0;
  let n = 0;
  for (let i = form.length - 1; i >= 0; i--) {
    if (keep(form[i])) n++; else break;
  }
  return n;
}

export default function FutebolTime() {
  const { teamId } = useParams<{ teamId: string }>();
  const [params] = useSearchParams();
  const competition = (params.get('c') as Competition) || 'brasileirao';
  const season = Number(params.get('s')) || 2026;
  const tid = teamId ? Number(teamId) : undefined;

  const { data: profile, isLoading, isError } = useFutebolTeamProfile(tid, competition, season);
  const { data: raiox } = useFutebolTeamSeason(tid, competition, season);
  const { data: standings } = useFutebolStandings(competition, season, !!tid);
  const { data: fixtures } = useFutebolFixtures(competition, season);

  const stand = useMemo(() => (standings || []).find((s) => s.team_id === tid), [standings, tid]);

  const results = useMemo(() =>
    (profile?.results || []).slice().sort((a, b) => SCOPE_ORDER.indexOf(a.scope as never) - SCOPE_ORDER.indexOf(b.scope as never)),
    [profile]);
  const stats = useMemo(() =>
    (profile?.stats_avg || []).slice().sort((a, b) => SCOPE_ORDER.indexOf(a.scope as never) - SCOPE_ORDER.indexOf(b.scope as never)),
    [profile]);

  const byScope = (scope: string) => ({
    r: results.find((x) => x.scope === scope) as FutebolScopeResult | undefined,
    s: stats.find((x) => x.scope === scope) as FutebolScopeStats | undefined,
  });
  const geral = byScope('geral');

  // Médias por mando
  const medias = useMemo(() => {
    const row = (label: string, pick: (sc: string) => number | null | undefined, pct = false) => ({
      label, pct,
      geral: pick('geral'), casa: pick('casa'), fora: pick('fora'),
    });
    return [
      row('Gols marcados', (sc) => sc === 'geral' ? raiox?.goals_for_avg_total : sc === 'casa' ? raiox?.goals_for_avg_home : raiox?.goals_for_avg_away),
      row('Gols sofridos', (sc) => sc === 'geral' ? raiox?.goals_against_avg_total : sc === 'casa' ? raiox?.goals_against_avg_home : raiox?.goals_against_avg_away),
      row('Posse de bola', (sc) => byScope(sc).s?.avg_possession, true),
      row('Finalizações', (sc) => byScope(sc).s?.avg_shots),
      row('Escanteios', (sc) => byScope(sc).s?.avg_corners),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiox, results, stats]);

  // Eficiência gols × xG (totais)
  const efic = useMemo(() => {
    const games = geral.r?.games ?? raiox?.played_total ?? 0;
    const xgFor = geral.s?.avg_xg;
    const xgAga = geral.s?.avg_xg_against;
    if (!games || stand == null || xgFor == null || xgAga == null) return null;
    return {
      ataque: { real: stand.goals_for, esperado: +(xgFor * games).toFixed(1) },
      defesa: { real: stand.goals_against, esperado: +(xgAga * games).toFixed(1) },
    };
  }, [geral, raiox, stand]);

  // Últimos resultados (a partir dos jogos do time)
  const recent = useMemo(() => {
    if (!tid) return [];
    return (fixtures || [])
      .filter((f) => (f.home_team_id === tid || f.away_team_id === tid)
        && FINISHED.has(f.status_short || '') && f.goals_home != null && f.goals_away != null)
      .sort((a, b) => new Date(b.kickoff_utc || b.date_utc || 0).getTime() - new Date(a.kickoff_utc || a.date_utc || 0).getTime())
      .slice(0, 6)
      .map((f) => {
        const home = f.home_team_id === tid;
        const gf = (home ? f.goals_home : f.goals_away) as number;
        const ga = (home ? f.goals_away : f.goals_home) as number;
        return {
          oppId: home ? f.away_team_id : f.home_team_id,
          oppName: home ? f.away_team_name : f.home_team_name,
          loc: home ? 'Casa' : 'Fora',
          placar: `${gf} × ${ga}`,
          res: gf > ga ? 'V' : gf === ga ? 'E' : 'D',
          when: fmtDay(f.kickoff_utc || f.date_utc),
        };
      });
  }, [fixtures, tid]);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <div className="max-w-5xl w-full mx-auto px-4 md:px-6 py-6 flex-1">
        {isLoading ? (
          <div className="space-y-5">
            <Skeleton className="h-44 w-full bg-canvas-2 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Skeleton className="h-60 w-full bg-canvas-2 rounded-2xl" />
              <Skeleton className="h-60 w-full bg-canvas-2 rounded-2xl" />
            </div>
            <Skeleton className="h-40 w-full bg-canvas-2 rounded-2xl" />
          </div>
        ) : isError || !profile?.team ? (
          <div className={`${CARD} p-6 text-center text-sm text-status-danger`}>Não foi possível carregar este time.</div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* ── Header magazine ── */}
            <div className={CARD}>
              <div className="px-5 md:px-8 py-5 md:py-6 flex items-center gap-4 md:gap-5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                <Crest name={profile.team.team_name || ''} id={profile.team.team_id} size={64} />
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl md:text-[28px] font-extrabold tracking-tight leading-tight text-ink truncate">{profile.team.team_name}</h1>
                  <p className="text-xs mt-1 text-ink-2">
                    {COMP_LABEL[competition] || competition} · {season}
                    {stand?.rank ? <> · <span className="font-semibold text-ink">{stand.rank}º colocado</span></> : null}
                  </p>
                  {raiox?.form && <div className="mt-2"><FormDots form={raiox.form} /></div>}
                </div>
                <div className="hidden md:flex items-center gap-6 shrink-0">
                  {([['Pts', stand?.points], ['J', stand?.played ?? raiox?.played_total], ['SG', stand ? (stand.goals_diff > 0 ? '+' : '') + stand.goals_diff : undefined]] as [string, number | string | null | undefined][]).map(([l, v]) => (
                    <div key={l} className="text-center">
                      <div className="text-[28px] font-extrabold tabular-nums tracking-tight leading-none" style={{ color: l === 'Pts' ? C.forest : C.ink }}>{v ?? '—'}</div>
                      <div className="text-[10px] uppercase tracking-[0.14em] font-bold mt-1.5 text-ink-3">{l}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4">
                {([['Vitórias', raiox?.wins_total, C.forest], ['Empates', raiox?.draws_total, C.ink2], ['Derrotas', raiox?.loses_total, C.rose], ['Gols', stand ? `${stand.goals_for}:${stand.goals_against}` : '—', C.ink]] as [string, number | string | null | undefined, string][]).map(([l, v, color], i) => (
                  <div key={l} className="px-2 md:px-6 py-3 md:py-4 text-center" style={{ borderLeft: i ? `1px solid ${C.lineSoft}` : 'none' }}>
                    <div className="text-lg md:text-[22px] font-extrabold tabular-nums tracking-tight leading-none" style={{ color }}>{v ?? '—'}</div>
                    <div className="text-[9px] uppercase tracking-[0.14em] font-bold mt-1.5 text-ink-3">{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Médias por mando · Eficiência ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Médias */}
              <div className={CARD}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Médias por mando</div>
                  <div className="grid grid-cols-[44px_44px_44px] gap-2 text-right text-[10px] uppercase tracking-[0.12em] font-bold text-ink-3"><span>Geral</span><span>Casa</span><span>Fora</span></div>
                </div>
                {medias.map((m, i) => (
                  <div key={m.label} className="px-5 py-2.5 grid grid-cols-[1fr_44px_44px_44px] gap-2 items-center" style={{ borderTop: i ? `1px solid ${C.lineSoft2}` : 'none' }}>
                    <span className="text-[12px] font-medium text-ink">{m.label}</span>
                    <span className="text-right text-[13px] tabular-nums font-semibold text-ink">{fmtAvg(m.geral, m.pct)}</span>
                    <span className="text-right text-[13px] tabular-nums" style={{ color: C.forest }}>{fmtAvg(m.casa, m.pct)}</span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2">{fmtAvg(m.fora, m.pct)}</span>
                  </div>
                ))}
              </div>

              {/* Eficiência */}
              <div className={CARD}>
                <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Eficiência · gols × xG</div>
                  <div className="text-[10px] mt-0.5 text-ink-3 leading-snug">xG = qualidade das chances criadas. Quem faz muito mais gol do que o xG tende a cair pro normal — cuidado com sequência "quente".</div>
                </div>
                {efic ? (
                  <div className="p-5 flex flex-col gap-5">
                    <EficBar label="Ataque (gols feitos)" real={efic.ataque.real} esperado={efic.ataque.esperado} good />
                    <EficBar label="Defesa (gols sofridos)" real={efic.defesa.real} esperado={efic.defesa.esperado} good={false} />
                  </div>
                ) : (
                  <div className="p-5 text-sm text-ink-3">Sem dados de xG para esta temporada.</div>
                )}
              </div>
            </div>

            {/* ── Raio-X da temporada ── */}
            {raiox && (
              <div className={CARD}>
                <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Raio-X da temporada</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-px" style={{ background: C.lineSoft }}>
                  {[
                    { l: 'Clean sheets', v: raiox.clean_sheet_total ?? '—', s: 'jogos sem sofrer' },
                    { l: 'Não marcou', v: raiox.failed_to_score_total ?? '—', s: 'jogos sem gol' },
                    { l: 'Invicto há', v: trailingStreak(raiox.form, (c) => c !== 'L'), s: 'jogos' },
                    { l: 'Sequência V', v: trailingStreak(raiox.form, (c) => c === 'W'), s: 'vitórias seguidas' },
                    { l: '% Over 2.5', v: geral.r?.over25_pct != null ? `${geral.r.over25_pct}%` : '—', s: 'dos jogos' },
                    { l: '% Ambos marcam', v: geral.r?.btts_pct != null ? `${geral.r.btts_pct}%` : '—', s: 'dos jogos' },
                  ].map((t) => (
                    <div key={t.l} className="px-5 py-4 bg-white">
                      <div className="text-[24px] font-extrabold tabular-nums tracking-tight leading-none" style={{ color: C.forest }}>{t.v}</div>
                      <div className="text-[11px] font-semibold mt-1.5 text-ink">{t.l}</div>
                      <div className="text-[10px] text-ink-3">{t.s}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Últimos resultados ── */}
            <div className={CARD}>
              <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Últimos resultados</div>
              </div>
              {recent.length ? recent.map((g, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3" style={{ borderTop: i ? `1px solid ${C.lineSoft2}` : 'none' }}>
                  <span className="inline-flex w-6 h-6 rounded items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: g.res === 'V' ? C.forest : g.res === 'E' ? C.ink3 : C.rose }}>{g.res}</span>
                  <span className="text-[11px] tabular-nums w-12 shrink-0 text-ink-3">{g.loc}</span>
                  <Crest name={g.oppName} id={g.oppId} size={22} />
                  <span className="text-[12px] font-semibold tracking-tight flex-1 min-w-0 truncate text-ink">{g.oppName}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-ink">{g.placar}</span>
                  <span className="text-[10px] tabular-nums w-12 text-right text-ink-3">{g.when}</span>
                </div>
              )) : <div className="px-5 py-6 text-center text-sm text-ink-3">Sem jogos recentes.</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Veredito mastigado da eficiência (relativo, escala com totais ou médias).
function eficVerdict(good: boolean, real: number, esperado: number): string {
  const ratio = esperado > 0 ? (real - esperado) / esperado : 0;
  const emLinha = Math.abs(ratio) <= 0.1;
  if (good) {
    // Ataque: real = gols feitos
    if (emLinha) return 'Marca em linha com as chances que cria — número sustentável.';
    return ratio > 0
      ? 'Marca acima das chances que cria — costuma normalizar (esfriar).'
      : 'Marca menos do que as chances valem — tende a melhorar.';
  }
  // Defesa: real = gols sofridos
  if (emLinha) return 'Sofre em linha com as chances do adversário — número sustentável.';
  return ratio > 0
    ? 'Sofre mais do que as chances mereciam — tende a melhorar.'
    : 'Sofre menos do que as chances do adversário — pode subir (regride à média).';
}

// Barra Real vs Esperado (gols × xG)
function EficBar({ label, real, esperado, good }: { label: string; real: number; esperado: number; good: boolean }) {
  const delta = +(real - esperado).toFixed(1);
  const max = Math.max(real, esperado) * 1.15 || 1;
  const positive = good ? delta > 0 : delta < 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold tracking-tight text-ink">{label}</span>
        <span className="text-[11px] tabular-nums font-semibold px-1.5 h-5 inline-flex items-center rounded"
          style={{ background: positive ? C.greenBg : C.roseBg, color: positive ? C.greenFg : C.roseFg }}>
          {delta > 0 ? '+' : ''}{delta} vs esperado
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold w-[74px] shrink-0 text-ink-3">Real</span>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: C.lineSoft }}><div style={{ width: `${(real / max) * 100}%`, height: '100%', background: C.forest }} /></div>
          <span className="text-[12px] tabular-nums font-semibold w-8 text-right text-ink">{real}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold w-[74px] shrink-0 text-ink-3">Esperado (xG)</span>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: C.lineSoft }}><div style={{ width: `${(esperado / max) * 100}%`, height: '100%', background: C.ink3 }} /></div>
          <span className="text-[12px] tabular-nums w-8 text-right text-ink-2">{esperado}</span>
        </div>
      </div>
      <p className="text-[11px] text-ink-2 mt-2 leading-snug">{eficVerdict(good, real, esperado)}</p>
    </div>
  );
}
