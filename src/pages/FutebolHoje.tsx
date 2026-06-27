import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolFixtures, useFutebolValueBoard, useFutebolFixtureValue, useFutebolAccess } from '@/hooks/use-futebol-data';
import FutebolDayStepper from '@/components/FutebolDayStepper';
import { Blur, FutebolAccessBanner } from '@/components/futebol/FutebolGate';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  pickLabel, marketLabel, fmtEdgeScore, freqEmDez, groupBoardByFixture,
  faixaBadgeCls, faixaWord, faixaTone, topEvidencia, chancePct, SCORE_MEDIA,
} from '@/utils/futebol-score';
import type { FutebolFixture, FutebolValueBoardRow } from '@/services/futebol-data.service';

const SAO_PAULO_TZ = 'America/Sao_Paulo';
const COMP_LABEL: Record<string, string> = { brasileirao: 'Brasileirão', copa_mundo: 'Copa do Mundo' };
// Quantos dias futuros (com jogos) o navegador mostra — janela curta, não a temporada toda.
const DAY_WINDOW = 8;

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
function Kpi({ label, value, sub, tone = 'ink', anchor }: { label: string; value: string | number; sub: string; tone?: 'ink' | 'green' | 'amber'; anchor?: boolean }) {
  const color = anchor ? 'text-amber-2' : tone === 'green' ? 'text-forest' : tone === 'amber' ? 'text-amber-2' : 'text-ink';
  return (
    <div className="rounded-rebrand-md p-4" style={anchor
      ? { background: '#fef7df', border: '1px solid #fde68a' }
      : { background: '#fff', border: '1px solid var(--line)' }}>
      <div className={LABEL}>{label}</div>
      <div className={`text-2xl md:text-[28px] font-bold tabular-nums leading-none mt-2 ${color}`}>{value}</div>
      <div className="text-[11px] mt-1.5 text-ink-3">{sub}</div>
    </div>
  );
}

// Número do hero (Chance / Odd / Se paga em / Valor)
function HeroStat({ label, value, dark, locked }: { label: string; value: string; dark?: boolean; locked?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] font-semibold" style={{ color: dark ? 'rgba(255,255,255,0.5)' : undefined }}>
        <span className={dark ? '' : 'text-ink-3'}>{label}</span>
      </div>
      <div className={`text-[20px] font-bold tabular-nums leading-none mt-1 ${dark ? '' : 'text-ink'}`}><Blur active={!!locked}>{value}</Blur></div>
    </div>
  );
}

// ── Hero: melhor valor do dia — 3 colunas (pick · por quê · confiab). ────────
// Alta = gradiente forest (texto branco); Média = card claro com acento âmbar.
function TopValueHero({ o, onClick, atencao, locked }: { o: FutebolValueBoardRow; onClick: () => void; atencao?: string | null; locked?: boolean }) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const ev = topEvidencia(o.evidencias);
  const d = true; // hero sempre no fundo forest (mockup); a faixa vai no selo, não na cor do card
  const chance = chancePct(o.prob_justa_fechamento);
  const porque = chance != null
    ? <>O mercado dá <b className={d ? 'text-white' : 'text-ink'}>~{chance}% de chance</b>; na odd <b className={d ? 'text-white' : 'text-ink'}>{o.best_odd.toFixed(2)}</b> isso paga acima do risco real — é aí que está o valor.</>
    : <>Na odd <b className={d ? 'text-white' : 'text-ink'}>{o.best_odd.toFixed(2)}</b>, se paga se acontecer ~{freqEmDez(o.best_odd)} em cada 10 vezes ou mais — e a leitura do jogo aponta nessa direção.</>;

  return (
    <div className={`rounded-2xl overflow-hidden relative ${d ? 'text-white' : 'bg-white border border-line border-l-4 border-l-amber'}`}
      style={d ? { background: 'linear-gradient(135deg, #0a3d2e 0%, #08321f 60%, #051f12 100%)' } : undefined}>
      {d && <div className="absolute top-0 right-0 w-[320px] h-[320px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.16), transparent 70%)', transform: 'translate(90px,-90px)' }} />}
      <div className="relative px-6 md:px-8 py-7 grid md:grid-cols-12 gap-6 md:gap-8">

        {/* Esquerda — identidade do pick + CTA */}
        <div className="md:col-span-4 flex flex-col">
          <span className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] uppercase tracking-[0.18em] font-bold w-fit ${d ? '' : 'bg-amber/15 text-amber-2 border border-amber/30'}`}
            style={d ? { background: '#fbbf24', color: '#1a1d1a' } : undefined}>
            <Zap className="w-3 h-3" /> {d ? 'Melhor valor do dia' : 'Melhor do dia · Média'}
          </span>
          <div className={`text-[11px] uppercase tracking-[0.16em] font-semibold mt-5 ${d ? 'text-white/50' : 'text-ink-3'}`}>{marketLabel(o.market)} · {COMP_LABEL[o.competition] || o.competition}</div>
          <div className={`text-[28px] md:text-[32px] font-bold tracking-tight leading-[1.1] mt-2 ${d ? '' : 'text-ink'}`}><Blur active={!!locked} strength={9}>{pick}</Blur></div>
          <div className={`flex items-center gap-1.5 text-[13px] mt-2 ${d ? 'text-white/70' : 'text-ink-2'}`}>
            <Crest teamId={o.home_team_id} name={o.home_team_name} size={18} />
            <span>{o.home_team_name} × {o.away_team_name}</span>
            <Crest teamId={o.away_team_id} name={o.away_team_name} size={18} />
            <span className="opacity-70">· {fmtDayTime(o.kickoff_utc)}</span>
          </div>
          <button onClick={onClick} className={`h-11 px-5 mt-5 w-fit rounded-md text-[13px] font-semibold inline-flex items-center gap-2 ${d ? '' : 'bg-ink text-canvas hover:bg-ink-2'} transition`}
            style={d ? { background: '#fbbf24', color: '#1a1d1a' } : undefined}>
            Abrir análise do jogo <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Meio — por quê + ponto de atenção */}
        <div className="md:col-span-5 flex flex-col">
          <div className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${d ? 'text-white/50' : 'text-ink-3'}`}>Por quê</div>
          <p className={`text-[17px] md:text-[19px] leading-[1.4] font-medium tracking-tight mt-2 ${d ? 'text-white/95' : 'text-ink'}`} style={{ textWrap: 'pretty' }}><Blur active={!!locked}>{porque}</Blur></p>
          {ev && (
            <p className={`flex items-start gap-1.5 text-[12px] mt-3 ${d ? 'text-white/80' : 'text-ink-2'}`}>
              <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${d ? 'text-emerald-300' : 'text-status-success'}`} /><span>{ev}</span>
            </p>
          )}
          {atencao && (
            <div className="mt-4 rounded-lg p-3 flex items-start gap-2"
              style={d ? { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' } : { background: '#fef7df', border: '1px solid #fde68a' }}>
              <span style={{ color: d ? '#fde68a' : '#9a6c00' }} className="mt-0.5 shrink-0"><AlertTriangle className="w-3.5 h-3.5" /></span>
              <div className={`text-[12px] leading-relaxed ${d ? 'text-white/80' : ''}`} style={d ? undefined : { color: '#5a3c00' }}>
                <span className="font-semibold" style={{ color: d ? '#fde68a' : '#9a6c00' }}>Ponto de atenção · </span>{atencao}
              </div>
            </div>
          )}
        </div>

        {/* Direita — confiabilidade + números */}
        <div className={`md:col-span-3 flex flex-col justify-between md:pl-6 ${d ? '' : 'md:border-l md:border-line'}`}
          style={d ? { borderLeft: '1px solid rgba(255,255,255,0.1)' } : undefined}>
          <div>
            <div className={`text-[10px] uppercase tracking-[0.16em] font-semibold ${d ? 'text-white/50' : 'text-ink-3'}`}>Confiabilidade</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-[56px] md:text-[64px] font-bold tabular-nums leading-none ${d ? '' : 'text-amber-2'}`} style={d ? { color: '#fbbf24' } : undefined}>{o.score}</span>
              <span className={`text-[16px] ${d ? 'text-white/40' : 'text-ink-3'}`}>/100</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 mt-2 px-2 h-6 rounded text-[10px] uppercase tracking-[0.14em] font-bold ${d ? '' : 'bg-amber/15 text-amber-2'}`}
              style={d ? { background: 'rgba(220,239,226,0.15)', color: '#dcefe2' } : undefined}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: d ? '#fbbf24' : 'var(--amber)' }} />Faixa {faixaWord(o.faixa)}
            </span>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3 mt-5">
              {chance != null && <HeroStat label="Chance" value={`${chance}%`} dark={d} locked={locked} />}
              <HeroStat label="Odd" value={o.best_odd.toFixed(2)} dark={d} locked={locked} />
              <HeroStat label="Se paga em" value={`~${freqEmDez(o.best_odd)}/10`} dark={d} locked={locked} />
              <HeroStat label="Valor" value={fmtEdgeScore(o.edge)} dark={d} locked={locked} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card de oportunidade ───────────────────────────────────
function OppCard({ o, onClick, locked }: { o: FutebolValueBoardRow; onClick: () => void; locked?: boolean }) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const chance = chancePct(o.prob_justa_fechamento);
  return (
    <button onClick={onClick} className={`${CARD} p-4 text-left hover:shadow-sm hover:border-line-2 transition w-full`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.1em] bg-canvas-2 text-ink-2">{marketLabel(o.market)}</span>
          <span className={`px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] ${faixaBadgeCls(o.faixa)}`}>{faixaWord(o.faixa)}</span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Score</div>
          <div className="text-[26px] font-bold tabular-nums tracking-tight leading-none mt-0.5 text-forest">{o.score}</div>
        </div>
      </div>
      <div className="text-[16px] font-semibold tracking-tight mt-2 text-ink"><Blur active={!!locked}>{pick}</Blur></div>
      <div className="flex items-center gap-1.5 text-[12px] mt-1 text-ink-3">
        <Crest teamId={o.home_team_id} name={o.home_team_name} size={16} />
        <span className="truncate">{o.home_team_name} × {o.away_team_name}</span>
        <Crest teamId={o.away_team_id} name={o.away_team_name} size={16} />
        <span className="shrink-0 opacity-80">· {fmtDayTime(o.kickoff_utc)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-line">
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Chance</div>
          <div className="text-[15px] font-bold tabular-nums text-ink mt-0.5"><Blur active={!!locked}>{chance != null ? `${chance}%` : '—'}</Blur></div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Odd</div>
          <div className="text-[15px] font-bold tabular-nums text-ink mt-0.5"><Blur active={!!locked}>{o.best_odd.toFixed(2)}</Blur></div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">Valor</div>
          <div className="text-[15px] font-bold tabular-nums text-forest mt-0.5"><Blur active={!!locked}>{fmtEdgeScore(o.edge)}</Blur></div>
        </div>
      </div>
    </button>
  );
}

// ── Linha de jogo (rail) ───────────────────────────────────
function GameRailRow({ f, best, onClick }: { f: FutebolFixture & { competition?: string }; best: FutebolValueBoardRow | null; onClick: () => void }) {
  const finished = isFinished(f.status_short);
  return (
    <button onClick={onClick} style={finished ? { background: 'var(--canvas-2)' } : undefined} className="w-full flex items-center gap-2.5 px-4 py-3 border-t border-line first:border-t-0 hover:bg-canvas-2 transition text-left">
      <span className={`w-10 text-[11px] font-semibold tabular-nums shrink-0 ${finished ? 'text-ink-3 uppercase tracking-wide' : 'text-ink-2'}`}>{finished ? 'fim' : fmtTime(f.kickoff_utc)}</span>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <Crest teamId={f.home_team_id} name={f.home_team_name} size={20} />
        <span className={`text-[13px] truncate ${finished ? 'text-ink-2' : 'text-ink'}`}>{f.home_team_name}</span>
        {finished ? (
          <span className="text-[12px] font-semibold text-ink tabular-nums px-1 shrink-0">{f.goals_home ?? '-'} <span className="text-ink-3">×</span> {f.goals_away ?? '-'}</span>
        ) : (
          <span className="text-[10px] text-ink-3 px-0.5">x</span>
        )}
        <Crest teamId={f.away_team_id} name={f.away_team_name} size={20} />
        <span className={`text-[13px] truncate ${finished ? 'text-ink-2' : 'text-ink'}`}>{f.away_team_name}</span>
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
  const { data: access } = useFutebolAccess();
  const locked = !access?.unlocked;
  const loading = l1 || l2 || l3;

  const todayStr = brtDateStr(new Date());
  const [day, setDay] = useState<string | null>(null);

  const allGames = useMemo(() => {
    const tag = (arr: FutebolFixture[] | undefined, c: string) => (arr || []).map((f) => ({ ...f, competition: c }));
    return [...tag(brasil, 'brasileirao'), ...tag(copa, 'copa_mundo')];
  }, [brasil, copa]);

  // dias (BRT) com jogos ainda não começados — base da navegação por dias.
  // Limita aos próximos dias (não varre a temporada inteira do Brasileirão).
  const days = useMemo(() => {
    const now = Date.now();
    const set = new Set<string>();
    allGames.forEach((f) => {
      const d = parseUtc(f.kickoff_utc || f.date_utc);
      const t = d?.getTime();
      if (d && t != null && t > now && !isFinished(f.status_short)) set.add(brtDateStr(d));
    });
    return [...set].sort().slice(0, DAY_WINDOW);
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
  // "Ponto de atenção" do hero: vem do detalhe (contras/avisos) do jogo em destaque
  const { data: heroRows } = useFutebolFixtureValue(heroOpp?.fixture_id);
  const heroAtencao = useMemo(() => {
    if (!heroOpp || !heroRows?.length) return null;
    const row = heroRows.find((r) => r.market === heroOpp.market && r.outcome === heroOpp.outcome && (r.line_value ?? null) === (heroOpp.line_value ?? null));
    const list = row ? [...(row.contras ?? []), ...(row.avisos ?? [])] : [];
    return list[0] ?? null;
  }, [heroOpp, heroRows]);
  const moreOpps = (heroOpp ? oppsByFixture.slice(1) : oppsByFixture).filter((o) => o.score >= SCORE_MEDIA).slice(0, 4);
  const nOpps = dayRows.length;
  const gameList = dayGames;
  const alta = oppsByFixture.filter((o) => faixaTone(o.faixa) === 'alta').length;
  // melhor valor entre as oportunidades realmente exibidas (score ≥ Média), não o edge bruto de longshots
  const surfaced = oppsByFixture.filter((o) => o.score >= SCORE_MEDIA);
  const melhorValor = surfaced.length ? Math.round(Math.max(...surfaced.map((o) => o.edge)) * 100) : null;

  // contagem de jogos por dia (BRT) — pros chips do stepper
  const gamesByDay = useMemo(() => {
    const m: Record<string, number> = {};
    allGames.forEach((f) => { const d = parseUtc(f.kickoff_utc || f.date_utc); if (d) { const k = brtDateStr(d); m[k] = (m[k] ?? 0) + 1; } });
    return m;
  }, [allGames]);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      {!loading && days.length > 0 && (
        <div className="bg-white border-b border-line">
          <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-3">
            <FutebolDayStepper days={days} value={selectedDay} onChange={setDay} counts={gamesByDay} />
          </div>
        </div>
      )}
      <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-6 md:py-7 flex flex-col gap-6 md:gap-7 flex-1">

        {/* Briefing */}
        <div className="grid md:grid-cols-12 gap-5">
          <div className="md:col-span-5">
            <div className={LABEL}>{isToday ? 'Hoje no futebol' : 'No futebol'}</div>
            <h1 className="font-display text-3xl md:text-[40px] font-extrabold tracking-tight leading-none text-ink mt-1">{fmtTodayHeader(selectedDate)}</h1>
            <p className="text-sm mt-2.5 text-ink-2">
              {dayGames.length > 0 ? (
                <>
                  <span className="font-semibold text-ink">{dayGames.length} jogo{dayGames.length === 1 ? '' : 's'}</span>
                  {nOpps > 0 && <> · {nOpps} oportunidade{nOpps === 1 ? '' : 's'} de valor</>}
                  {alta > 0 && <> · <span className="font-semibold text-forest">{alta} de faixa Alta</span></>}
                </>
              ) : 'Sem jogos nesse dia'}
            </p>
            <div className="flex items-center gap-2 mt-3 text-[11px] tabular-nums text-ink-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest" />
              <span>Odds revisadas de hora em hora</span>
            </div>
          </div>
          <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Jogos hoje" value={loading ? '—' : dayGames.length} sub={isToday ? 'na agenda' : 'no dia'} />
            <Kpi label="Oportunidades" value={loading ? '—' : nOpps} sub="com valor (+EV)" tone="green" />
            <Kpi label="Faixa Alta" value={loading ? '—' : alta} sub="maior confiança" anchor />
            <Kpi label="Melhor valor" value={loading || melhorValor == null ? '—' : `+${melhorValor}%`} sub="destaque do dia" tone="green" />
          </div>
        </div>

        <FutebolAccessBanner access={access} />

        {/* Hero / sem valor */}
        {loading ? (
          <Skeleton className="h-64 w-full bg-canvas-2 rounded-2xl" />
        ) : heroOpp ? (
          <TopValueHero o={heroOpp} atencao={heroAtencao} onClick={() => navigate(`/futebol/jogo/${heroOpp.fixture_id}`)} locked={locked} />
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
                {moreOpps.map((o) => <OppCard key={`${o.fixture_id}-${o.market}-${o.outcome}-${o.line_value}`} o={o} onClick={() => navigate(`/futebol/jogo/${o.fixture_id}`)} locked={locked} />)}
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
              <button onClick={() => navigate('/futebol/jogos')} className="text-[12px] font-semibold inline-flex items-center gap-1 text-forest hover:text-forest-2">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </button>
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

        {/* Banner honesto */}
        <div className="rounded-rebrand-md px-5 py-4 flex items-start gap-3" style={{ background: '#fef7df', border: '1px solid #fde68a' }}>
          <span className="mt-0.5 shrink-0" style={{ color: '#9a6c00' }}><AlertTriangle className="w-4 h-4" /></span>
          <div className="text-[12px] leading-relaxed" style={{ color: '#5a3c00' }}>
            <span className="font-semibold">Não é recomendação.</span> Mostramos onde a odd paga acima da chance estimada (valor). Score e faixa medem confiabilidade, não garantia.
          </div>
        </div>
      </div>
    </div>
  );
}
