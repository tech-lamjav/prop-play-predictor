import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Zap, ArrowRight } from 'lucide-react';
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
function Crest({ teamId, name, size = 24 }: { teamId: number; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  const cls = `object-contain shrink-0`;
  if (logo && !err) return <img src={logo} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className={cls} loading="lazy" />;
  return <div style={{ width: size, height: size }} className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[9px] font-bold text-ink-2 shrink-0">{crestInitials(name)}</div>;
}

const CARD = 'bg-white border border-line rounded-rebrand-md';
const LABEL = 'text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-3';

function edgeBadgeCls(edge: number): string {
  if (edge >= 0.015) return 'bg-forest text-canvas';
  if (edge >= 0) return 'bg-forest/15 text-forest border border-forest/40';
  return 'bg-canvas-2 text-ink-3 border border-line';
}

// ── KPI card ───────────────────────────────────────────────
function Kpi({ label, value, sub, tone = 'ink' }: { label: string; value: string | number; sub: string; tone?: 'ink' | 'green' | 'amber' }) {
  const color = tone === 'green' ? 'text-forest' : tone === 'amber' ? 'text-amber-2' : 'text-ink';
  return (
    <div className={`${CARD} p-4`}>
      <div className={LABEL}>{label}</div>
      <div className={`text-2xl md:text-[28px] font-bold tabular-nums leading-none mt-2 ${color}`}>{value}</div>
      <div className="text-[11px] mt-1.5 text-ink-3">{sub}</div>
    </div>
  );
}

// ── Hero: melhor valor do dia (forest gradient) ────────────
function TopValueHero({ o, onClick }: { o: Opportunity; onClick: () => void }) {
  return (
    <div
      className="rounded-2xl overflow-hidden relative text-white"
      style={{ background: 'linear-gradient(135deg, #0a3d2e 0%, #08321f 60%, #051f12 100%)' }}
    >
      <div className="absolute top-0 right-0 w-[280px] h-[280px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.16), transparent 70%)', transform: 'translate(90px,-90px)' }} />
      <div className="relative px-6 md:px-8 py-7 grid md:grid-cols-12 gap-6 md:gap-8">
        {/* esquerda: contexto + narrativa */}
        <div className="md:col-span-7 flex flex-col">
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] uppercase tracking-[0.16em] font-bold w-fit" style={{ background: '#fbbf24', color: '#1a1d1a' }}>
            <Zap className="w-3 h-3" /> Melhor valor do dia
          </span>
          <div className="flex items-center gap-2.5 mt-4">
            <Crest teamId={o.homeId} name={o.homeName} size={28} />
            <span className="text-lg md:text-xl font-bold tracking-tight">{o.homeName} <span className="text-white/50 font-normal">x</span> {o.awayName}</span>
            <Crest teamId={o.awayId} name={o.awayName} size={28} />
          </div>
          <div className="text-[12px] mt-1 text-white/55">{COMP_LABEL[o.competition] || o.competition} · {fmtDayTime(o.kickoffUtc)}</div>
          <p className="text-[18px] md:text-[22px] leading-snug font-semibold mt-4" style={{ textWrap: 'pretty' as never }}>
            <span className="text-white">{o.outcomeLabel}</span>
            <span className="text-white/80"> — a melhor odd ({o.bestOdd.toFixed(2)} na {o.bestBook}) está {fmtEdge(o.edge)} acima da linha justa do mercado.</span>
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="px-2.5 h-7 inline-flex items-center rounded-md text-[11px] font-semibold bg-white/10 text-white/85">{o.marketLabel}</span>
            <span className="px-2.5 h-7 inline-flex items-center rounded-md text-[11px] font-semibold" style={{ background: 'rgba(251,191,36,0.18)', color: '#fde68a', border: '1px solid rgba(251,191,36,0.35)' }}>{o.nBooks} casas comparadas</span>
          </div>
        </div>

        {/* direita: edge gigante + stats + CTA */}
        <div className="md:col-span-5 flex flex-col justify-between">
          <div className="md:text-right">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">Valor (edge)</div>
            <div className="flex items-baseline md:justify-end gap-1 mt-1">
              <span className="text-[56px] md:text-[68px] font-bold tabular-nums leading-none" style={{ color: '#fbbf24' }}>{fmtEdge(o.edge)}</span>
            </div>
            <div className="text-[11px] mt-1 text-white/55">maior do dia</div>
          </div>
          <div className="grid grid-cols-3 gap-0 mt-5 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { l: 'Melhor odd', v: o.bestOdd.toFixed(2), s: o.bestBook },
              { l: 'Justa', v: fmtPct(o.fairProb), s: 'sharp/devig' },
              { l: 'Casas', v: String(o.nBooks), s: 'comparadas' },
            ].map((c, i) => (
              <div key={c.l} className="px-3 py-2.5" style={{ borderLeft: i ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">{c.l}</div>
                <div className="text-[18px] font-bold tabular-nums leading-none mt-1.5 text-white">{c.v}</div>
                <div className="text-[10px] mt-1 text-white/45 truncate">{c.s}</div>
              </div>
            ))}
          </div>
          <button onClick={onClick} className="h-11 mt-4 rounded-md text-[13px] font-semibold inline-flex items-center justify-center gap-2" style={{ background: '#fbbf24', color: '#1a1d1a' }}>
            Abrir jogo <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de oportunidade (rico) ────────────────────────────
function OppCard({ o, onClick }: { o: Opportunity; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${CARD} p-4 text-left hover:shadow-sm hover:border-line-2 transition w-full`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-ink-3">{COMP_LABEL[o.competition] || o.competition} · {fmtDayTime(o.kickoffUtc)}</div>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <Crest teamId={o.homeId} name={o.homeName} size={18} />
            <span className="text-sm font-semibold text-ink truncate">{o.homeName} <span className="text-ink-3 font-normal">x</span> {o.awayName}</span>
            <Crest teamId={o.awayId} name={o.awayName} size={18} />
          </div>
        </div>
        <span className={`text-sm font-extrabold rounded px-1.5 py-0.5 tabular-nums shrink-0 ${edgeBadgeCls(o.edge)}`}>{fmtEdge(o.edge)}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-canvas-2 text-ink">{o.marketLabel}</span>
        <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-canvas-2 text-ink">{o.outcomeLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line">
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Melhor odd</div>
          <div className="text-base font-bold tabular-nums text-ink mt-0.5">{o.bestOdd.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Casa</div>
          <div className="text-sm font-semibold text-ink mt-1 truncate">{o.bestBook}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Justa</div>
          <div className="text-base font-bold tabular-nums text-ink mt-0.5">{fmtPct(o.fairProb)}</div>
        </div>
      </div>
    </button>
  );
}

// ── Linha de jogo (rail) ───────────────────────────────────
function GameRailRow({ f, edge, onClick }: { f: FutebolFixture & { competition?: string }; edge: number | null; onClick: () => void }) {
  const finished = isFinished(f.status_short);
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-4 py-3 border-t border-line first:border-t-0 hover:bg-canvas-2 transition text-left">
      <span className="w-10 text-[11px] font-semibold text-ink-2 tabular-nums shrink-0">{finished ? 'fim' : fmtTime(f.kickoff_utc)}</span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <Crest teamId={f.home_team_id} name={f.home_team_name} size={20} />
        <span className="text-[13px] text-ink truncate">{f.home_team_name}</span>
        <span className="text-[10px] text-ink-3 px-0.5">x</span>
        <Crest teamId={f.away_team_id} name={f.away_team_name} size={20} />
        <span className="text-[13px] text-ink truncate">{f.away_team_name}</span>
      </div>
      {edge != null && edge >= 0 ? (
        <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 tabular-nums shrink-0 ${edgeBadgeCls(edge)}`}>{fmtEdge(edge)}</span>
      ) : edge != null ? (
        <span className="text-[10px] text-ink-3 shrink-0">odds</span>
      ) : null}
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
      .slice(0, 8)
      .map((x) => x.f);
  }, [allGames]);

  const opps = board?.opportunities ?? [];
  const hero = opps[0] ?? null;
  const moreOpps = opps.slice(1, 5);
  const showingToday = todayGames.length > 0;
  const gameList = showingToday ? todayGames : proximos;
  const comValor = todayGames.filter((f) => (edgeByFixture.get(f.fixture_id) ?? -1) >= 0).length;

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <FutebolSubNav />
      <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 flex flex-col gap-6 md:gap-8 flex-1">

        {/* Briefing */}
        <div className="grid md:grid-cols-12 gap-5">
          <div className="md:col-span-5">
            <div className={LABEL}>Hoje no futebol</div>
            <h1 className="font-display text-3xl md:text-[40px] font-extrabold tracking-tight leading-none text-ink mt-1">{fmtTodayHeader(today)}</h1>
            <p className="text-sm mt-2 text-ink-2">
              {showingToday
                ? <><span className="font-semibold text-ink">{todayGames.length} jogo{todayGames.length === 1 ? '' : 's'} hoje</span>{comValor ? <> · <span className="font-semibold text-forest">{comValor} com valor</span></> : ''}</>
                : 'Sem jogos hoje — próximos na agenda'}
            </p>
          </div>
          <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Jogos hoje" value={loading ? '—' : todayGames.length} sub="na agenda" />
            <Kpi label="Com valor" value={loading ? '—' : comValor} sub="edge positivo" tone="green" />
            <Kpi label="Melhor edge" value={loading || !hero ? '—' : fmtEdge(hero.edge)} sub="oportunidade do dia" tone="amber" />
            <Kpi label="Oportunidades" value={loading ? '—' : opps.length} sub="mercados +EV" tone="green" />
          </div>
        </div>

        {/* Hero */}
        {loading ? (
          <Skeleton className="h-64 w-full bg-canvas-2 rounded-2xl" />
        ) : hero ? (
          <TopValueHero o={hero} onClick={() => navigate(`/futebol/jogo/${hero.fixtureId}`)} />
        ) : null}

        {/* 2-col: mais oportunidades + jogos de hoje */}
        <div className="grid md:grid-cols-12 gap-6">
          {/* oportunidades */}
          <div className="md:col-span-8">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className={LABEL}>Mais oportunidades</div>
                <div className="text-lg font-bold tracking-tight text-ink mt-0.5">Próximos valores por edge</div>
              </div>
              <button onClick={() => navigate('/futebol/oportunidades')} className="text-[12px] font-semibold inline-flex items-center gap-1 text-forest hover:text-forest-2">
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
            ) : moreOpps.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {moreOpps.map((o) => <OppCard key={`${o.fixtureId}-${o.marketKey}-${o.outcomeKey}`} o={o} onClick={() => navigate(`/futebol/jogo/${o.fixtureId}`)} />)}
              </div>
            ) : (
              <div className={`${CARD} p-6 text-center text-sm text-ink-3`}>Sem outras oportunidades com valor agora.</div>
            )}
          </div>

          {/* jogos de hoje (rail) */}
          <div className="md:col-span-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className={LABEL}>{showingToday ? 'Jogos de hoje' : 'Próximos jogos'}</div>
                <div className="text-lg font-bold tracking-tight text-ink mt-0.5">{gameList.length} partida{gameList.length === 1 ? '' : 's'}</div>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-64 w-full bg-canvas-2 rounded-rebrand-md" />
            ) : gameList.length > 0 ? (
              <div className={`${CARD} overflow-hidden`}>
                {gameList.map((f) => (
                  <GameRailRow key={f.fixture_id} f={f} edge={edgeByFixture.has(f.fixture_id) ? (edgeByFixture.get(f.fixture_id) as number) : null} onClick={() => navigate(`/futebol/jogo/${f.fixture_id}`)} />
                ))}
              </div>
            ) : (
              <div className={`${CARD} p-6 text-center text-sm text-ink-3`}>Sem jogos na agenda.</div>
            )}
          </div>
        </div>

        {/* Explorar */}
        <button onClick={() => navigate('/futebol/jogos')} className={`${CARD} w-full flex items-center gap-3 px-5 py-4 hover:border-line-2 transition text-left`}>
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
