import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Zap } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import FutebolSubNav from '@/components/FutebolSubNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolFixtures, useFutebolOddsBoard } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import { computeBoardOpportunities, fmtPct, fmtEdge, type Opportunity } from '@/utils/futebol-value';
import type { FutebolFixture } from '@/services/futebol-data.service';

const SAO_PAULO_TZ = 'America/Sao_Paulo';
const COMP_LABEL: Record<string, string> = { brasileirao: 'Brasileirão', copa_mundo: 'Copa do Mundo' };

function parseUtc(raw: string | null): Date | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}
/** Data no fuso de SP no formato YYYY-MM-DD (pra comparar "é hoje?"). */
function brtDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function fmtTime(raw: string | null): string {
  const d = parseUtc(raw);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, hour: '2-digit', minute: '2-digit' }).format(d);
}
function fmtDayTime(raw: string | null): string {
  const d = parseUtc(raw);
  if (!d) return '—';
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtTodayHeader(d: Date): string {
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, weekday: 'long', day: '2-digit', month: 'long' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function isFinished(s: string | null): boolean {
  return s === 'FT' || s === 'AET' || s === 'PEN';
}
function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}
function Crest({ teamId, name }: { teamId: number; name: string }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) return <img src={logo} alt={name} onError={() => setErr(true)} className="w-6 h-6 object-contain" loading="lazy" />;
  return <div className="w-6 h-6 rounded-full bg-canvas-2 border border-line flex items-center justify-center text-[9px] font-bold text-ink-2">{crestInitials(name)}</div>;
}

const CARD = 'bg-white border border-line rounded-rebrand-md';

function ValueChip({ edge }: { edge: number }) {
  if (edge >= 0.015) return <span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-forest text-canvas tabular-nums">{fmtEdge(edge)}</span>;
  if (edge >= 0) return <span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-forest/15 text-forest border border-forest/40 tabular-nums">{fmtEdge(edge)}</span>;
  return <span className="text-[10px] text-ink-3">odds</span>;
}

function GameRow({ f, edge, onClick }: { f: FutebolFixture & { competition?: string }; edge: number | null; onClick: () => void }) {
  const finished = isFinished(f.status_short);
  return (
    <button onClick={onClick} className={`${CARD} w-full flex items-center gap-3 px-3 py-2.5 hover:border-line-2 transition-colors`}>
      <span className="w-12 text-[10px] text-ink-3 text-left shrink-0">{finished ? 'fim' : fmtTime(f.kickoff_utc)}</span>
      <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
        <span className="text-sm text-ink truncate text-right">{f.home_team_name}</span>
        <Crest teamId={f.home_team_id} name={f.home_team_name} />
      </div>
      <span className="text-[11px] text-ink-3 font-semibold tabular-nums shrink-0">
        {finished ? `${f.goals_home ?? '-'}–${f.goals_away ?? '-'}` : 'x'}
      </span>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Crest teamId={f.away_team_id} name={f.away_team_name} />
        <span className="text-sm text-ink truncate">{f.away_team_name}</span>
      </div>
      <span className="w-12 text-right shrink-0">{edge != null ? <ValueChip edge={edge} /> : null}</span>
    </button>
  );
}

function ValueHighlight({ o, onClick }: { o: Opportunity; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${CARD} w-full text-left p-3 hover:border-line-2 transition-colors`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-ink-3 mb-0.5">{COMP_LABEL[o.competition] || o.competition} · {fmtDayTime(o.kickoffUtc)}</p>
          <p className="text-sm font-semibold text-ink truncate">{o.homeName} <span className="text-ink-3 font-normal">x</span> {o.awayName}</p>
          <p className="text-[11px] text-ink-2 mt-0.5"><span className="text-ink-3">{o.marketLabel}:</span> <b>{o.outcomeLabel}</b> · {o.bestOdd.toFixed(2)} {o.bestBook}</p>
        </div>
        <span className={`text-sm font-extrabold rounded px-1.5 py-0.5 tabular-nums shrink-0 ${o.edge >= 0.015 ? 'bg-forest text-canvas' : 'bg-forest/15 text-forest border border-forest/40'}`}>{fmtEdge(o.edge)}</span>
      </div>
    </button>
  );
}

export default function FutebolHoje() {
  const navigate = useNavigate();
  const { data: brasil, isLoading: l1 } = useFutebolFixtures('brasileirao', 2026);
  const { data: copa, isLoading: l2 } = useFutebolFixtures('copa_mundo', 2026);
  const { data: oddsRows, isLoading: l3 } = useFutebolOddsBoard();
  const loading = l1 || l2 || l3;

  const today = new Date();
  const todayStr = brtDateStr(today);

  const board = useMemo(() => (oddsRows?.length ? computeBoardOpportunities(oddsRows) : null), [oddsRows]);
  const edgeByFixture = useMemo(() => {
    const m = new Map<number, number>();
    board?.monitored.forEach((mf) => m.set(mf.fixtureId, mf.bestEdge));
    return m;
  }, [board]);

  // todos os jogos das 2 competições, com a competição anexada
  const allGames = useMemo(() => {
    const tag = (arr: FutebolFixture[] | undefined, c: string) => (arr || []).map((f) => ({ ...f, competition: c }));
    return [...tag(brasil, 'brasileirao'), ...tag(copa, 'copa_mundo')];
  }, [brasil, copa]);

  const todayGames = useMemo(() => {
    return allGames
      .filter((f) => {
        const d = parseUtc(f.kickoff_utc || f.date_utc);
        return d ? brtDateStr(d) === todayStr : false;
      })
      .sort((a, b) => (parseUtc(a.kickoff_utc)?.getTime() ?? 0) - (parseUtc(b.kickoff_utc)?.getTime() ?? 0));
  }, [allGames, todayStr]);

  const proximos = useMemo(() => {
    const now = Date.now();
    return allGames
      .filter((f) => !isFinished(f.status_short))
      .map((f) => ({ f, t: parseUtc(f.kickoff_utc || f.date_utc)?.getTime() ?? Infinity }))
      .filter((x) => x.t >= now)
      .sort((a, b) => a.t - b.t)
      .slice(0, 6)
      .map((x) => x.f);
  }, [allGames]);

  const topValue = board?.opportunities.slice(0, 3) ?? [];
  const showingToday = todayGames.length > 0;
  const list = showingToday ? todayGames : proximos;
  const comValor = todayGames.filter((f) => (edgeByFixture.get(f.fixture_id) ?? -1) >= 0).length;

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <FutebolSubNav />
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex-1">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-extrabold text-ink">{fmtTodayHeader(today)}</h1>
          <p className="text-sm text-ink-2">
            {showingToday
              ? `${todayGames.length} jogo${todayGames.length === 1 ? '' : 's'} hoje${comValor ? ` · ${comValor} com valor` : ''}`
              : 'Sem jogos hoje — próximos na agenda'}
          </p>
        </div>

        {/* Destaques de valor */}
        {!loading && topValue.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-forest" /> Destaques de valor
              </p>
              <button onClick={() => navigate('/futebol/oportunidades')} className="flex items-center gap-0.5 text-[11px] text-forest hover:text-forest-2 font-semibold">
                Ver todas <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {topValue.map((o) => (
                <ValueHighlight key={`${o.fixtureId}-${o.marketKey}-${o.outcomeKey}`} o={o} onClick={() => navigate(`/futebol/jogo/${o.fixtureId}`)} />
              ))}
            </div>
          </div>
        )}

        {/* Jogos (hoje, ou próximos no fallback) */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3 mb-2 px-1">
            {showingToday ? 'Jogos de hoje' : 'Próximos jogos'}
          </p>
          {loading ? (
            <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
          ) : list.length === 0 ? (
            <div className={`${CARD} p-6 text-center text-sm text-ink-3`}>Sem jogos na agenda.</div>
          ) : (
            <div className="space-y-1.5">
              {list.map((f) => (
                <GameRow
                  key={f.fixture_id}
                  f={f}
                  edge={edgeByFixture.has(f.fixture_id) ? (edgeByFixture.get(f.fixture_id) as number) : null}
                  onClick={() => navigate(`/futebol/jogo/${f.fixture_id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Explorar (contexto secundário) */}
        <button
          onClick={() => navigate('/futebol/jogos')}
          className={`${CARD} w-full flex items-center gap-3 px-4 py-3 hover:border-line-2 transition-colors text-left`}
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Explorar jogos</p>
            <p className="text-[11px] text-ink-3">Rodadas, classificação e artilheiros por competição</p>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-3" />
        </button>
      </div>
    </div>
  );
}
