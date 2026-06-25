import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Zap, ArrowRight, Check } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolFixtures, useFutebolValueBoard } from '@/hooks/use-futebol-data';
import FutebolDayStepper from '@/components/FutebolDayStepper';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  pickLabel, marketLabel, fmtEdgeScore, freqEmDez, groupBoardByFixture,
  faixaBadgeCls, faixaWord, topEvidencia, SCORE_ALTA, SCORE_MEDIA,
} from '@/utils/futebol-score';
import type { FutebolFixture, FutebolValueBoardRow } from '@/services/futebol-data.service';

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
  if (logo && !err) return <img src={logo} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain shrink-0" loading="lazy" />;
  return <div style={{ width: size, height: size }} className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[9px] font-bold text-ink-2 shrink-0">{crestInitials(name)}</div>;
}

const CARD = 'bg-white border border-line rounded-rebrand-md';
const LABEL = 'text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-3';

// ── KPI ───────────────────────────────────────────────────
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

// ── Hero: melhor Score do dia. Alta = forest gradient; Média = claro/âmbar ──
function TopValueHero({ o, onClick }: { o: FutebolValueBoardRow; onClick: () => void }) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const ev = topEvidencia(o.evidencias);
  const alta = o.score >= SCORE_ALTA;

  if (alta) {
    return (
      <div className="rounded-2xl overflow-hidden relative text-white" style={{ background: 'linear-gradient(135deg, #0a3d2e 0%, #08321f 60%, #051f12 100%)' }}>
        <div className="absolute top-0 right-0 w-[280px] h-[280px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.16), transparent 70%)', transform: 'translate(90px,-90px)' }} />
        <div className="relative px-6 md:px-8 py-7 grid md:grid-cols-12 gap-6 md:gap-8">
          <div className="md:col-span-7 flex flex-col">
            <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] uppercase tracking-[0.16em] font-bold w-fit" style={{ background: '#fbbf24', color: '#1a1d1a' }}>
              <Zap className="w-3 h-3" /> Melhor valor do dia
            </span>
            <div className="flex items-center gap-2.5 mt-4">
              <Crest teamId={o.home_team_id} name={o.home_team_name} size={28} />
              <span className="text-lg md:text-xl font-bold tracking-tight">{o.home_team_name} <span className="text-white/50 font-normal">x</span> {o.away_team_name}</span>
              <Crest teamId={o.away_team_id} name={o.away_team_name} size={28} />
            </div>
            <div className="text-[12px] mt-1 text-white/55">{COMP_LABEL[o.competition] || o.competition} · {fmtDayTime(o.kickoff_utc)}</div>
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/50">{marketLabel(o.market)}</div>
              <div className="text-[22px] md:text-[26px] font-bold leading-tight mt-1">{pick}</div>
              <p className="text-[13px] text-white/75 mt-2 leading-relaxed">
                Na odd <b className="text-white">{o.best_odd.toFixed(2)}</b>, essa aposta se paga se acontecer <b className="text-white">~{freqEmDez(o.best_odd)} em cada 10 vezes</b> ou mais — e a leitura do jogo aponta nessa direção.
              </p>
              {ev && (
                <p className="flex items-start gap-1.5 text-[12px] text-white/80 mt-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-300" /><span>{ev}</span>
                </p>
              )}
            </div>
          </div>
          <div className="md:col-span-5 flex flex-col justify-between">
            <div className="md:text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">Confiabilidade</div>
              <div className="flex items-baseline md:justify-end gap-1 mt-1">
                <span className="text-[56px] md:text-[68px] font-bold tabular-nums leading-none" style={{ color: '#fbbf24' }}>{o.score}</span>
                <span className="text-[18px] text-white/40">/100</span>
              </div>
              <div className="text-[11px] mt-1 text-white/55">valor {fmtEdgeScore(o.edge)} · odd {o.best_odd.toFixed(2)}</div>
            </div>
            <button onClick={onClick} className="h-11 mt-5 rounded-md text-[13px] font-semibold inline-flex items-center justify-center gap-2" style={{ background: '#fbbf24', color: '#1a1d1a' }}>
              Abrir jogo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Média — destaque honesto, claro com acento âmbar (não vende como Alta)
  return (
    <div className="rounded-2xl border border-line border-l-4 border-l-amber bg-white px-6 md:px-8 py-7 grid md:grid-cols-12 gap-6 md:gap-8">
      <div className="md:col-span-7 flex flex-col">
        <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] uppercase tracking-[0.16em] font-bold w-fit bg-amber/15 text-amber-2 border border-amber/30">
          <Zap className="w-3 h-3" /> Melhor do dia · Média
        </span>
        <div className="flex items-center gap-2.5 mt-4">
          <Crest teamId={o.home_team_id} name={o.home_team_name} size={28} />
          <span className="text-lg md:text-xl font-bold tracking-tight text-ink">{o.home_team_name} <span className="text-ink-3 font-normal">x</span> {o.away_team_name}</span>
          <Crest teamId={o.away_team_id} name={o.away_team_name} size={28} />
        </div>
        <div className="text-[12px] mt-1 text-ink-3">{COMP_LABEL[o.competition] || o.competition} · {fmtDayTime(o.kickoff_utc)}</div>
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-3">{marketLabel(o.market)}</div>
          <div className="text-[22px] md:text-[26px] font-bold leading-tight mt-1 text-ink">{pick}</div>
          <p className="text-[13px] text-ink-2 mt-2 leading-relaxed">
            Na odd <b className="text-ink">{o.best_odd.toFixed(2)}</b>, essa aposta se paga se acontecer <b className="text-ink">~{freqEmDez(o.best_odd)} em cada 10 vezes</b> ou mais — e a leitura do jogo aponta nessa direção.
          </p>
          {ev && (
            <p className="flex items-start gap-1.5 text-[12px] text-ink-2 mt-2">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-status-success" /><span>{ev}</span>
            </p>
          )}
        </div>
      </div>
      <div className="md:col-span-5 flex flex-col justify-between">
        <div className="md:text-right">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-3">Confiabilidade</div>
          <div className="flex items-baseline md:justify-end gap-1 mt-1">
            <span className="text-[56px] md:text-[68px] font-bold tabular-nums leading-none text-amber-2">{o.score}</span>
            <span className="text-[18px] text-ink-3">/100</span>
          </div>
          <div className="text-[11px] mt-1 text-ink-3">valor {fmtEdgeScore(o.edge)} · odd {o.best_odd.toFixed(2)}</div>
        </div>
        <button onClick={onClick} className="h-11 mt-5 rounded-md text-[13px] font-semibold inline-flex items-center justify-center gap-2 bg-ink text-canvas hover:bg-ink-2 transition">
          Abrir jogo <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Card de oportunidade ───────────────────────────────────
function OppCard({ o, onClick }: { o: FutebolValueBoardRow; onClick: () => void }) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const ev = topEvidencia(o.evidencias);
  return (
    <button onClick={onClick} className={`${CARD} p-4 text-left hover:shadow-sm hover:border-line-2 transition w-full`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-ink-3">{COMP_LABEL[o.competition] || o.competition} · {fmtDayTime(o.kickoff_utc)}</div>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <Crest teamId={o.home_team_id} name={o.home_team_name} size={18} />
            <span className="text-sm font-semibold text-ink truncate">{o.home_team_name} <span className="text-ink-3 font-normal">x</span> {o.away_team_name}</span>
            <Crest teamId={o.away_team_id} name={o.away_team_name} size={18} />
          </div>
        </div>
        <div className="text-center shrink-0">
          <span className={`text-sm font-extrabold rounded px-1.5 py-0.5 tabular-nums ${faixaBadgeCls(o.faixa)}`} title="Score de Confiabilidade (0–100)">{o.score}</span>
          <div className="text-[9px] uppercase tracking-wide text-ink-3 mt-0.5">{faixaWord(o.faixa)}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-canvas-2 text-ink-2">{marketLabel(o.market)}</span>
        <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-canvas-2 text-ink">{pick}</span>
      </div>
      {ev && (
        <p className="flex items-start gap-1.5 text-[12px] text-ink-2 mt-2">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-status-success" /><span>{ev}</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line">
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Odd</div>
          <div className="text-base font-bold tabular-nums text-ink mt-0.5">{o.best_odd.toFixed(2)}</div>
          <div className="text-[10px] text-ink-3">se paga em ~{freqEmDez(o.best_odd)} de 10</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Valor</div>
          <div className="text-base font-bold tabular-nums text-forest mt-0.5">{fmtEdgeScore(o.edge)}</div>
          <div className="text-[10px] text-ink-3">acima do risco real</div>
        </div>
      </div>
    </button>
  );
}

// ── Linha de jogo (rail) ───────────────────────────────────
function GameRailRow({ f, best, onClick }: { f: FutebolFixture & { competition?: string }; best: FutebolValueBoardRow | null; onClick: () => void }) {
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
      {best ? (
        <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0 tabular-nums ${faixaBadgeCls(best.faixa)}`} title="Score de Confiabilidade">{best.score}</span>
      ) : null}
    </button>
  );
}

export default function FutebolHoje() {
  const navigate = useNavigate();
  const { data: brasil, isLoading: l1 } = useFutebolFixtures('brasileirao', 2026);
  const { data: copa, isLoading: l2 } = useFutebolFixtures('copa_mundo', 2026);
  const { data: valueRows, isLoading: l3 } = useFutebolValueBoard();
  const loading = l1 || l2 || l3;

  const todayStr = brtDateStr(new Date());
  const [day, setDay] = useState<string | null>(null);

  const allGames = useMemo(() => {
    const tag = (arr: FutebolFixture[] | undefined, c: string) => (arr || []).map((f) => ({ ...f, competition: c }));
    return [...tag(brasil, 'brasileirao'), ...tag(copa, 'copa_mundo')];
  }, [brasil, copa]);

  // dias (BRT) com jogos ainda não começados — base da navegação por dias.
  const days = useMemo(() => {
    const now = Date.now();
    const set = new Set<string>();
    allGames.forEach((f) => {
      const d = parseUtc(f.kickoff_utc || f.date_utc);
      const t = d?.getTime();
      if (d && t != null && t > now && !isFinished(f.status_short)) set.add(brtDateStr(d));
    });
    return [...set].sort();
  }, [allGames]);
  const selectedDay = (day && days.includes(day)) ? day : (days.includes(todayStr) ? todayStr : days[0] ?? todayStr);
  const selectedDate = new Date(`${selectedDay}T12:00:00Z`);
  const isToday = selectedDay === todayStr;

  // oportunidades (value rows) do dia selecionado, ainda não começadas. O Score já
  // vem pronto do backend (fact_value_opportunities); aqui só filtramos e ranqueamos.
  const dayRows = useMemo(() => {
    if (!valueRows?.length) return [];
    const now = Date.now();
    return valueRows.filter((r) => {
      const d = parseUtc(r.kickoff_utc);
      const t = d?.getTime();
      return d != null && t! > now && brtDateStr(d) === selectedDay && !isFinished(r.status_short);
    });
  }, [valueRows, selectedDay]);

  // melhor oportunidade por jogo, ordenado por Score
  const board = useMemo(() => groupBoardByFixture(dayRows), [dayRows]);
  const bestByFixture = useMemo(() => {
    const m = new Map<number, FutebolValueBoardRow>();
    board.forEach((bf) => m.set(bf.fixtureId, bf.best));
    return m;
  }, [board]);

  // agenda do dia selecionado (inclui já iniciados, pra contexto da grade)
  const dayGames = useMemo(() => {
    return allGames
      .filter((f) => {
        const d = parseUtc(f.kickoff_utc || f.date_utc);
        return d ? brtDateStr(d) === selectedDay : false;
      })
      .sort((a, b) => (parseUtc(a.kickoff_utc)?.getTime() ?? 0) - (parseUtc(b.kickoff_utc)?.getTime() ?? 0));
  }, [allGames, selectedDay]);

  const oppsByFixture = useMemo(() => board.map((bf) => bf.best), [board]);
  const heroOpp = oppsByFixture[0] && oppsByFixture[0].score >= SCORE_MEDIA ? oppsByFixture[0] : null;
  const bestScore = oppsByFixture[0]?.score ?? null;
  const moreOpps = (heroOpp ? oppsByFixture.slice(1) : oppsByFixture).filter((o) => o.score >= SCORE_MEDIA).slice(0, 4);
  const nOpps = dayRows.length;
  const gameList = dayGames;
  const comValor = dayGames.filter((f) => (bestByFixture.get(f.fixture_id)?.score ?? 0) >= SCORE_MEDIA).length;

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 flex flex-col gap-6 md:gap-8 flex-1">

        {/* Briefing */}
        <div className="grid md:grid-cols-12 gap-5">
          <div className="md:col-span-5">
            <div className="flex items-center justify-between gap-3">
              <div className={LABEL}>{isToday ? 'Hoje no futebol' : 'No futebol'}</div>
              {!loading && days.length > 0 && (
                <FutebolDayStepper days={days} value={selectedDay} onChange={setDay} />
              )}
            </div>
            <h1 className="font-display text-3xl md:text-[40px] font-extrabold tracking-tight leading-none text-ink mt-1">{fmtTodayHeader(selectedDate)}</h1>
            <p className="text-sm mt-2 text-ink-2">
              {dayGames.length > 0
                ? <><span className="font-semibold text-ink">{dayGames.length} jogo{dayGames.length === 1 ? '' : 's'}{isToday ? ' hoje' : ''}</span>{comValor ? <> · <span className="font-semibold text-forest">{comValor} com valor</span></> : ''}</>
                : 'Sem jogos nesse dia'}
            </p>
          </div>
          <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Jogos" value={loading ? '—' : dayGames.length} sub="na agenda" />
            <Kpi label="Com valor" value={loading ? '—' : comValor} sub="score ≥ 40" tone="green" />
            <Kpi label="Melhor score" value={loading || bestScore == null ? '—' : bestScore} sub="confiabilidade /100" tone="amber" />
            <Kpi label="Oportunidades" value={loading ? '—' : nOpps} sub="mercados monitorados" tone="green" />
          </div>
        </div>

        {/* Hero / sem valor */}
        {loading ? (
          <Skeleton className="h-64 w-full bg-canvas-2 rounded-2xl" />
        ) : heroOpp ? (
          <TopValueHero o={heroOpp} onClick={() => navigate(`/futebol/jogo/${heroOpp.fixture_id}`)} />
        ) : (
          <div className={`${CARD} p-6 flex items-start gap-3`}>
            <Zap className="w-5 h-5 text-ink-3 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink">Sem valor claro {isToday ? 'hoje' : 'nesse dia'}</p>
              <p className="text-xs text-ink-2 mt-1">As melhores odds estão perto da linha justa do mercado — nenhuma passou a régua de confiabilidade. Os jogos do dia estão abaixo{days.length > 1 ? '; use as setas pra ver outros dias' : ''}.</p>
            </div>
          </div>
        )}

        {/* 2-col: mais oportunidades + jogos de hoje */}
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-8">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className={LABEL}>Mais oportunidades</div>
                <div className="text-lg font-bold tracking-tight text-ink mt-0.5">Por confiabilidade</div>
              </div>
              <button onClick={() => navigate('/futebol/oportunidades')} className="text-[12px] font-semibold inline-flex items-center gap-1 text-forest hover:text-forest-2">
                Ver todas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
            ) : moreOpps.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {moreOpps.map((o) => <OppCard key={`${o.fixture_id}-${o.market}-${o.outcome}-${o.line_value}`} o={o} onClick={() => navigate(`/futebol/jogo/${o.fixture_id}`)} />)}
              </div>
            ) : (
              <div className={`${CARD} p-6 text-center text-sm text-ink-3`}>Sem outras oportunidades relevantes agora.</div>
            )}
          </div>

          <div className="md:col-span-4">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className={LABEL}>{isToday ? 'Jogos de hoje' : 'Jogos do dia'}</div>
                <div className="text-lg font-bold tracking-tight text-ink mt-0.5">{gameList.length} partida{gameList.length === 1 ? '' : 's'}</div>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-64 w-full bg-canvas-2 rounded-rebrand-md" />
            ) : gameList.length > 0 ? (
              <div className={`${CARD} overflow-hidden`}>
                {gameList.map((f) => (
                  <GameRailRow key={f.fixture_id} f={f} best={bestByFixture.get(f.fixture_id) ?? null} onClick={() => navigate(`/futebol/jogo/${f.fixture_id}`)} />
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
