import { useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, MapPin, AlertTriangle } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFutebolFixtureDetail, useFutebolFixtureExtras, useFutebolMatchupMarkets, useFutebolMatchupTendencies, useFutebolFixtureOdds, useFutebolFixturePrediction, useFutebolH2H, useFutebolFixtureInjuries } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  computeMatchupTendencies, headlineMarket, STRENGTH_LABEL,
  type MarketTendency, type Strength,
} from '@/utils/futebol-tendencias';
import {
  computeFixtureValue, fmtPct, fmtEdge, fmtStake, HERO_MIN_SCORE,
  type ValueOutcome, type ValueTier,
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

const VALUE_TIER: Record<ValueTier, string> = {
  value: 'bg-forest text-canvas',
  slight: 'bg-forest/15 text-forest border border-forest/40',
  fair: 'bg-canvas-2 text-ink-3 border border-line',
  low: 'bg-canvas-2 text-ink-3 border border-line',
};

function ValueRow({ o }: { o: ValueOutcome }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="flex-1 min-w-0 truncate text-sm text-ink">
        {o.outcomeLabel}
        {o.suspect && <AlertTriangle className="inline w-3 h-3 text-amber-2 ml-1 align-[-1px]" />}
      </span>
      <span className="text-[10px] text-ink-3 tabular-nums hidden sm:inline">chance {fmtPct(o.fairProb)}</span>
      {o.moveDir && (
        <span className={`text-[10px] ${o.moveDir === 'up' ? 'text-status-success' : 'text-status-danger'}`} title="movimento da linha sharp">
          {o.moveDir === 'up' ? '▲' : '▼'}
        </span>
      )}
      <span className="text-right tabular-nums">
        <span className="font-bold text-ink">{o.bestOdd.toFixed(2)}</span>
      </span>
      <span className="text-[10px] text-ink-3 tabular-nums w-12 text-right">{fmtEdge(o.edge)}</span>
      <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0 tabular-nums w-9 text-center ${VALUE_TIER[o.tier]}`} title="Score de Confiabilidade (0–100)">
        {o.score}
      </span>
    </div>
  );
}

function MarketCmp({ label, home, away, suffix = '' }: { label: string; home: number | null | undefined; away: number | null | undefined; suffix?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="w-14 font-bold text-ink tabular-nums">{home ?? '—'}{home != null ? suffix : ''}</span>
      <span className="flex-1 text-center text-[11px] text-ink-3 uppercase tracking-wide">{label}</span>
      <span className="w-14 text-right font-bold text-ink tabular-nums">{away ?? '—'}{away != null ? suffix : ''}</span>
    </div>
  );
}

const CARD = 'bg-white border border-line rounded-rebrand-md';

export default function FutebolJogo() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const fid = fixtureId ? Number(fixtureId) : undefined;
  const { data, isLoading, isError } = useFutebolFixtureDetail(fid);
  const { data: extras, isLoading: extrasLoading } = useFutebolFixtureExtras(fid);

  const fixture = data?.fixture;
  const { data: markets } = useFutebolMatchupMarkets(
    fixture?.home_team_id, fixture?.away_team_id, fixture?.competition, fixture?.season
  );
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

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex-1">
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
            <div className={`${CARD} p-4`}>
              <div className="flex items-center justify-center gap-2 mb-3 text-[10px] uppercase tracking-wide text-ink-3">
                <span>{prettyRound(fixture.round)}</span>
                {fixture.venue_name && (
                  <><span>•</span><MapPin className="w-3 h-3" /><span>{fixture.venue_name}{fixture.venue_city ? `, ${fixture.venue_city}` : ''}</span></>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigate(`/futebol/time/${fixture.home_team_id}?c=${fixture.competition}&s=${fixture.season}`)}
                  className="flex-1 flex flex-col items-center gap-2 group"
                >
                  <Crest name={fixture.home_team_name} logo={getFutebolTeamLogoUrl(fixture.home_team_id)} />
                  <span className="text-sm text-ink font-medium text-center group-hover:text-forest">{fixture.home_team_name}</span>
                </button>
                <div className="px-4 text-center">
                  {finished ? (
                    <div className="text-3xl font-extrabold text-ink tabular-nums">
                      {fixture.goals_home ?? '-'} <span className="text-ink-3">:</span> {fixture.goals_away ?? '-'}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-ink-2">{fmtDateTime(fixture.kickoff_utc)}</div>
                  )}
                  <div className="text-[10px] text-ink-3 mt-1">
                    {finished ? 'Encerrado' : (fixture.status_long || 'Agendado')}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/futebol/time/${fixture.away_team_id}?c=${fixture.competition}&s=${fixture.season}`)}
                  className="flex-1 flex flex-col items-center gap-2 group"
                >
                  <Crest name={fixture.away_team_name} logo={getFutebolTeamLogoUrl(fixture.away_team_id)} />
                  <span className="text-sm text-ink font-medium text-center group-hover:text-forest">{fixture.away_team_name}</span>
                </button>
              </div>
            </div>

            {/* Mercado & Valor — odds reais (devig vs linha sharp) */}
            {value && value.markets.length > 0 && (
              <div className={`${CARD} mt-3 p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-ink">Mercado &amp; Valor</span>
                  <span className="text-[10px] uppercase tracking-wide text-ink-3">valor por mercado</span>
                </div>

                {value.best && value.best.score >= HERO_MIN_SCORE && !value.best.suspect ? (
                  <div className="rounded-rebrand-sm border p-3 mb-3 bg-forest/10 border-forest/40">
                    <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-1">Melhor valor · {value.best.marketLabel}</p>
                    <div className="flex items-end justify-between gap-2">
                      <span className="text-base font-bold text-ink leading-tight">{value.best.outcomeLabel}</span>
                      <span className="flex items-baseline gap-0.5">
                        <span className="text-2xl font-extrabold text-forest tabular-nums leading-none">{value.best.score}</span>
                        <span className="text-[11px] text-ink-3">/100</span>
                      </span>
                    </div>
                    <p className="text-xs text-ink-2 mt-1">
                      odd <b>{value.best.bestOdd.toFixed(2)}</b> · valor {fmtEdge(value.best.edge)} · chance {fmtPct(value.best.fairProb)} · banca {fmtStake(value.best.stake)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-rebrand-sm border p-3 mb-3 bg-canvas-2 border-line">
                    <p className="text-xs text-ink-2">
                      Sem valor claro neste jogo — as melhores odds estão perto da linha justa do mercado. Preços e score por mercado abaixo.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {value.markets.map((m) => (
                    <div key={m.key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-bold text-ink-2">{m.label}</span>
                        <span className="text-[10px] text-ink-3">
                          chance: {m.anchor === 'pinnacle' ? 'linha sharp' : 'consenso'}
                        </span>
                      </div>
                      <div className="divide-y divide-line">
                        {m.outcomes.map((o) => <ValueRow key={o.outcomeKey} o={o} />)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-line">
                  <Info className="w-3.5 h-3.5 text-amber-2 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-ink-3 leading-snug">
    O <b className="text-ink-2">Score (0–100)</b> combina valor (edge vs linha justa devigada da Pinnacle), gestão de banca (Kelly), odd numa banda sã e confirmação entre casas — zebra com edge alto mas 1 casa só fica com score baixo (linha suspeita). Odds em T-24h/T-1h (não ao vivo). Não é recomendação de aposta.
                  </p>
                </div>
              </div>
            )}

            {/* Segunda opinião — modelo da própria API-Football (referência, não recomendação) */}
            {pred?.has_prediction && (
              <div className={`${CARD} mt-3 p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-ink">Segunda opinião</span>
                  <span className="text-[10px] uppercase tracking-wide text-ink-3">modelo da API · referência</span>
                </div>
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
                <p className="text-[10px] text-ink-3 mt-2 leading-snug">
                  Probabilidades do modelo da própria API-Football, separado do nosso. Usamos como <b className="text-ink-2">referência</b> pra checar se o valor do mercado tem respaldo — não é recomendação.
                </p>
              </div>
            )}

            {/* Leitura do Jogo — tendências por mercado (modelo de gols) */}
            {tendencies ? (
              <div className={`${CARD} mt-3 p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-ink">Leitura do Jogo</span>
                  <span className="text-[10px] uppercase tracking-wide text-ink-3">tendências por mercado</span>
                </div>

                {head && (
                  <div className="rounded-rebrand-sm bg-canvas-2 border border-line p-3 mb-3">
                    <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-1">Leitura principal · {head.group}</p>
                    <div className="flex items-end justify-between gap-2">
                      <span className="text-base font-bold text-ink leading-tight">{head.label}</span>
                      <span className="text-2xl font-extrabold text-forest tabular-nums leading-none">{Math.round(head.prob * 100)}%</span>
                    </div>
                    <p className="text-xs text-ink-2 mt-1">{head.reading}</p>
                    <p className="text-[10px] text-ink-3 mt-1">Odd justa {head.fairOdds.toFixed(2)} — referência neutra do modelo.</p>
                  </div>
                )}

                <p className="text-[10px] text-ink-3 mb-1">
                  Gols esperados (modelo): <b className="text-forest">{fixture.home_team_name} {tendencies.lambdas.lh.toFixed(1)}</b>
                  {' × '}
                  <b className="text-amber-2">{tendencies.lambdas.la.toFixed(1)} {fixture.away_team_name}</b>
                </p>

                <div className="divide-y divide-line">
                  {tendencies.markets.filter((m) => m.key !== head?.key).map((m) => (
                    <TendencyRow key={m.key} m={m} />
                  ))}
                </div>

                {markets?.home && markets?.away && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-forest truncate">{fixture.home_team_name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-ink-3">Comparativo · temporada</span>
                      <span className="text-[11px] font-bold text-amber-2 truncate text-right">{fixture.away_team_name}</span>
                    </div>
                    <MarketCmp label="Mais de 2.5 gols" home={markets.home.over25_pct} away={markets.away.over25_pct} suffix="%" />
                    <MarketCmp label="Ambos marcam (BTTS)" home={markets.home.btts_pct} away={markets.away.btts_pct} suffix="%" />
                    <MarketCmp label="Média de gols feitos" home={markets.home.avg_gf} away={markets.away.avg_gf} />
                    <MarketCmp label="Média de gols sofridos" home={markets.home.avg_ga} away={markets.away.avg_ga} />
                  </div>
                )}

                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-line">
                  <Info className="w-3.5 h-3.5 text-amber-2 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-ink-3 leading-snug">
                    Estimativa do nosso modelo de gols sobre as médias oficiais da temporada (com mando).
                    Não é recomendação — o comparativo de <b className="text-ink-2">valor</b> contra a odd da casa entra quando as odds forem integradas.
                  </p>
                </div>
              </div>
            ) : markets?.home && markets?.away ? (
              <div className={`${CARD} mt-3 p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-forest truncate">{fixture.home_team_name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-ink-3">Tendências · temporada</span>
                  <span className="text-[11px] font-bold text-amber-2 truncate text-right">{fixture.away_team_name}</span>
                </div>
                <MarketCmp label="Mais de 2.5 gols" home={markets.home.over25_pct} away={markets.away.over25_pct} suffix="%" />
                <MarketCmp label="Ambos marcam (BTTS)" home={markets.home.btts_pct} away={markets.away.btts_pct} suffix="%" />
                <MarketCmp label="Média de gols feitos" home={markets.home.avg_gf} away={markets.away.avg_gf} />
                <MarketCmp label="Média de gols sofridos" home={markets.home.avg_ga} away={markets.away.avg_ga} />
                <p className="text-[10px] text-ink-3 mt-2">Frequência na temporada — descritivo, não é recomendação.</p>
              </div>
            ) : null}

            {/* Estatística descritiva */}
            <div className="mt-4">
              <Tabs defaultValue="stats">
                <TabsList className="bg-canvas-2 border border-line">
                  <TabsTrigger value="stats" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Estatísticas</TabsTrigger>
                  <TabsTrigger value="lances" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Lances</TabsTrigger>
                  <TabsTrigger value="form" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Forma & H2H</TabsTrigger>
                  <TabsTrigger value="lineups" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Escalação</TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="mt-3">
                  <div className={`${CARD} p-4`}>
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
                  <div className={`${CARD} p-4`}>
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

                  <div className={`${CARD} p-4`}>
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
                    <div className={`${CARD} p-4`}>
                      <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-2">Desfalques</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InjuryCol injuries={injuries} teamId={fixture.home_team_id} teamName={fixture.home_team_name} />
                        <InjuryCol injuries={injuries} teamId={fixture.away_team_id} teamName={fixture.away_team_name} />
                      </div>
                    </div>
                  )}
                  <div className={`${CARD} p-4`}>
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
          </>
        )}
      </div>
    </div>
  );
}
