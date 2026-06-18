import { useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, MapPin, AlertTriangle, ChevronDown } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFutebolFixtureDetail, useFutebolFixtureExtras, useFutebolMatchupTendencies, useFutebolFixtureOdds, useFutebolFixturePrediction, useFutebolH2H, useFutebolFixtureInjuries } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  computeMatchupTendencies, headlineMarket, STRENGTH_LABEL,
  type MarketTendency, type Strength,
} from '@/utils/futebol-tendencias';
import {
  computeFixtureValue, fmtPct, fmtEdge, fmtStake, HERO_MIN_SCORE,
  type FixtureValue, type ValueMarket, type ValueOutcome,
} from '@/utils/futebol-value';
import type {
  FutebolEvent, FutebolFormResult, FutebolInjury, FutebolLineupPlayer, FutebolPlayerStat, FutebolTeamStats,
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


const COLOR_1X2: Record<string, string> = { Home: 'bg-forest', Draw: 'bg-ink-3', Away: 'bg-amber' };

// Barra de probabilidade 1X2 — a "cara do jogo" num gráfico (não 3 linhas de tabela)
function Prob1X2Bar({ m }: { m: ValueMarket }) {
  return (
    <div>
      <div className="flex h-9 rounded-rebrand-sm overflow-hidden border border-line">
        {m.outcomes.map((o) => (
          <div key={o.outcomeKey} className={`${COLOR_1X2[o.outcomeKey] || 'bg-ink-3'} grid place-items-center`} style={{ width: `${Math.max(7, o.fairProb * 100)}%` }}>
            <span className="text-[10px] font-bold text-white/95 tabular-nums">{fmtPct(o.fairProb)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        {m.outcomes.map((o) => {
          const hasValue = o.score > 0 && !o.suspect;
          return (
            <div key={o.outcomeKey} className="text-center">
              <div className="text-[12px] font-semibold text-ink truncate">{o.outcomeLabel}</div>
              <div className="text-lg font-bold text-ink tabular-nums leading-tight">{o.bestOdd.toFixed(2)}</div>
              {hasValue ? (
                <span className="text-[10px] font-bold rounded px-1.5 py-0.5 inline-block mt-1 bg-forest text-canvas tabular-nums">valor {fmtEdge(o.edge)}</span>
              ) : (
                <span className="text-[10px] text-ink-3 inline-block mt-1">sem valor</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Linha de resultado: chance (barra) + odd + tag de valor (só quando há valor)
function ValueOutcomeRow({ o }: { o: ValueOutcome }) {
  const pct = Math.min(100, Math.round(o.fairProb * 100));
  const hasValue = o.score > 0 && !o.suspect;
  return (
    <div className="py-2.5 border-t border-line first:border-t-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-sm text-ink truncate flex items-center gap-1">
          {o.outcomeLabel}
          {o.suspect && <AlertTriangle className="w-3 h-3 text-amber-2" />}
        </span>
        <span className="flex items-center gap-2.5 shrink-0">
          {hasValue && <span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-forest text-canvas tabular-nums">valor {fmtEdge(o.edge)}</span>}
          <span className="text-base font-bold text-ink tabular-nums">{o.bestOdd.toFixed(2)}</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-canvas-2 overflow-hidden">
          <div className={`h-full ${hasValue ? 'bg-forest' : 'bg-forest/40'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-ink-3 tabular-nums w-20 text-right">chance {fmtPct(o.fairProb)}</span>
      </div>
    </div>
  );
}

const MARKET_TABS: { id: string; label: string; match: (k: string) => boolean }[] = [
  { id: 'resultado', label: 'Resultado', match: (k) => k === 'match_winner' },
  { id: 'gols', label: 'Gols', match: (k) => k.startsWith('ou_') },
  { id: 'btts', label: 'Ambos marcam', match: (k) => k === 'btts' },
  { id: 'dupla', label: 'Dupla chance', match: (k) => k === 'double_chance' },
];

// Board de mercados com NAVEGAÇÃO por abas (não grid de cards)
function ValueMarketBoard({ markets }: { markets: ValueMarket[] }) {
  const tabs = MARKET_TABS.filter((t) => markets.some((m) => t.match(m.key)));
  const golsLines = markets.filter((m) => m.key.startsWith('ou_'));
  const [tab, setTab] = useState(tabs[0]?.id ?? 'resultado');
  const [line, setLine] = useState(golsLines.find((m) => m.key === 'ou_2.5')?.key ?? golsLines[0]?.key ?? '');

  const active = tabs.find((t) => t.id === tab) ?? tabs[0];
  const shown = active?.id === 'gols'
    ? (golsLines.find((m) => m.key === line) ?? golsLines[0])
    : markets.find((m) => active?.match(m.key));

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-canvas-2 border border-line rounded-rebrand-md p-1 w-fit max-w-full overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`h-8 px-3 rounded-rebrand-sm text-xs font-semibold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {active?.id === 'gols' && golsLines.length > 1 && (
        <div className="flex gap-1.5 mb-3">
          {golsLines.map((m) => (
            <button key={m.key} onClick={() => setLine(m.key)} className={`h-7 px-3 rounded-rebrand-sm text-[11px] font-semibold border transition-colors ${line === m.key ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink-2 border-line hover:text-ink'}`}>
              {m.label.replace('Mais/Menos ', '').replace(' gols', '')}
            </button>
          ))}
        </div>
      )}

      {shown && active?.id === 'resultado' ? (
        <Prob1X2Bar m={shown} />
      ) : shown ? (
        <div>{shown.outcomes.map((o) => <ValueOutcomeRow key={o.outcomeKey} o={o} />)}</div>
      ) : null}
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

// Síntese "O que olhar neste jogo" — decide e mostra a melhor aposta em palavras
function WhatToWatch({ value }: { value: FixtureValue }) {
  const ranked = value.markets
    .flatMap((m) => m.outcomes)
    .filter((o) => o.score > 0 && !o.suspect)
    .sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const second = ranked[1];
  const score = top?.score ?? 0;
  const e = (top?.edge ?? 0) * 100;
  // palavra descreve o TAMANHO do valor (edge); a Confiabilidade (Score) é o número à parte
  const verdict = e >= 4 ? 'Valor forte' : e >= 2 ? 'Valor moderado' : e >= 0.8 ? 'Valor pequeno' : 'Valor marginal';
  const tinted = score >= HERO_MIN_SCORE;
  const ruler = 'Régua do valor: acima de ~4% é raro/forte · 1–3% é o normal do dia · abaixo de ~1% é ruído. A Confiabilidade (Score) pondera valor + gestão de banca + odd sã.';

  if (!top) {
    return (
      <div className="rounded-rebrand-xl border border-line border-l-4 border-l-amber bg-white p-5">
        <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-3">O que olhar neste jogo</div>
        <div className="text-lg font-bold text-ink mt-1.5">Sem valor relevante</div>
        <p className="text-sm text-ink-2 mt-1">As melhores odds estão alinhadas à chance justa do mercado — nada que se destaque pra apostar aqui.</p>
        <p className="text-[10px] text-ink-3 mt-3">{ruler}</p>
      </div>
    );
  }

  if (tinted) {
    return (
      <div className="rounded-rebrand-xl overflow-hidden relative text-white" style={{ background: 'linear-gradient(135deg, #0a3d2e 0%, #08321f 60%, #051f12 100%)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.16), transparent 70%)', transform: 'translate(70px,-70px)' }} />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/50 font-semibold">O que olhar neste jogo</div>
              <span className="inline-flex items-center px-2 h-6 rounded-md text-[10px] uppercase tracking-[0.12em] font-bold mt-2" style={{ background: '#fbbf24', color: '#1a1d1a' }}>{verdict}</span>
              <div className="text-xl font-bold mt-2 leading-tight">{top.outcomeLabel} <span className="text-white/50 text-sm font-normal">· {top.marketLabel}</span></div>
              <p className="text-[13px] text-white/75 mt-1">Odd {top.bestOdd.toFixed(2)} · paga {fmtEdge(top.edge)} acima da chance justa ({fmtPct(top.fairProb)}).</p>
              <span className="inline-block mt-2.5 px-2.5 h-7 leading-7 rounded-md text-[11px] font-semibold" style={{ background: 'rgba(251,191,36,0.18)', color: '#fde68a', border: '1px solid rgba(251,191,36,0.35)' }}>Gestão de banca · arriscar até {fmtStake(top.stake)}</span>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/50">Confiabilidade</div>
              <div className="flex items-baseline justify-end gap-1 mt-1"><span className="text-5xl font-bold tabular-nums leading-none" style={{ color: '#fbbf24' }}>{score}</span><span className="text-sm text-white/40">/100</span></div>
            </div>
          </div>
          {second && (
            <div className="mt-4 pt-3 border-t border-white/10 text-[12px] text-white/70">
              2ª opção: <b className="text-white">{second.outcomeLabel}</b> ({second.marketLabel}) · odd {second.bestOdd.toFixed(2)} · {fmtEdge(second.edge)} · score {second.score}
            </div>
          )}
          <p className="text-[10px] text-white/45 mt-3 leading-snug">{ruler}</p>
        </div>
      </div>
    );
  }

  // valor pequeno → card branco, sem drama
  return (
    <div className="rounded-rebrand-xl border border-line border-l-4 border-l-amber bg-white p-5">
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-3">O que olhar neste jogo</div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-amber/15 text-amber-2 border border-amber/30 uppercase tracking-[0.1em]">{verdict}</span>
        <span className="text-xs text-ink-3 tabular-nums">score {score}/100</span>
      </div>
      <div className="text-lg font-bold text-ink mt-2 leading-tight">{top.outcomeLabel} <span className="text-ink-3 text-sm font-normal">· {top.marketLabel}</span></div>
      <p className="text-sm text-ink-2 mt-1">Odd {top.bestOdd.toFixed(2)} · paga {fmtEdge(top.edge)} acima da chance justa ({fmtPct(top.fairProb)}). Existe, mas é pequeno.</p>
      {second && <p className="text-[12px] text-ink-3 mt-2">2ª opção: <b className="text-ink-2">{second.outcomeLabel}</b> ({second.marketLabel}) · odd {second.bestOdd.toFixed(2)} · {fmtEdge(second.edge)}</p>}
      <p className="text-[10px] text-ink-3 mt-3">{ruler}</p>
    </div>
  );
}

// "Explorar mercados" — board completo por abas, recolhido por padrão
function ExploreMarkets({ markets }: { markets: ValueMarket[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-line border-l-4 border-l-forest/40 rounded-rebrand-xl p-5 mt-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-left">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-ink-3 font-semibold">Odds reais · devig vs linha sharp</div>
          <div className="text-base font-bold text-ink">Explorar mercados</div>
        </div>
        <ChevronDown className={`w-5 h-5 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="mt-4"><ValueMarketBoard markets={markets} /></div>
      ) : (
        <p className="text-[11px] text-ink-3 mt-1">Resultado, gols (over/under), ambos marcam e dupla chance — odds e chance por mercado.</p>
      )}
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
  const { data: oddsRows } = useFutebolFixtureOdds(fid);
  const value = useMemo(() => {
    if (!fixture || !oddsRows?.length) return null;
    return computeFixtureValue(oddsRows, fixture.home_team_name, fixture.away_team_name);
  }, [oddsRows, fixture]);
  const { data: pred } = useFutebolFixturePrediction(fid);
  const hasRail = !!(pred?.has_prediction || tendencies);
  const h2hHomeWins = h2h?.filter((m) => m.winner_team_id === fixture?.home_team_id).length ?? 0;
  const h2hAwayWins = h2h?.filter((m) => m.winner_team_id === fixture?.away_team_id).length ?? 0;
  const h2hDraws = h2h?.filter((m) => m.winner_team_id == null).length ?? 0;
  const h2hTotal = h2h?.length ?? 0;
  const h2hPct = (n: number) => (h2hTotal ? (n / h2hTotal) * 100 : 0);
  const stats = data?.stats || [];
  const home = stats.find((s) => s.team_side === 'home');
  const away = stats.find((s) => s.team_side === 'away');
  const finished = fixture?.status_short === 'FT' || fixture?.status_short === 'AET' || fixture?.status_short === 'PEN';

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

            {/* Conteúdo principal — 2 colunas */}
            <div className="mt-4 grid lg:grid-cols-12 gap-4 items-start">
              {/* Esquerda: o que olhar (síntese) + explorar mercados */}
              {value && value.markets.length > 0 && (
                <div className={hasRail ? 'lg:col-span-8' : 'lg:col-span-12'}>
                  <WhatToWatch value={value} />
                  <ExploreMarkets markets={value.markets} />
                </div>
              )}

              {/* Direita: contexto (modelo da API + nossa leitura) */}
              {hasRail && (
              <div className={`${value && value.markets.length > 0 ? 'lg:col-span-4' : 'lg:col-span-12'} space-y-4`}>

                {/* Segunda opinião — modelo da própria API-Football (referência) */}
                {pred?.has_prediction && (
              <div className="bg-amber/[0.04] border border-amber/25 rounded-rebrand-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-ink">Segunda opinião</span>
                  <span className="text-[10px] uppercase tracking-wide text-ink-3">modelo da API · referência</span>
                </div>
                <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-1">Quem vence (1X2)</p>
                {[
                  { label: fixture.home_team_name, pct: pred.prob_home_pct ?? 0 },
                  { label: 'Empate', pct: pred.prob_draw_pct ?? 0 },
                  { label: fixture.away_team_name, pct: pred.prob_away_pct ?? 0 },
                ].map((r) => (
                  <div key={r.label} className="py-1.5">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-ink truncate">{r.label}</span>
                      <span className="font-bold text-ink tabular-nums">{Math.round(r.pct)}%</span>
                    </div>
                    <div className="h-1.5 rounded bg-canvas-2 overflow-hidden">
                      <div className="h-full bg-forest" style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} />
                    </div>
                  </div>
                ))}

                {(() => {
                  const dims = [
                    { label: 'Forma', h: pred.cmp_form_home, a: pred.cmp_form_away },
                    { label: 'Ataque', h: pred.cmp_att_home, a: pred.cmp_att_away },
                    { label: 'Defesa', h: pred.cmp_def_home, a: pred.cmp_def_away },
                    { label: 'Tendência', h: pred.cmp_poisson_home, a: pred.cmp_poisson_away },
                    { label: 'Confronto direto', h: pred.cmp_h2h_home, a: pred.cmp_h2h_away },
                    { label: 'Gols', h: pred.cmp_goals_home, a: pred.cmp_goals_away },
                    { label: 'Geral', h: pred.cmp_total_home, a: pred.cmp_total_away },
                  ].filter((d) => (d.h ?? 0) + (d.a ?? 0) > 0);
                  if (!dims.length) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-line">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-forest truncate">{fixture.home_team_name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-ink-3">comparativo do modelo</span>
                        <span className="text-[11px] font-bold text-amber-2 truncate text-right">{fixture.away_team_name}</span>
                      </div>
                      {dims.map((d) => {
                        const h = d.h ?? 0, a = d.a ?? 0;
                        const hPct = h + a > 0 ? (h / (h + a)) * 100 : 50;
                        return (
                          <div key={d.label} className="py-1.5">
                            <div className="flex items-center justify-between text-[11px] mb-1 tabular-nums">
                              <span className="font-bold text-ink w-8">{Math.round(h)}</span>
                              <span className="text-[10px] text-ink-3 uppercase tracking-wide">{d.label}</span>
                              <span className="font-bold text-ink w-8 text-right">{Math.round(a)}</span>
                            </div>
                            <div className="flex h-1.5 rounded overflow-hidden bg-canvas-2">
                              <div className="bg-forest" style={{ width: `${hPct}%` }} />
                              <div className="bg-amber" style={{ width: `${100 - hPct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <p className="text-[10px] text-ink-3 mt-3 leading-snug">
                  Probabilidades e comparativo do modelo da própria API-Football, separado do nosso. Usamos como <b className="text-ink-2">referência</b> pra checar se o valor do mercado tem respaldo — não é recomendação.
                </p>
              </div>
            )}

                {/* Leitura do Jogo — nosso modelo de gols */}
                {tendencies && (
                  <div className="bg-forest/[0.04] border border-forest/25 rounded-rebrand-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-ink">Leitura do Jogo</span>
                      <span className="text-[10px] uppercase tracking-wide text-ink-3">nosso modelo</span>
                    </div>
                    <GoalDistChart lh={tendencies.lambdas.lh} la={tendencies.lambdas.la} />
                    {head && (
                      <div className="rounded-rebrand-sm bg-canvas-2 border border-line p-3 mt-3">
                        <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-1">Leitura principal · {head.group}</p>
                        <div className="flex items-end justify-between gap-2">
                          <span className="text-base font-bold text-ink leading-tight">{head.label}</span>
                          <span className="text-2xl font-extrabold text-forest tabular-nums leading-none">{Math.round(head.prob * 100)}%</span>
                        </div>
                        <p className="text-xs text-ink-2 mt-1">{head.reading}</p>
                      </div>
                    )}
                    <div className="divide-y divide-line mt-2">
                      {tendencies.markets.filter((mk) => mk.key !== head?.key).map((mk) => (
                        <TendencyRow key={mk.key} m={mk} />
                      ))}
                    </div>
                    <p className="text-[10px] text-ink-3 mt-3 leading-snug">
                      Estimativa do nosso modelo de gols sobre as médias oficiais (com mando). Referência, não recomendação.
                    </p>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Estatística descritiva (só quando há dado) */}
            {hasDescriptive && (
            <div className="mt-4">
              <Tabs defaultValue="stats">
                <TabsList className="bg-canvas-2 border border-line">
                  <TabsTrigger value="stats" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Estatísticas</TabsTrigger>
                  <TabsTrigger value="lances" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Lances</TabsTrigger>
                  <TabsTrigger value="form" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Forma & H2H</TabsTrigger>
                  <TabsTrigger value="lineups" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Escalação</TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="mt-3">
                  <div className={`${CARD} p-5`}>
                    {home || away ? (
                      <>
                        <div className="flex items-center justify-between text-[11px] mb-2">
                          <span className="text-forest font-bold">{fixture.home_team_name}</span>
                          <span className="text-amber-2 font-bold">{fixture.away_team_name}</span>
                        </div>
                        {STAT_ROWS.map((r) => (
                          <StatRow
                            key={r.key}
                            label={r.label}
                            home={(home?.[r.key] as number | null) ?? null}
                            away={(away?.[r.key] as number | null) ?? null}
                          />
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-ink-3 text-center py-4">Estatísticas disponíveis após o jogo.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="lances" className="mt-3">
                  <div className={`${CARD} p-5`}>
                    {extrasLoading ? (
                      <p className="text-sm text-ink-3 text-center py-4">Carregando lances…</p>
                    ) : extras?.events?.length ? (
                      <div className="divide-y divide-line">
                        {extras.events.map((e, i) => <EventRow key={i} e={e} />)}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-3 text-center py-4">Lances disponíveis após o jogo.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="form" className="mt-3 space-y-3">
                  <div className={`${CARD} p-4 space-y-3`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink truncate">{fixture.home_team_name}</span>
                      {extrasLoading ? <span className="text-xs text-ink-3">…</span> : <FormChips form={extras?.form_home || []} />}
                    </div>
                    <div className="h-px bg-line" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink truncate">{fixture.away_team_name}</span>
                      {extrasLoading ? <span className="text-xs text-ink-3">…</span> : <FormChips form={extras?.form_away || []} />}
                    </div>
                  </div>

                  <div className={`${CARD} p-5`}>
                    <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-2">Confrontos diretos</p>
                    {h2hLoading ? (
                      <p className="text-xs text-ink-3">Carregando…</p>
                    ) : h2h && h2h.length ? (
                      <>
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-bold text-forest tabular-nums">{h2hHomeWins}</span>
                            <span className="text-[11px] text-ink-3">{h2hDraws} empate{h2hDraws === 1 ? '' : 's'}</span>
                            <span className="font-bold text-amber-2 tabular-nums">{h2hAwayWins}</span>
                          </div>
                          <div className="flex h-1.5 rounded overflow-hidden bg-canvas-2">
                            <div className="bg-forest" style={{ width: `${h2hPct(h2hHomeWins)}%` }} />
                            <div className="bg-ink-3" style={{ width: `${h2hPct(h2hDraws)}%`, opacity: 0.4 }} />
                            <div className="bg-amber" style={{ width: `${h2hPct(h2hAwayWins)}%` }} />
                          </div>
                          <p className="text-[10px] text-ink-3 mt-1">
                            {h2hTotal} confronto{h2hTotal === 1 ? '' : 's'} — vitórias de {fixture.home_team_name} × {fixture.away_team_name}
                          </p>
                        </div>
                        <div className="space-y-1">
                          {h2h.map((m) => {
                            const homeWon = (m.goals_home ?? 0) > (m.goals_away ?? 0);
                            const awayWon = (m.goals_away ?? 0) > (m.goals_home ?? 0);
                            return (
                              <div key={m.fixture_id} className="flex items-center gap-2 text-sm">
                                <span className="text-[11px] text-ink-3 w-12 shrink-0">{fmtDate(m.date_utc)}</span>
                                <span className={`flex-1 text-right truncate ${homeWon ? 'text-ink font-semibold' : 'text-ink-2'}`}>{m.home_team_name}</span>
                                <span className="px-2 font-bold tabular-nums text-ink">{m.goals_home}-{m.goals_away}</span>
                                <span className={`flex-1 truncate ${awayWon ? 'text-ink font-semibold' : 'text-ink-2'}`}>{m.away_team_name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-ink-3">Sem confrontos diretos no histórico.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="lineups" className="mt-3 space-y-3">
                  {destaques.length > 0 && (
                    <div className={`${CARD} p-3`}>
                      <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-2">Destaques · nota</p>
                      <div className="grid grid-cols-3 gap-2">
                        {destaques.map((d) => (
                          <div key={d.player_id} className="text-center">
                            {d.rating != null && <RatingBadge value={d.rating} />}
                            <div className="text-xs text-ink truncate mt-1">{d.player_name}</div>
                            <div className="text-[10px] text-ink-3">
                              {[d.goals ? `${d.goals}G` : null, d.assists ? `${d.assists}A` : null].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {injuries && injuries.length > 0 && (
                    <div className={`${CARD} p-5`}>
                      <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-2">Desfalques</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InjuryCol injuries={injuries} teamId={fixture.home_team_id} teamName={fixture.home_team_name} />
                        <InjuryCol injuries={injuries} teamId={fixture.away_team_id} teamName={fixture.away_team_name} />
                      </div>
                    </div>
                  )}
                  <div className={`${CARD} p-5`}>
                    {extrasLoading ? (
                      <p className="text-sm text-ink-3 text-center py-4">Carregando escalação…</p>
                    ) : extras?.lineup_players?.length ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm font-semibold text-ink mb-2">
                            {fixture.home_team_name}
                            {extras.lineups.find((l) => l.team_side === 'home')?.formation && (
                              <span className="ml-2 text-[10px] text-amber-2 font-bold">
                                {extras.lineups.find((l) => l.team_side === 'home')?.formation}
                              </span>
                            )}
                          </p>
                          <LineupColumn players={extras.lineup_players} side="home" statsById={statsById} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink mb-2">
                            {fixture.away_team_name}
                            {extras.lineups.find((l) => l.team_side === 'away')?.formation && (
                              <span className="ml-2 text-[10px] text-amber-2 font-bold">
                                {extras.lineups.find((l) => l.team_side === 'away')?.formation}
                              </span>
                            )}
                          </p>
                          <LineupColumn players={extras.lineup_players} side="away" statsById={statsById} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-3 text-center py-4">Escalação disponível próximo ao jogo.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
