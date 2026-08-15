import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Blur, FutebolAccessBanner } from '@/components/futebol/FutebolGate';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';
import { type JogoInfo } from '@/components/futebol/JogoResumo';
import { FaixaPartida } from '@/components/futebol/FaixaPartida';
import { BancadaMercados } from '@/components/futebol/BancadaMercados';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolFixtureDetail, useFutebolFixtureExtras, useFutebolMatchupTendencies, useFutebolFixtureValue, useFutebolH2H, useFutebolFixtureInjuries, useFutebolFixturePremissas, useFutebolTeamProfile, useFutebolAccess } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  computeMatchupTendencies,
} from '@/utils/futebol-tendencias';
import {
  pickLabel, marketLabel, valorVerdict, fmtEdgeScore,
  faixaWord, faixaBadgeCls, chancePct, SCORE_MEDIA,
} from '@/utils/futebol-score';
import { settleFutebol, resultBadge, isHit, type BetResult } from '@/utils/futebol-settlement';
import { faseDaEscalacao, rotuloEscalacao } from '@/utils/futebol-escalacao';
import type {
  FutebolEvent, FutebolFormResult, FutebolInjury, FutebolLineupPlayer, FutebolPlayerStat, FutebolTeamStats, FutebolFixtureValueRow, FutebolTeamProfile, Competition,
} from '@/services/futebol-data.service';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboardingTour } from '@/components/onboarding/useOnboardingTour';
import { FUT_JOGO_TOUR_ID, makeFutebolJogoSteps } from '@/components/onboarding/tours';
import { DemoRibbon, DemoBadge } from '@/components/onboarding/DemoRibbon';
import { demoFixtureDetail, demoFixtureValueRows, demoTeamSeason, demoAwaySeason } from '@/components/onboarding/demo/futebol';

/**
 * A bancada fica lado a lado a partir de 1280px (o breakpoint `xl` do grid). O
 * tour usa isto pra decidir se o balão cabe ao lado do alvo ou se precisa ir por
 * cima: empilhada, a folha do mercado é mais alta que a tela.
 */
const BANCADA_MQ = '(min-width: 1280px)';

function useBancadaLadoALado(): boolean {
  const [lado, setLado] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(BANCADA_MQ).matches : true,
  );
  useEffect(() => {
    const mql = window.matchMedia(BANCADA_MQ);
    const onChange = (e: MediaQueryListEvent) => setLado(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return lado;
}

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

// Fases de mata-mata que a API manda em inglês. pt-BR sempre, inclusive aqui.
const FASE_PT: Record<string, string> = {
  'round of 32': '16-avos de final',
  'round of 16': 'Oitavas de final',
  'quarter-finals': 'Quartas de final',
  'semi-finals': 'Semifinal',
  final: 'Final',
  '3rd place final': 'Disputa de 3º lugar',
};

function prettyRound(round: string | null): string {
  if (!round) return '';
  const m = round.match(/Regular Season\s*-\s*(\d+)/i);
  if (m) return `Rodada ${m[1]}`;
  return FASE_PT[round.trim().toLowerCase()] ?? round;
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

/** W/D/L da API em português. O DS é explícito: pt-BR sempre, inclusive em micro-rótulo. */
const RESULTADO_PT: Record<string, string> = { W: 'V', D: 'E', L: 'D' };

function FormChips({ form }: { form: FutebolFormResult[] }) {
  if (!form?.length) return <span className="text-xs text-ink-3">Sem histórico</span>;
  const ordered = [...form].reverse(); // antigo → recente
  return (
    <div className="flex gap-1">
      {ordered.map((g) => (
        <span
          key={g.fixture_id}
          title={`${g.side === 'home' ? 'contra' : 'fora, contra'} ${g.opponent} · ${g.goals_for} a ${g.goals_against}`}
          className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${FORM_COLORS[g.result] || ''}`}
        >
          {RESULTADO_PT[g.result] ?? g.result}
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

function RatingBadge({ value }: { value: number }) {
  const cls = value >= 7.5 ? 'bg-forest text-canvas' : value >= 6.5 ? 'bg-canvas-2 text-ink border border-line' : 'bg-status-danger/15 text-status-danger';
  return <span className={`text-[10px] font-bold tabular-nums rounded px-1 py-0.5 ${cls}`}>{value.toFixed(1)}</span>;
}

const GOAL_SUFFIX: Record<string, string> = { Penalty: ' (pênalti)', 'Own Goal': ' (gol contra)' };

function eventMinute(e: FutebolEvent): string {
  if (e.minute == null) return '—';
  return e.minute_extra ? `${e.minute}+${e.minute_extra}'` : `${e.minute}'`;
}

const CARD = 'bg-white border border-line rounded-rebrand-xl';


// ---------- "O que olhar": Score vem PRONTO do backend (fact_value_opportunities) ----------
// Síntese "O que olhar neste jogo" — decide e PROVA a melhor aposta (Score do backend)
// Selo de resultado (jogo encerrado): Green / Meio green / Anulada / Meio red / Red.
// Cor + texto (não só cor) e um ponto pra reforçar o estado à distância.
function ResultBadge({ r, big }: { r: BetResult; big?: boolean }) {
  const b = resultBadge(r);
  const c = b.tone === 'won' ? { bg: '#dcefe2', fg: '#0a3d2e', dot: '#2f7d50' }
    : b.tone === 'push' ? { bg: '#eef0ec', fg: '#5a625a', dot: '#8a8f86' }
    : { bg: '#fbe3e8', fg: '#be123c', dot: '#be123c' };
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-[0.06em] ${big ? 'h-7 px-2.5 text-[11px]' : 'h-5 px-1.5 text-[10px]'}`}
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {b.label}
    </span>
  );
}

// Oportunidades mapeadas de um jogo ENCERRADO + como performaram (green/red).
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
  const jogoTour = useOnboardingTour(FUT_JOGO_TOUR_ID, { enabled: !isLoading, delay: 1200 });
  const isDemo = jogoTour.run; // durante o tour, preenche a tela com exemplo

  const fixture = isDemo ? demoFixtureDetail.fixture : data?.fixture;
  const { data: h2h, isLoading: h2hLoading } = useFutebolH2H(fixture?.home_team_id, fixture?.away_team_id);
  const { data: injuries } = useFutebolFixtureInjuries(fid);
  const { data: realTend } = useFutebolMatchupTendencies(
    fixture?.home_team_id, fixture?.away_team_id, fixture?.competition, fixture?.season
  );
  const tend = isDemo ? { home: demoTeamSeason, away: demoAwaySeason } : realTend;
  const tendencies = useMemo(() => {
    if (!fixture || !tend?.home || !tend?.away) return null;
    return computeMatchupTendencies(tend.home, tend.away, fixture.home_team_name, fixture.away_team_name);
  }, [tend, fixture]);
  // Score vem PRONTO do backend (fact_value_opportunities). 1X2 por enquanto.
  const { data: realValueRows } = useFutebolFixtureValue(fid);
  const valueRows = isDemo ? demoFixtureValueRows : realValueRows;
  const { data: access } = useFutebolAccess();
  const locked = isDemo ? false : !access?.unlocked;
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
  // "Já começou" inclui o jogo em andamento, não só o encerrado: depois do
  // apito não dá para prometer que a escalação "sai daqui a pouco".
  const emAndamento = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(fixture?.status_short ?? '');
  const jogoComecou = finished || emAndamento;
  // jogo encerrado/iniciado não é mais oportunidade: esconde o "O que olhar" (vira só descritivo)
  const showValue = !finished && !!valueRows && valueRows.length > 0;
  const hasPlayed = finished && !!valueRows && valueRows.length > 0; // registro pós-jogo

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

  // Duas abas (Leitura & mercados · Times) e o mercado aberto na bancada.
  const [aba, setAba] = useState<'mercados' | 'times'>('mercados');
  const bancadaLadoALado = useBancadaLadoALado();
  const [mercadoAtivo, setMercadoAtivo] = useState('goals_over_under');
  const jogoInfo: JogoInfo | null = fixture
    ? {
        fixtureId: fid!,
        homeId: fixture.home_team_id,
        awayId: fixture.away_team_id,
        home: fixture.home_team_name,
        away: fixture.away_team_name,
        competition: fixture.competition,
        season: fixture.season,
        kickoffUtc: fixture.kickoff_utc,
        statusShort: fixture.status_short,
        goalsHome: fixture.goals_home,
        goalsAway: fixture.goals_away,
      }
    : null;

  // O tour fala do que está montado: a régua só existe nos mercados de linha, e
  // as premissas só quando a coleta trouxe alguma para este jogo. A query é a
  // mesma da bancada, então sai do cache do react-query, sem ida extra à rede.
  const { data: premissasDoJogo } = useFutebolFixturePremissas(fid);
  const jogoSteps = useMemo(
    () =>
      makeFutebolJogoSteps({
        hasRegua: mercadoAtivo === 'goals_over_under' || mercadoAtivo === 'asian_handicap',
        hasPremissas: (premissasDoJogo?.length ?? 0) > 0,
        ladoALado: bancadaLadoALado,
      }),
    [mercadoAtivo, premissasDoJogo, bancadaLadoALado],
  );

  // ── Cards de contexto, montados uma vez e posicionados conforme o estado ──
  // Jogo FUTURO: h2h + estatísticas entram no trilho da direita (junto do veredito
  // e do modelo) e a escalação fica sob o mapa — um rail de consulta contínuo, em
  // vez de uma coluna direita que ficava VAZIA quando o jogo não tinha odd nem
  // modelo (caso Santos × Remo). Jogo ENCERRADO: grade original lá embaixo.
  // A fonte NÃO publica escalação provável. O que chega é a confirmada
  // (anunciada antes do apito) ou a real (registro pós-jogo), uma por vez —
  // a RPC nunca devolve as duas. O rótulo é derivado da fase, não fixo.
  const faseEscalacao = faseDaEscalacao(extras?.lineups, extras?.lineup_players);
  const rotulo = rotuloEscalacao(faseEscalacao, jogoComecou);

  const escalacaoCard = fixture ? (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 flex items-center justify-between border-b border-line">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">{rotulo.titulo} & desfalques</div>
          {rotulo.subtitulo && <div className="text-[10px] text-ink-3 mt-0.5">{rotulo.subtitulo}</div>}
        </div>
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
          <p className="text-sm text-ink-3 text-center py-6">
            {jogoComecou ? 'Escalação não registrada para este jogo.' : 'A escalação costuma ser anunciada cerca de 1h antes do apito.'}
          </p>
        )}
      </div>
    </div>
  ) : null;

  const h2hCard = fixture ? (
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
  ) : null;

  const statsCard = fixture && (homeProfile || awayProfile) ? (
    <div className="rounded-rebrand-xl overflow-hidden bg-white border border-line">
      <div className="px-5 py-3 flex items-center justify-between border-b border-line">
        <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">Estatísticas · temporada</div>
        <span className="text-[10px] flex items-center gap-2"><span className="text-forest font-semibold truncate max-w-[90px]">{fixture.home_team_name}</span><span className="text-ink-3 truncate max-w-[90px]">{fixture.away_team_name}</span></span>
      </div>
      <div className="p-5"><StatsCompare home={homeProfile} away={awayProfile} /></div>
    </div>
  ) : null;

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <OnboardingTour tourId={FUT_JOGO_TOUR_ID} steps={jogoSteps} run={jogoTour.run} onFinish={jogoTour.finish} />
      {/* 1480px pra bater com a agenda. Em max-w-6xl (1152) sobravam ~290px de ar
          numa tela de 1440, e todo bloco esticava na mesma largura. */}
      <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-6 flex-1">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-10 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-64 w-full bg-canvas-2 rounded-rebrand-md" />
          </div>
        ) : !fixture ? (
          <div className={`${CARD} p-6 text-center text-sm text-status-danger`}>
            Não foi possível carregar este jogo.
          </div>
        ) : (
          <>
            {isDemo && <div className="mb-4"><DemoRibbon show /></div>}

            {/* Protótipo "Futebol Jogo" (Claude Design): o confronto e a melhor
                leitura moram na MESMA faixa forest, colada no cabeçalho. Eram dois
                blocos disputando o topo da tela. */}
            {jogoInfo && (
              <div data-tour="fut-jogo-header">
                {isDemo && <div className="mb-2"><DemoBadge /></div>}
                <FaixaPartida
                  jogo={jogoInfo}
                  valueRows={valueRows}
                  locked={locked}
                  rodada={prettyRound(fixture.round)}
                  estadio={fixture.venue_name ? `${fixture.venue_name}${fixture.venue_city ? `, ${fixture.venue_city}` : ''}` : null}
                  quando={fmtDateTime(fixture.kickoff_utc)}
                  formHome={extrasLoading ? [] : extras?.form_home || []}
                  formAway={extrasLoading ? [] : extras?.form_away || []}
                  homeTeamId={fixture.home_team_id}
                  awayTeamId={fixture.away_team_id}
                  onAbrirMercado={(slug) => {
                    setMercadoAtivo(slug);
                    setAba('mercados');
                  }}
                />
              </div>
            )}

            {!finished && showValue && <FutebolAccessBanner access={access} className="mt-5" />}

            {/* Duas abas: a leitura com os 5 mercados de um lado, os times do outro.
                O antigo "Resumo" virou a própria faixa da partida mais a coluna de
                mercados, então deixou de ser uma aba. */}
            <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
              <div
                data-tour="fut-jogo-abas"
                className="inline-flex p-[3px] rounded-[11px]"
                style={{ background: 'var(--canvas-2)', border: '1px solid #ded2b6' }}
              >
                {(
                  [
                    ['mercados', 'Leitura & mercados'],
                    ['times', 'Times'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setAba(k)}
                    className={`h-8 px-4 rounded-lg text-[13px] cursor-pointer transition border-0 ${
                      aba === k ? 'bg-white text-ink font-semibold shadow-sm' : 'bg-transparent text-ink-2 font-medium'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-[11.5px]" style={{ color: '#8d8672' }}>
                Leitura de risco, não recomendação de aposta
              </span>
            </div>

            <div className="mt-4">
              {aba === 'mercados' && (
                <BancadaMercados
                  jogo={jogoInfo}
                  valueRows={valueRows}
                  tendencies={tendencies}
                  locked={locked}
                  mercadoAtivo={mercadoAtivo}
                  onMercado={setMercadoAtivo}
                />
              )}

              {aba === 'times' && (
                <div data-tour="fut-jogo-contexto" className="flex flex-col gap-5">
                  <div className="grid lg:grid-cols-2 gap-5 items-start">
                    {statsCard}
                    {h2hCard}
                  </div>
                  {escalacaoCard}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
