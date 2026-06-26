import { useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, AlertTriangle, ChevronDown, Check } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFutebolFixtureDetail, useFutebolFixtureExtras, useFutebolMatchupTendencies, useFutebolFixtureValue, useFutebolH2H, useFutebolFixtureInjuries, useFutebolTeamProfile } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  computeMatchupTendencies, headlineMarket, STRENGTH_LABEL,
  type MarketTendency, type Strength, type MatchupTendencies,
} from '@/utils/futebol-tendencias';
import {
  pickLabel, marketLabel, valorVerdict, fmtEdgeScore,
  faixaWord, faixaBadgeCls, chancePct, SCORE_MEDIA,
} from '@/utils/futebol-score';
import type {
  FutebolEvent, FutebolFormResult, FutebolInjury, FutebolLineupPlayer, FutebolPlayerStat, FutebolTeamStats, FutebolFixtureValueRow, FutebolTeamProfile, Competition,
} from '@/services/futebol-data.service';

const INJURY_TYPE: Record<string, { label: string; cls: string }> = {
  'Missing Fixture': { label: 'Fora', cls: 'bg-status-danger text-canvas' },
  Questionable: { label: 'Dúvida', cls: 'bg-amber text-canvas' },
};
const INJURY_REASON_PT: Record<string, string> = {
  Rest: 'Poupado', 'Yellow Cards': 'Suspenso', 'Red Card': 'Suspenso', Suspended: 'Suspenso',
  'Loan agreement': 'Empréstimo', Inactive: 'Inativo', "Coach's decision": 'Decisão técnica',
  'National selection': 'Seleção', 'Personal problems': 'Pessoal',
};
function injuryReason(r: string): string {
  if (INJURY_REASON_PT[r]) return INJURY_REASON_PT[r];
  if (/injury/i.test(r)) return 'Lesão';
  return r;
}

function InjuryCol({ injuries, teamId, teamName }: { injuries: FutebolInjury[]; teamId: number; teamName: string }) {
  const list = injuries.filter((i) => i.team_id === teamId);
  return (
    <div>
      <p className="text-sm font-semibold text-ink mb-2">{teamName} <span className="text-ink-3 text-xs font-normal">({list.length})</span></p>
      {list.length ? list.map((i) => {
        const t = INJURY_TYPE[i.injury_type];
        return (
          <div key={i.player_id} className="flex items-center gap-2 py-1 text-sm">
            <span className={`text-[9px] font-bold rounded px-1 py-0.5 shrink-0 ${t ? t.cls : 'bg-canvas-2 text-ink-3'}`}>{t ? t.label : i.injury_type}</span>
            <span className="truncate text-ink">{i.player_name}</span>
            <span className="ml-auto text-[10px] text-ink-3 truncate">{injuryReason(i.injury_reason)}</span>
          </div>
        );
      }) : <p className="text-xs text-ink-3">Sem desfalques.</p>}
    </div>
  );
}

const SAO_PAULO_TZ = 'America/Sao_Paulo';

function fmtDateTime(raw: string | null): string {
  if (!raw) return '—';
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function fmtDate(raw: string | null): string {
  if (!raw) return '—';
  const d = new Date(`${raw}T12:00:00Z`);
  if (isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
}

function prettyRound(round: string | null): string {
  if (!round) return '';
  const m = round.match(/Regular Season\s*-\s*(\d+)/i);
  return m ? `Rodada ${m[1]}` : round;
}

function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}

function Crest({ name, logo }: { name: string; logo: string | null }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <img src={logo} alt={name} onError={() => setErr(true)} className="w-11 h-11 object-contain" loading="lazy" />;
  }
  return (
    <div className="w-11 h-11 rounded-full bg-canvas-2 border border-line flex items-center justify-center text-xs font-bold text-ink-2">
      {crestInitials(name)}
    </div>
  );
}

const FORM_COLORS: Record<string, string> = {
  W: 'bg-status-success text-canvas',
  D: 'bg-canvas-2 text-ink-2 border border-line',
  L: 'bg-status-danger text-canvas',
};

function FormChips({ form }: { form: FutebolFormResult[] }) {
  if (!form?.length) return <span className="text-xs text-ink-3">Sem histórico</span>;
  const ordered = [...form].reverse(); // antigo → recente
  return (
    <div className="flex gap-1">
      {ordered.map((g) => (
        <span
          key={g.fixture_id}
          title={`${g.side === 'home' ? 'vs' : '@'} ${g.opponent} • ${g.goals_for}-${g.goals_against}`}
          className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${FORM_COLORS[g.result] || ''}`}
        >
          {g.result}
        </span>
      ))}
    </div>
  );
}

const STAT_ROWS: { key: keyof FutebolTeamStats; label: string }[] = [
  { key: 'ball_possession', label: 'Posse de bola (%)' },
  { key: 'expected_goals', label: 'xG (gols esperados)' },
  { key: 'total_shots', label: 'Finalizações' },
  { key: 'shots_on_goal', label: 'No gol' },
  { key: 'corner_kicks', label: 'Escanteios' },
  { key: 'fouls', label: 'Faltas' },
  { key: 'yellow_cards', label: 'Cartões amarelos' },
  { key: 'passes_pct', label: 'Passes certos (%)' },
];

function StatRow({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  const h = typeof home === 'number' ? home : null;
  const a = typeof away === 'number' ? away : null;
  const total = (h ?? 0) + (a ?? 0);
  const hPct = total > 0 ? ((h ?? 0) / total) * 100 : 50;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm tabular-nums mb-1">
        <span className="font-bold text-ink w-12">{h ?? '—'}</span>
        <span className="text-[11px] text-ink-3 uppercase tracking-wide">{label}</span>
        <span className="font-bold text-ink w-12 text-right">{a ?? '—'}</span>
      </div>
      <div className="flex h-1.5 rounded overflow-hidden bg-canvas-2">
        <div className="bg-forest" style={{ width: `${hPct}%` }} />
        <div className="bg-amber" style={{ width: `${100 - hPct}%` }} />
      </div>
    </div>
  );
}

function RatingBadge({ value }: { value: number }) {
  const cls = value >= 7.5 ? 'bg-forest text-canvas' : value >= 6.5 ? 'bg-canvas-2 text-ink border border-line' : 'bg-status-danger/15 text-status-danger';
  return <span className={`text-[10px] font-bold tabular-nums rounded px-1 py-0.5 ${cls}`}>{value.toFixed(1)}</span>;
}

function LineupColumn({ players, side, statsById }: { players: FutebolLineupPlayer[]; side: 'home' | 'away'; statsById: Map<number, FutebolPlayerStat> }) {
  const list = players.filter((p) => p.team_side === side);
  const starters = list.filter((p) => p.is_starter);
  const bench = list.filter((p) => !p.is_starter);
  const Row = (p: FutebolLineupPlayer) => {
    const st = p.player_id != null ? statsById.get(p.player_id) : undefined;
    return (
      <div key={`${p.player_id}-${p.player_slot}`} className="flex items-center gap-2 py-1 text-sm">
        <span className="w-6 text-[11px] text-ink-3 tabular-nums text-right">{p.shirt_number ?? '–'}</span>
        <span className="truncate text-ink">{p.player_name}</span>
        {st?.goals ? <span className="text-[10px] font-bold text-forest">{st.goals}G</span> : null}
        {st?.assists ? <span className="text-[10px] font-bold text-amber-2">{st.assists}A</span> : null}
        <span className="ml-auto flex items-center gap-2">
          {p.position && <span className="text-[10px] text-ink-3">{p.position}</span>}
          {st?.rating != null && <RatingBadge value={st.rating} />}
        </span>
      </div>
    );
  };
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-1">Titulares</p>
      {starters.length ? starters.map(Row) : <p className="text-xs text-ink-3">—</p>}
      {bench.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wide text-ink-3 mt-3 mb-1">Banco</p>
          {bench.map(Row)}
        </>
      )}
    </div>
  );
}

const GOAL_SUFFIX: Record<string, string> = { Penalty: ' (pênalti)', 'Own Goal': ' (gol contra)' };

function eventMinute(e: FutebolEvent): string {
  if (e.minute == null) return '—';
  return e.minute_extra ? `${e.minute}+${e.minute_extra}'` : `${e.minute}'`;
}

function EventRow({ e }: { e: FutebolEvent }) {
  const sideColor = e.team_side === 'home' ? 'text-forest' : 'text-amber-2';
  const dot = e.team_side === 'home' ? 'bg-forest' : 'bg-amber';
  let indicator: ReactNode;
  let text: ReactNode;

  if (e.event_type === 'Goal') {
    indicator = <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />;
    text = (
      <span className="text-ink-2">
        <b className="text-ink">{e.player_name}</b> Gol{e.event_detail ? GOAL_SUFFIX[e.event_detail] || '' : ''}
        {e.assist_player_name && <span className="text-ink-3"> · assist. {e.assist_player_name}</span>}
      </span>
    );
  } else if (e.event_type === 'Card') {
    const red = (e.event_detail || '').toLowerCase().includes('red');
    indicator = <span className={`w-2 h-3 rounded-sm ${red ? 'bg-status-danger' : 'bg-amber'}`} />;
    text = <span className="text-ink-2">{e.player_name} · {red ? 'Vermelho' : 'Amarelo'}</span>;
  } else if (e.event_type === 'subst') {
    indicator = <span className="text-[8px] font-bold text-ink-3">SUB</span>;
    text = (
      <span className="text-ink-2">
        <span className="text-status-success">Entra {e.assist_player_name}</span>
        <span className="text-ink-3"> · Sai {e.player_name}</span>
      </span>
    );
  } else if (e.event_type === 'Var') {
    indicator = <span className="text-[8px] font-bold text-ink-3 border border-line rounded px-1 leading-tight">VAR</span>;
    text = <span className="text-ink-3">{e.event_detail}{e.player_name ? ` (${e.player_name})` : ''}</span>;
  } else {
    indicator = <span className={`w-2 h-2 rounded-full ${dot}`} />;
    text = <span className="text-ink-2">{e.event_type} {e.player_name}</span>;
  }

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`w-9 shrink-0 text-xs tabular-nums text-right font-semibold ${sideColor}`}>{eventMinute(e)}</span>
      <span className="w-8 shrink-0 flex items-center justify-center">{indicator}</span>
      <span className="text-sm flex-1 min-w-0">{text}</span>
    </div>
  );
}

const STRENGTH_CHIP: Record<Strength, string> = {
  alta: 'bg-forest text-canvas',
  media: 'bg-amber text-canvas',
  baixa: 'bg-canvas-2 text-ink-3 border border-line',
};
const STRENGTH_BAR: Record<Strength, string> = {
  alta: 'bg-forest',
  media: 'bg-amber',
  baixa: 'bg-ink-3',
};

function TendencyRow({ m }: { m: MarketTendency }) {
  const pct = Math.round(m.prob * 100);
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm text-ink font-medium truncate">{m.label}</span>
        <span className="flex items-center gap-2 shrink-0 tabular-nums">
          <span className="text-sm font-bold text-ink">{pct}%</span>
          <span className="text-[10px] text-ink-3">justa {m.fairOdds.toFixed(2)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded overflow-hidden bg-canvas-2">
          <div className={`h-full ${STRENGTH_BAR[m.strength]}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[9px] font-bold rounded px-1 py-0.5 shrink-0 ${STRENGTH_CHIP[m.strength]}`}>{STRENGTH_LABEL[m.strength]}</span>
      </div>
      <p className="text-[10px] text-ink-3 mt-1">{m.reading}</p>
    </div>
  );
}



// Distribuição de gols do jogo (Poisson sobre λ total) — gráfico de barras vertical
function GoalDistChart({ lh, la }: { lh: number; la: number }) {
  const lambda = lh + la;
  const fact = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  const pois = (k: number) => (Math.exp(-lambda) * Math.pow(lambda, k)) / fact(k);
  const bars = [0, 1, 2, 3].map((k) => ({ k: String(k), p: pois(k) }));
  const acc = bars.reduce((s, b) => s + b.p, 0);
  bars.push({ k: '4+', p: Math.max(0, 1 - acc) });
  const max = Math.max(...bars.map((b) => b.p), 0.001);
  return (
    <div>
      <div className="flex items-end gap-2 h-24">
        {bars.map((b) => (
          <div key={b.k} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-[9px] text-ink-3 tabular-nums">{Math.round(b.p * 100)}%</span>
            <div className="w-full bg-forest/80 rounded-t" style={{ height: `${(b.p / max) * 100}%` }} />
            <span className="text-[10px] text-ink-2 font-semibold">{b.k}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-ink-3 mt-1.5 text-center">distribuição de gols no jogo (modelo) · esperado {lambda.toFixed(1)}</p>
    </div>
  );
}

const CARD = 'bg-white border border-line rounded-rebrand-xl';


// ---------- "O que olhar": Score vem PRONTO do backend (fact_value_opportunities) ----------
// Síntese "O que olhar neste jogo" — decide e PROVA a melhor aposta (Score do backend)
function WhatToWatch({ rows, homeName, awayName }: { rows: FutebolFixtureValueRow[]; homeName: string; awayName: string }) {
  const ranked = [...rows].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const second = ranked[1];
  const note = 'Leitura de risco, não recomendação de aposta.';

  if (!top) {
    return (
      <div className="rounded-rebrand-xl border border-line border-l-4 border-l-amber bg-white p-5">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-3">O que olhar neste jogo</div>
        <div className="text-lg font-bold text-ink mt-1.5">Sem valor claro nos mercados</div>
        <p className="text-sm text-ink-2 mt-1">As melhores odds estão alinhadas ao risco real — nada que se destaque aqui. Os dados abaixo seguem pra você tirar sua própria conclusão.</p>
        <p className="text-[10px] text-ink-3 mt-3">{note}</p>
      </div>
    );
  }

  const pick = pickLabel(top.market, top.outcome, top.line_value, homeName, awayName);
  const verdict = valorVerdict(top.edge);
  const porque = top.evidencias ?? [];
  // Pontos de atenção: contras (premissas que não bateram) + avisos (penalidades)
  const atencao = [...(top.contras ?? []), ...(top.avisos ?? [])];

  // Contexto entre mercados: por que o valor está NESTE mercado e não nos outros
  const otherMarket = Array.from(new Set(rows.map((r) => r.market))).find((m) => m !== top.market);
  let crossNote: string | null = null;
  if (otherMarket) {
    const ob = rows.filter((r) => r.market === otherMarket).reduce((b, r) => (r.score > b.score ? r : b));
    const obPick = pickLabel(ob.market, ob.outcome, ob.line_value, homeName, awayName);
    crossNote =
      ob.score >= SCORE_MEDIA
        ? `Neste jogo o valor está em ${marketLabel(top.market)}, mas também há valor em ${marketLabel(otherMarket)}: ${obPick} (score ${ob.score}).`
        : `Neste jogo o valor está em ${marketLabel(top.market)}. Em ${marketLabel(otherMarket)} as odds estão mais equilibradas — nada se destaca (melhor opção: ${obPick}, score ${ob.score}).`;
  }

  const vColor = verdict.toLowerCase().includes('forte') ? 'text-forest' : 'text-amber-2';
  const chance = chancePct(top.prob_justa_fechamento);
  const secondChance = second ? chancePct(second.prob_justa_fechamento) : null;

  return (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 flex items-center justify-between bg-canvas-2 border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">O que olhar neste jogo</div>
        <span className={`text-[11px] font-semibold ${vColor}`}>{verdict}</span>
      </div>
      <div className="p-5 md:p-6 grid md:grid-cols-[1fr_260px] gap-6">
        {/* Veredito + por quê + atenção */}
        <div>
          <div className="flex items-center gap-2">
            <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{marketLabel(top.market)}</span>
            <span className={`px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] ${faixaBadgeCls(top.faixa)}`}>Faixa {faixaWord(top.faixa)}</span>
          </div>
          <div className="text-2xl md:text-[30px] font-bold tracking-tight mt-2 text-ink leading-tight">{pick}</div>
          {porque.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-forest">Por quê</div>
              <ul className="flex flex-col gap-1.5">
                {porque.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-forest" /><span>{p}</span></li>
                ))}
              </ul>
            </div>
          )}
          {atencao.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-amber-2">Pontos de atenção</div>
              <ul className="flex flex-col gap-1.5">
                {atencao.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber" /><span>{p}</span></li>
                ))}
              </ul>
            </div>
          )}
          {crossNote && <p className="text-[12px] text-ink-3 mt-4 pt-3 border-t border-line">{crossNote}</p>}
        </div>

        {/* Painel de confiabilidade + 2ª opção */}
        <div className="md:pl-6 md:border-l md:border-line flex flex-col gap-4">
          <div className="rounded-rebrand-md p-4 text-white" style={{ background: 'linear-gradient(135deg, #0a3d2e, #08321f)' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">Confiabilidade</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[44px] font-bold tabular-nums tracking-tight leading-none" style={{ color: '#fbbf24' }}>{top.score}</span>
              <span className="text-[13px] text-white/40">/100</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {chance != null && <div><div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">Chance</div><div className="text-[18px] font-semibold tabular-nums leading-none mt-1">{chance}%</div></div>}
              <div><div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">Odd</div><div className="text-[18px] font-semibold tabular-nums leading-none mt-1">{top.best_odd.toFixed(2)}</div></div>
            </div>
          </div>
          {second && (
            <div className="rounded-rebrand-md p-3 bg-canvas-2 border border-line">
              <div className="text-[9px] uppercase tracking-[0.16em] font-bold mb-1.5 text-ink-3">2ª opção</div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold tracking-tight text-ink truncate">{pickLabel(second.market, second.outcome, second.line_value, homeName, awayName)}</div>
                  <div className="text-[10px] text-ink-3 truncate">{marketLabel(second.market)}{secondChance != null ? ` · ${secondChance}%` : ''} · {second.best_odd.toFixed(2)}</div>
                </div>
                <span className="text-[18px] font-semibold tabular-nums text-forest shrink-0">{second.score}</span>
              </div>
            </div>
          )}
          <p className="text-[10px] text-ink-3 leading-snug">{note}</p>
        </div>
      </div>
    </div>
  );
}

// "Explorar mercados" — todas as opções por mercado (Chance · Odd · Valor · ★ melhor)
function ResultExplorer({ rows, homeName, awayName }: { rows: FutebolFixtureValueRow[]; homeName: string; awayName: string }) {
  const markets = [...new Set(rows.map((r) => r.market))];
  return (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 flex items-center justify-between border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Explorar mercados</div>
        <span className="text-[10px] text-ink-3">{markets.length} mercado{markets.length === 1 ? '' : 's'}</span>
      </div>
      {markets.map((mk, mi) => {
        const list = rows.filter((r) => r.market === mk).sort((a, b) => a.outcome_order - b.outcome_order);
        const bestScore = Math.max(...list.map((r) => r.score));
        return (
          <div key={mk} className={mi ? 'border-t border-line' : ''}>
            <div className="px-5 py-2 flex items-center gap-2 bg-canvas-2">
              <span className="text-[11px] font-semibold tracking-tight text-ink">{marketLabel(mk)}</span>
              <span className="ml-auto grid grid-cols-[52px_52px_56px] gap-2 text-right text-[9px] uppercase tracking-[0.14em] font-bold text-ink-3">
                <span>Chance</span><span>Odd</span><span>Valor</span>
              </span>
            </div>
            {list.map((r) => {
              const chance = chancePct(r.prob_justa_fechamento);
              const isBest = r.score === bestScore;
              return (
                <div key={`${r.outcome}-${r.line_value}`} className="px-5 py-2.5 grid grid-cols-[1fr_52px_52px_56px] gap-2 items-center border-t border-line/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {isBest && <span className="text-[10px]" style={{ color: '#fbbf24' }} title="melhor opção do mercado">★</span>}
                    <span className={`text-[12px] font-medium tracking-tight truncate ${isBest ? 'text-ink' : 'text-ink-2'}`}>{pickLabel(r.market, r.outcome, r.line_value, homeName, awayName)}</span>
                  </div>
                  <div className="text-right tabular-nums text-[12px] text-ink-2">{chance != null ? `${chance}%` : '—'}</div>
                  <div className="text-right tabular-nums text-[12px] font-semibold text-ink">{r.best_odd.toFixed(2)}</div>
                  <div className="text-right tabular-nums text-[12px] font-semibold" style={{ color: r.edge > 0 ? 'var(--forest)' : '#9aa097' }}>{r.edge > 0 ? fmtEdgeScore(r.edge) : 'sem valor'}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// "Nosso modelo de gols" — Poisson sobre médias da temporada (rebrand card)
function ModelCard({ tendencies, head, homeName, awayName }: { tendencies: MatchupTendencies; head: MarketTendency | null; homeName: string; awayName: string }) {
  const { lh, la } = tendencies.lambdas;
  return (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Nosso modelo de gols</div>
      </div>
      <div className="p-5">
        {head && <div className="text-[13px] leading-snug text-ink-2">{head.reading}</div>}
        <div className="flex items-center gap-6 mt-4">
          <div className="text-center"><div className="text-[28px] font-bold tabular-nums tracking-tight leading-none text-forest">{lh.toFixed(1)}</div><div className="text-[10px] mt-1 text-ink-3 max-w-[90px] truncate mx-auto">{homeName}</div></div>
          <div className="text-[14px] text-ink-3">×</div>
          <div className="text-center"><div className="text-[28px] font-bold tabular-nums tracking-tight leading-none text-ink-2">{la.toFixed(1)}</div><div className="text-[10px] mt-1 text-ink-3 max-w-[90px] truncate mx-auto">{awayName}</div></div>
          <div className="text-[10px] text-ink-3 leading-tight">gols<br/>esperados</div>
        </div>
        <div className="mt-5"><GoalDistChart lh={lh} la={la} /></div>
        {head && (
          <div className="rounded-rebrand-sm bg-canvas-2 border border-line p-3 mt-4">
            <p className="text-[9px] uppercase tracking-[0.16em] text-ink-3 mb-1 font-bold">Leitura principal · {head.group}</p>
            <div className="flex items-end justify-between gap-2">
              <span className="text-[15px] font-bold text-ink leading-tight">{head.label}</span>
              <span className="text-[22px] font-extrabold text-forest tabular-nums leading-none">{Math.round(head.prob * 100)}%</span>
            </div>
          </div>
        )}
        <div className="divide-y divide-line mt-2">
          {tendencies.markets.filter((mk) => mk.key !== head?.key).map((mk) => (
            <TendencyRow key={mk.key} m={mk} />
          ))}
        </div>
        <p className="mt-4 text-[10px] leading-snug text-ink-3">Estimativa estatística (Poisson) sobre médias da temporada — não é valor de mercado.</p>
      </div>
    </div>
  );
}

// Campo (pitch) com o XI provável a partir do `grid` (linha:coluna da API)
function Pitch({ players, side, formation }: { players: FutebolLineupPlayer[]; side: 'home' | 'away'; formation: string | null }) {
  const starters = players.filter((p) => p.team_side === side && p.is_starter && p.grid);
  if (!starters.length) {
    return <div className="rounded-rebrand-sm grid place-items-center text-[11px] text-white/60" style={{ aspectRatio: '3 / 3.4', background: 'linear-gradient(160deg, #0e5238, #0a3d2e)' }}>Escalação próximo ao jogo</div>;
  }
  const parsed = starters.map((p) => { const [r, c] = (p.grid || '1:1').split(':').map(Number); return { p, r: r || 1, c: c || 1 }; });
  const maxR = Math.max(...parsed.map((x) => x.r));
  const byRow: Record<number, typeof parsed> = {};
  parsed.forEach((x) => { (byRow[x.r] ||= []).push(x); });
  Object.values(byRow).forEach((arr) => arr.sort((a, b) => a.c - b.c));
  return (
    <div className="rounded-rebrand-sm overflow-hidden relative" style={{ aspectRatio: '3 / 3.4', background: 'linear-gradient(160deg, #0e5238, #0a3d2e)' }}>
      <svg viewBox="0 0 100 113" className="absolute inset-0 w-full h-full" style={{ opacity: 0.28 }}>
        <rect x="3" y="3" width="94" height="107" fill="none" stroke="#fff" strokeWidth="0.6" />
        <line x1="3" y1="56.5" x2="97" y2="56.5" stroke="#fff" strokeWidth="0.6" />
        <circle cx="50" cy="56.5" r="10" fill="none" stroke="#fff" strokeWidth="0.6" />
        <rect x="30" y="3" width="40" height="15" fill="none" stroke="#fff" strokeWidth="0.6" />
        <rect x="30" y="95" width="40" height="15" fill="none" stroke="#fff" strokeWidth="0.6" />
      </svg>
      {parsed.map((x, i) => {
        const arr = byRow[x.r]; const idx = arr.indexOf(x); const n = arr.length;
        const xPct = ((idx + 1) / (n + 1)) * 100;
        const yPct = maxR > 1 ? 90 - ((x.r - 1) / (maxR - 1)) * 74 : 50;
        const label = x.p.player_name?.split(' ').slice(-1)[0] || '';
        const dot = x.p.shirt_number != null ? String(x.p.shirt_number) : (x.p.position?.slice(0, 1) ?? '');
        return (
          <div key={i} className="absolute flex flex-col items-center" style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%,-50%)' }}>
            <div className="rounded-full grid place-items-center text-[8px] font-bold" style={{ width: 22, height: 22, background: '#fff', color: '#0a3d2e', border: '1.5px solid rgba(255,255,255,0.85)' }}>{dot}</div>
            <span className="text-[7px] font-semibold mt-0.5 px-1 rounded whitespace-nowrap" style={{ color: '#fff', background: 'rgba(0,0,0,0.4)' }}>{label}</span>
          </div>
        );
      })}
      {formation && <div className="absolute top-2 left-2 px-1.5 h-5 inline-flex items-center rounded text-[9px] font-bold tabular-nums" style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}>{formation}</div>}
    </div>
  );
}

// Estatísticas comparadas da temporada (barras espelhadas) — médias via team_profile
function StatsCompare({ home, away }: { home?: FutebolTeamProfile; away?: FutebolTeamProfile }) {
  const hr = home?.results.find((r) => r.scope === 'geral');
  const ar = away?.results.find((r) => r.scope === 'geral');
  const hs = home?.stats_avg.find((s) => s.scope === 'geral');
  const as = away?.stats_avg.find((s) => s.scope === 'geral');
  const rows = [
    { l: 'Gols marcados / jogo', a: hr?.avg_gf, b: ar?.avg_gf, pct: false },
    { l: 'Gols sofridos / jogo', a: hr?.avg_ga, b: ar?.avg_ga, pct: false },
    { l: 'Posse de bola', a: hs?.avg_possession, b: as?.avg_possession, pct: true },
    { l: 'Finalizações / jogo', a: hs?.avg_shots, b: as?.avg_shots, pct: false },
    { l: 'Escanteios / jogo', a: hs?.avg_corners, b: as?.avg_corners, pct: false },
    { l: '% jogos Over 2.5', a: hr?.over25_pct, b: ar?.over25_pct, pct: true },
  ].filter((r) => r.a != null && r.b != null) as { l: string; a: number; b: number; pct: boolean }[];
  if (!rows.length) return <p className="text-sm text-ink-3 text-center py-4">Médias da temporada indisponíveis.</p>;
  const fmt = (v: number, pct: boolean) => pct ? `${Math.round(v)}%` : v.toFixed(1);
  return (
    <div className="flex flex-col gap-3">
      {rows.map((s) => {
        const total = s.a + s.b;
        const aPct = total ? (s.a / total) * 100 : 50;
        return (
          <div key={s.l}>
            <div className="flex items-center justify-between text-[12px] tabular-nums mb-1">
              <span className="font-semibold text-forest">{fmt(s.a, s.pct)}</span>
              <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-ink-3">{s.l}</span>
              <span className="font-semibold text-ink-2">{fmt(s.b, s.pct)}</span>
            </div>
            <div className="flex items-center gap-1 h-2">
              <div className="flex-1 h-full rounded-l-full overflow-hidden flex justify-end bg-canvas-2"><div style={{ width: `${aPct}%`, background: 'var(--forest)', height: '100%' }} /></div>
              <div className="flex-1 h-full rounded-r-full overflow-hidden bg-canvas-2"><div style={{ width: `${100 - aPct}%`, background: 'var(--ink-3)', height: '100%' }} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FutebolJogo() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const fid = fixtureId ? Number(fixtureId) : undefined;
  const { data, isLoading, isError } = useFutebolFixtureDetail(fid);
  const { data: extras, isLoading: extrasLoading } = useFutebolFixtureExtras(fid);

  const fixture = data?.fixture;
  const { data: h2h, isLoading: h2hLoading } = useFutebolH2H(fixture?.home_team_id, fixture?.away_team_id);
  const { data: injuries } = useFutebolFixtureInjuries(fid);
  const { data: tend } = useFutebolMatchupTendencies(
    fixture?.home_team_id, fixture?.away_team_id, fixture?.competition, fixture?.season
  );
  const tendencies = useMemo(() => {
    if (!fixture || !tend?.home || !tend?.away) return null;
    return computeMatchupTendencies(tend.home, tend.away, fixture.home_team_name, fixture.away_team_name);
  }, [tend, fixture]);
  const head = tendencies ? headlineMarket(tendencies.markets) : null;
  // Score vem PRONTO do backend (fact_value_opportunities). 1X2 por enquanto.
  const { data: valueRows } = useFutebolFixtureValue(fid);
  // Perfis (médias da temporada) dos dois times — pra "Estatísticas · temporada"
  const { data: homeProfile } = useFutebolTeamProfile(fixture?.home_team_id, fixture?.competition as Competition, fixture?.season as number);
  const { data: awayProfile } = useFutebolTeamProfile(fixture?.away_team_id, fixture?.competition as Competition, fixture?.season as number);
  const h2hHomeWins = h2h?.filter((m) => m.winner_team_id === fixture?.home_team_id).length ?? 0;
  const h2hAwayWins = h2h?.filter((m) => m.winner_team_id === fixture?.away_team_id).length ?? 0;
  const h2hDraws = h2h?.filter((m) => m.winner_team_id == null).length ?? 0;
  const h2hTotal = h2h?.length ?? 0;
  const h2hPct = (n: number) => (h2hTotal ? (n / h2hTotal) * 100 : 0);
  const stats = data?.stats || [];
  const home = stats.find((s) => s.team_side === 'home');
  const away = stats.find((s) => s.team_side === 'away');
  const finished = fixture?.status_short === 'FT' || fixture?.status_short === 'AET' || fixture?.status_short === 'PEN';
  // jogo encerrado/iniciado não é mais oportunidade: esconde o "O que olhar" (vira só descritivo)
  const showValue = !finished && !!valueRows && valueRows.length > 0;

  const playerStats = extras?.player_stats || [];
  const statsById = new Map<number, FutebolPlayerStat>(
    playerStats.filter((p) => p.player_id != null).map((p) => [p.player_id, p])
  );
  const destaques = playerStats
    .filter((p) => p.rating != null)
    .sort((a, b) => (b.rating as number) - (a.rating as number))
    .slice(0, 3);

  const hasDescriptive = !!(
    home || away ||
    extras?.events?.length || extras?.lineup_players?.length ||
    (h2h && h2h.length) || extras?.form_home?.length || extras?.form_away?.length
  );

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 flex-1">
        <button
          onClick={() => navigate('/futebol/jogos')}
          className="flex items-center gap-1 text-xs text-ink-2 hover:text-ink mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar pros jogos
        </button>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-10 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-64 w-full bg-canvas-2 rounded-rebrand-md" />
          </div>
        ) : isError || !fixture ? (
          <div className={`${CARD} p-6 text-center text-sm text-status-danger`}>
            Não foi possível carregar este jogo.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border border-line border-l-4 border-l-forest rounded-rebrand-xl p-5 md:p-6">
              <div className="flex items-center justify-center gap-2 mb-5 text-[10px] uppercase tracking-[0.16em] text-ink-3">
                <span>{prettyRound(fixture.round)}</span>
                {fixture.venue_name && (
                  <><span>•</span><MapPin className="w-3 h-3" /><span>{fixture.venue_name}{fixture.venue_city ? `, ${fixture.venue_city}` : ''}</span></>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                <button
                  onClick={() => navigate(`/futebol/time/${fixture.home_team_id}?c=${fixture.competition}&s=${fixture.season}`)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <Crest name={fixture.home_team_name} logo={getFutebolTeamLogoUrl(fixture.home_team_id)} />
                  <span className="text-base font-semibold text-ink text-center group-hover:text-forest leading-tight">{fixture.home_team_name}</span>
                  {!extrasLoading && <FormChips form={extras?.form_home || []} />}
                </button>
                <div className="px-2 md:px-4 text-center pt-1">
                  {finished ? (
                    <div className="text-4xl md:text-5xl font-extrabold text-ink tabular-nums leading-none">
                      {fixture.goals_home ?? '-'} <span className="text-ink-3">:</span> {fixture.goals_away ?? '-'}
                    </div>
                  ) : (
                    <div className="text-lg md:text-xl font-bold text-ink tabular-nums leading-none">{fmtDateTime(fixture.kickoff_utc)}</div>
                  )}
                  <div className="text-[10px] uppercase tracking-wide text-ink-3 mt-2">
                    {finished ? 'Encerrado' : (fixture.status_long || 'Agendado')}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/futebol/time/${fixture.away_team_id}?c=${fixture.competition}&s=${fixture.season}`)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <Crest name={fixture.away_team_name} logo={getFutebolTeamLogoUrl(fixture.away_team_id)} />
                  <span className="text-base font-semibold text-ink text-center group-hover:text-forest leading-tight">{fixture.away_team_name}</span>
                  {!extrasLoading && <FormChips form={extras?.form_away || []} />}
                </button>
              </div>
            </div>

            {/* Veredito + nosso modelo de gols (lado a lado) */}
            {(showValue || tendencies) && (
              <div className={`mt-5 grid gap-5 items-start ${showValue && tendencies ? 'lg:grid-cols-[1.5fr_1fr]' : 'grid-cols-1'}`}>
                {showValue && valueRows && (
                  <WhatToWatch rows={valueRows} homeName={fixture.home_team_name} awayName={fixture.away_team_name} />
                )}
                {tendencies && (
                  <ModelCard tendencies={tendencies} head={head} homeName={fixture.home_team_name} awayName={fixture.away_team_name} />
                )}
              </div>
            )}

            {/* Explorar mercados — largura total */}
            {showValue && valueRows && (
              <div className="mt-5">
                <ResultExplorer rows={valueRows} homeName={fixture.home_team_name} awayName={fixture.away_team_name} />
              </div>
            )}

            {/* Contexto — escalação (pitch) + confrontos diretos + estatísticas */}
            {(hasDescriptive || homeProfile || awayProfile) && (
              <div className="mt-5 grid lg:grid-cols-[1.3fr_1fr] gap-5 items-start">
                {/* Escalação provável & desfalques */}
                <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
                  <div className="px-5 py-3 flex items-center justify-between border-b border-line">
                    <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Escalação provável & desfalques</div>
                    {extras?.lineups?.length ? (
                      <span className="text-[10px] tabular-nums text-ink-3">{extras.lineups.find((l) => l.team_side === 'home')?.formation || '—'} × {extras.lineups.find((l) => l.team_side === 'away')?.formation || '—'}</span>
                    ) : null}
                  </div>
                  <div className="p-5">
                    {extras?.lineup_players?.length ? (
                      <div className="grid grid-cols-2 gap-4">
                        {(['home', 'away'] as const).map((sideKey) => {
                          const teamName = sideKey === 'home' ? fixture.home_team_name : fixture.away_team_name;
                          const teamId = sideKey === 'home' ? fixture.home_team_id : fixture.away_team_id;
                          const formation = extras!.lineups.find((l) => l.team_side === sideKey)?.formation ?? null;
                          const inj = (injuries || []).filter((x) => x.team_id === teamId);
                          return (
                            <div key={sideKey}>
                              <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-[12px] font-semibold tracking-tight text-ink truncate">{teamName}</span>
                                {formation && <span className="text-[10px] tabular-nums ml-auto text-ink-3">{formation}</span>}
                              </div>
                              <Pitch players={extras!.lineup_players} side={sideKey} formation={formation} />
                              <div className="mt-3">
                                <div className="text-[9px] uppercase tracking-[0.16em] font-bold mb-1.5 text-ink-3">Desfalques</div>
                                {inj.length === 0 ? <div className="text-[11px] text-ink-3">Sem desfalques</div> : inj.map((d, i) => {
                                  const duvida = /quest|doubt|dúvid/i.test(d.injury_type || '');
                                  return (
                                    <div key={i} className={`flex items-center gap-2 py-1.5 text-[12px] ${i ? 'border-t border-line/60' : ''}`}>
                                      <span className="font-semibold tracking-tight text-ink truncate">{d.player_name}</span>
                                      <span className="text-[10px] text-ink-3 truncate">{d.injury_reason || d.injury_type}</span>
                                      <span className="px-1.5 h-4 inline-flex items-center rounded text-[9px] font-bold ml-auto shrink-0" style={duvida ? { background: '#fef7df', color: '#9a6c00' } : { background: '#fde2e7', color: '#9a1f2e' }}>{duvida ? 'Dúvida' : 'Fora'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-3 text-center py-6">Escalação provável disponível próximo ao jogo.</p>
                    )}
                  </div>
                </div>

                {/* Confrontos diretos + Estatísticas */}
                <div className="flex flex-col gap-5">
                  <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
                    <div className="px-5 py-3 border-b border-line"><div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Confrontos diretos</div></div>
                    <div className="p-5">
                      {h2hLoading ? <p className="text-xs text-ink-3">Carregando…</p> : h2h && h2h.length ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[20px] font-semibold tabular-nums text-forest shrink-0">{h2hHomeWins}</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-canvas-2">
                              <div style={{ width: `${h2hPct(h2hHomeWins)}%`, background: 'var(--forest)' }} />
                              <div style={{ width: `${h2hPct(h2hDraws)}%`, background: 'var(--ink-3)' }} />
                              <div style={{ width: `${h2hPct(h2hAwayWins)}%`, background: '#be123c' }} />
                            </div>
                            <span className="text-[20px] font-semibold tabular-nums shrink-0" style={{ color: '#be123c' }}>{h2hAwayWins}</span>
                          </div>
                          <p className="text-[11px] mb-2 text-ink-3">{h2hTotal} confronto{h2hTotal === 1 ? '' : 's'} · {h2hHomeWins} {fixture.home_team_name} · {h2hDraws} empate · {h2hAwayWins} {fixture.away_team_name}</p>
                          {h2h.slice(0, 6).map((m) => {
                            const win = (m.goals_home ?? 0) > (m.goals_away ?? 0) ? 'home' : (m.goals_away ?? 0) > (m.goals_home ?? 0) ? 'away' : 'draw';
                            return (
                              <div key={m.fixture_id} className="grid grid-cols-[1fr_auto_60px] gap-2 items-center py-2 text-[12px] border-t border-line/60">
                                <span className="text-[11px] text-ink-3 truncate">{fmtDate(m.date_utc)} · {m.competition}</span>
                                <span className="font-semibold tabular-nums text-ink">{m.goals_home} × {m.goals_away}</span>
                                <span className="text-right text-[10px] font-bold uppercase" style={{ color: win === 'home' ? 'var(--forest)' : win === 'away' ? '#be123c' : 'var(--ink-3)' }}>{win === 'home' ? 'Casa' : win === 'away' ? 'Fora' : 'Empate'}</span>
                              </div>
                            );
                          })}
                        </>
                      ) : <p className="text-xs text-ink-3">Sem confrontos diretos no histórico.</p>}
                    </div>
                  </div>

                  {(homeProfile || awayProfile) && (
                    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
                      <div className="px-5 py-3 flex items-center justify-between border-b border-line">
                        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Estatísticas · temporada</div>
                        <span className="text-[10px] flex items-center gap-2"><span className="text-forest font-semibold truncate max-w-[90px]">{fixture.home_team_name}</span><span className="text-ink-3 truncate max-w-[90px]">{fixture.away_team_name}</span></span>
                      </div>
                      <div className="p-5"><StatsCompare home={homeProfile} away={awayProfile} /></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
