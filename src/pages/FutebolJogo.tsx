import { useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MapPin, AlertTriangle, ChevronDown, Check } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFutebolFixtureDetail, useFutebolFixtureExtras, useFutebolMatchupTendencies, useFutebolFixtureValue, useFutebolH2H, useFutebolFixtureInjuries } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  computeMatchupTendencies, headlineMarket, STRENGTH_LABEL,
  type MarketTendency, type Strength,
} from '@/utils/futebol-tendencias';
import {
  pickLabel, marketLabel, valorVerdict, freqEmDez, fmtEdgeScore,
  faixaWord, faixaBadgeCls, SCORE_ALTA, SCORE_MEDIA,
} from '@/utils/futebol-score';
import type {
  FutebolEvent, FutebolFormResult, FutebolInjury, FutebolLineupPlayer, FutebolPlayerStat, FutebolTeamStats, FutebolFixtureValueRow,
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
function PorQueList({ items, dark, warn }: { items: string[]; dark?: boolean; warn?: boolean }) {
  if (!items.length) return null;
  const Icon = warn ? AlertTriangle : Check;
  const ic = dark ? (warn ? 'text-amber-200' : 'text-emerald-300') : (warn ? 'text-status-warning' : 'text-status-success');
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className={`flex items-start gap-2 text-[13px] ${dark ? 'text-white/85' : 'text-ink-2'}`}>
          <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ic}`} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

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
  const tinted = top.score >= SCORE_ALTA;
  const x10 = freqEmDez(top.best_odd);
  const freq = `Na odd ${top.best_odd.toFixed(2)}, essa aposta se paga se acontecer ${x10} em cada 10 vezes ou mais — e a leitura do jogo aponta nessa direção:`;
  const porque = top.evidencias ?? [];
  // Pontos de atenção: contras (premissas que não bateram) + avisos (penalidades)
  const atencao = [...(top.contras ?? []), ...(top.avisos ?? [])];
  const secondLine = second && (
    <>2ª opção: <b>{pickLabel(second.market, second.outcome, second.line_value, homeName, awayName)}</b> <span className="opacity-70">({marketLabel(second.market)})</span> a {second.best_odd.toFixed(2)}</>
  );

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

  if (tinted) {
    return (
      <div className="rounded-rebrand-xl overflow-hidden relative text-white" style={{ background: 'linear-gradient(135deg, #0a3d2e 0%, #08321f 60%, #051f12 100%)' }}>
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.16), transparent 70%)', transform: 'translate(70px,-70px)' }} />
        <div className="relative p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/50 font-semibold">O que olhar neste jogo</div>
              <span className="inline-flex items-center px-2 h-6 rounded-md text-[10px] uppercase tracking-[0.12em] font-bold mt-2" style={{ background: '#fbbf24', color: '#1a1d1a' }}>{verdict}</span>
              <div className="text-xl font-bold mt-2 leading-tight">{pick} <span className="text-white/50 text-sm font-normal">· {marketLabel(top.market)}</span></div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/50">Confiabilidade</div>
              <div className="flex items-baseline justify-end gap-1 mt-1"><span className="text-5xl font-bold tabular-nums leading-none" style={{ color: '#fbbf24' }}>{top.score}</span><span className="text-sm text-white/40">/100</span></div>
              <div className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: '#fbbf24' }}>{faixaWord(top.faixa)}</div>
            </div>
          </div>
          <p className="text-[13px] text-white/75 mt-2.5">{freq}</p>
          {porque.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">Por que</div>
              <PorQueList items={porque} dark />
            </div>
          )}
          {atencao.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/45 font-semibold">Pontos de atenção</div>
              <PorQueList items={atencao} dark warn />
            </div>
          )}
          {crossNote && <p className="mt-4 pt-3 border-t border-white/10 text-[12px] text-white/65">{crossNote}</p>}
          {second && <div className="mt-3 text-[12px] text-white/70">{secondLine}</div>}
          <p className="text-[10px] text-white/45 mt-3">{note}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-rebrand-xl border border-line border-l-4 border-l-amber bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-3">O que olhar neste jogo</div>
          <span className="inline-block mt-1.5 text-[10px] font-bold rounded px-1.5 py-0.5 bg-amber/15 text-amber-2 border border-amber/30 uppercase tracking-[0.1em]">{verdict}</span>
          <div className="text-lg font-bold text-ink mt-2 leading-tight">{pick} <span className="text-ink-3 text-sm font-normal">· {marketLabel(top.market)}</span></div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">Confiab.</div>
          <div className="text-3xl font-bold tabular-nums text-ink leading-none mt-0.5">{top.score}<span className="text-sm text-ink-3 font-normal">/100</span></div>
          <span className={`inline-block mt-1 text-[10px] font-bold rounded px-1.5 py-0.5 ${faixaBadgeCls(top.faixa)}`}>{faixaWord(top.faixa)}</span>
        </div>
      </div>
      <p className="text-sm text-ink-2 mt-2">{freq}</p>
      {porque.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-ink-3 font-semibold">Por que</div>
          <PorQueList items={porque} />
        </div>
      )}
      {atencao.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-ink-3 font-semibold">Pontos de atenção</div>
          <PorQueList items={atencao} warn />
        </div>
      )}
      {crossNote && <p className="text-[12px] text-ink-3 mt-3 pt-3 border-t border-line">{crossNote}</p>}
      {second && <p className="text-[12px] text-ink-3 mt-2">{secondLine}</p>}
      <p className="text-[10px] text-ink-3 mt-3">{note}</p>
    </div>
  );
}

// "Explorar opções" — todas as apostas com valor por mercado, recolhido.
function ResultExplorer({ rows, homeName, awayName }: { rows: FutebolFixtureValueRow[]; homeName: string; awayName: string }) {
  const [open, setOpen] = useState(true);
  // agrupa por mercado, preservando a ordem (1X2 antes de Gols) e ordenando outcomes
  const markets = [...new Set(rows.map((r) => r.market))];
  return (
    <div className="bg-white border border-line border-l-4 border-l-forest/40 rounded-rebrand-xl p-5">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-left">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-ink-3 font-semibold">Valor por opção</div>
          <div className="text-base font-bold text-ink">Explorar opções</div>
        </div>
        <ChevronDown className={`w-5 h-5 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="mt-3">
          {/* Cabeçalho de colunas */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-3 font-semibold">
            <span>Aposta</span>
            <div className="flex items-center gap-3">
              <span className="w-14 text-right">Odd</span>
              <span className="w-16 text-right">Valor</span>
              <span className="w-10 text-center" title="Score de Confiabilidade (0–100)">Score</span>
            </div>
          </div>
          <div className="space-y-4 mt-1">
          {markets.map((mk) => {
            const list = rows.filter((r) => r.market === mk).sort((a, b) => a.outcome_order - b.outcome_order);
            return (
              <div key={mk}>
                <div className="text-[11px] uppercase tracking-[0.12em] text-forest font-semibold mb-1 mt-2">{marketLabel(mk)}</div>
                <div className="divide-y divide-line">
                  {list.map((r) => (
                    <div key={`${r.outcome}-${r.line_value}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm font-semibold text-ink">{pickLabel(r.market, r.outcome, r.line_value, homeName, awayName)}</span>
                      <div className="flex items-center gap-3 text-[12px] tabular-nums">
                        <span className="text-ink-2 w-14 text-right">{r.best_odd.toFixed(2)}</span>
                        <span className="text-forest font-semibold w-16 text-right">{fmtEdgeScore(r.edge)}</span>
                        <span className={`text-[11px] font-bold rounded px-1.5 py-0.5 w-10 text-center ${faixaBadgeCls(r.faixa)}`} title="Score de Confiabilidade">{r.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-ink-3 mt-1">Todas as apostas com valor (Resultado, Gols, Handicap e Ambos marcam), com score e odd. Outros mercados entram conforme liberados no backend.</p>
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
  // Score vem PRONTO do backend (fact_value_opportunities). 1X2 por enquanto.
  const { data: valueRows } = useFutebolFixtureValue(fid);
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

            {/* Conteúdo principal — veredito (esq) + rail (modelo + explorar opções) */}
            {(showValue || tendencies) && (
            <div className="mt-4 grid lg:grid-cols-12 gap-4 items-start">
              {/* Veredito: o que olhar (síntese) */}
              {showValue && valueRows && (
                <div className="lg:col-span-7">
                  <WhatToWatch rows={valueRows} homeName={fixture.home_team_name} awayName={fixture.away_team_name} />
                </div>
              )}

              {/* Rail: nosso modelo de gols (quando há amostra) + explorar opções */}
              <div className={`${showValue ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-4`}>
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
                {showValue && valueRows && (
                  <ResultExplorer rows={valueRows} homeName={fixture.home_team_name} awayName={fixture.away_team_name} />
                )}
              </div>
            </div>
            )}

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
