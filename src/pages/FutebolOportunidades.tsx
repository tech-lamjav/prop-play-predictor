import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, AlertTriangle } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useFutebolValueBoard, useFutebolAccess, useFutebolFixturesMulti, useFutebolAlertedPicks } from '@/hooks/use-futebol-data';
import FutebolDayStepper from '@/components/FutebolDayStepper';
import { Blur, FutebolAccessBanner } from '@/components/futebol/FutebolGate';
import { avisoSemDado } from '@/utils/futebol-sem-dado';
import { RegistrarApostaCTA } from '@/components/futebol/RegistrarAposta';
import { draftFromBoardRow } from '@/components/futebol/registrar-aposta-utils';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import { competitionLabel, sortCompetitions, ALL_COMPETITIONS } from '@/utils/futebol-competitions';
import {
  pickLabel, marketLabel, fmtEdgeScore,
  faixaBadgeCls, faixaWord, faixaTone, chancePct, SCORE_MEDIA,
} from '@/utils/futebol-score';
import { settleFutebol, resultBadge, isHit, type BetResult } from '@/utils/futebol-settlement';
import type { FutebolValueBoardRow, FutebolAlertedPick, FutebolFixture } from '@/services/futebol-data.service';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboardingTour } from '@/components/onboarding/useOnboardingTour';
import { FUT_OPP_TOUR_ID, makeFutebolOportunidadesSteps } from '@/components/onboarding/tours';
import { DemoRibbon, DemoBadge } from '@/components/onboarding/DemoRibbon';
import { demoFutebolBoard } from '@/components/onboarding/demo/futebol';

const SAO_PAULO_TZ = 'America/Sao_Paulo';
const FINISHED_STATUS = new Set(['FT', 'AET', 'PEN']);

/**
 * Linha da lista. O board (mart) sempre traz Score, faixa, chance e valor; uma
 * oportunidade REGISTRADA (que existiu no dia e o board não tem mais, porque o
 * mart é full-refresh e re-escolhe a janela de odds) pode não ter esses números
 * do instante em que era oportunidade — nas enviadas antes da migration 091 não
 * foram guardados. Ela continua sendo oportunidade do dia; só esses campos ficam
 * vazios. FutebolValueBoardRow é atribuível a isto (number → number | null).
 */
type OppLike = Omit<FutebolValueBoardRow, 'score' | 'faixa' | 'edge' | 'prob_justa_fechamento'> & {
  score: number | null;
  faixa: string | null;
  edge: number | null;
  prob_justa_fechamento: number | null;
};

/** Chave de uma oportunidade — casa board com registro do que foi enviado. */
const oppKey = (fixtureId: number, market: string | null, outcome: string | null, line: number | null) =>
  `${fixtureId}|${market ?? ''}|${outcome ?? ''}|${line ?? ''}`;

/**
 * Monta a linha de uma oportunidade registrada (enviada no daily) com os valores
 * do momento do envio. Sem fixture casado, cai pro "Casa × Fora" do registro:
 * é melhor manter a oportunidade na lista sem escudo do que perder o registro.
 */
function oppFromAlerted(a: FutebolAlertedPick, fx?: FutebolFixture): OppLike {
  const [rawHome, rawAway] = a.match_description.split('×');
  return {
    fixture_id: a.fixture_id,
    home_team_id: fx?.home_team_id ?? 0,
    away_team_id: fx?.away_team_id ?? 0,
    home_team_name: fx?.home_team_name ?? (rawHome?.trim() || 'Casa'),
    away_team_name: fx?.away_team_name ?? (rawAway?.trim() || 'Fora'),
    competition: a.league ?? '',
    kickoff_utc: fx?.kickoff_utc ?? null,
    status_short: fx?.status_short ?? null,
    market: a.market!,
    outcome: a.outcome!,
    line_value: a.line_value,
    best_odd: Number(a.odds),
    best_book: '',
    avg_odd: Number(a.odds),
    n_casas: 0,
    janela_usada: a.janela_usada ?? '',
    pts_valor: 0,
    pts_premissas: 0,
    pts_corroboracao: 0,
    penalidades: 0,
    evidencias: [],
    // Números do instante em que era oportunidade. Null nas enviadas antes da
    // migration 091 (o pipeline sobrescreve a janela e destrói chance/valor/Score
    // da manhã); daí em diante vêm preenchidos e a linha fica igual à do board.
    score: a.score,
    faixa: a.faixa,
    edge: a.edge,
    prob_justa_fechamento: a.prob_justa_fechamento,
  };
}

function kickoffMs(raw: string | null): number | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d.getTime();
}
function fmtHour(raw: string | null): string {
  const ms = kickoffMs(raw);
  if (ms == null) return '—';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}
function brtDayStr(raw: string | null): string | null {
  const ms = kickoffMs(raw);
  if (ms == null) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
const TODAY_BRT = new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}
function Crest({ teamId, name, size = 20 }: { teamId: number; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) return <img src={logo} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain shrink-0" loading="lazy" />;
  return <div style={{ width: size, height: size }} className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[8px] font-bold text-ink-2 shrink-0">{crestInitials(name)}</div>;
}

const LABEL = 'text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3';
const GRID = 'grid grid-cols-[56px_64px_1fr_140px_64px_80px_72px_28px] gap-3 items-center';

type MarketFilter = 'all' | 'match_winner' | 'goals_over_under' | 'asian_handicap' | 'btts' | 'double_chance';
type FaixaFilter = 'all' | 'alta' | 'media';
type CompFilter = string; // 'all' | slug da competição (data-driven)

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`h-8 px-3 rounded-rebrand-sm text-[12px] font-semibold border transition-colors shrink-0 ${active ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink border-line hover:bg-canvas-2'}`}>
      {children}
    </button>
  );
}

const MARKET_ITEMS: { value: MarketFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'match_winner', label: 'Resultado' },
  { value: 'goals_over_under', label: 'Gols' },
  { value: 'btts', label: 'Ambos marcam' },
  { value: 'asian_handicap', label: 'Handicap' },
  { value: 'double_chance', label: 'Dupla chance' },
];

// Mercado: label + chips com rolagem horizontal + bolinha-seta quando há mais à direita.
function MarketChips({ value, onChange }: { value: MarketFilter; onChange: (m: MarketFilter) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, []);
  return (
    <div className="flex items-center gap-2.5 min-w-0 sm:flex-1">
      <span className={`${LABEL} shrink-0`}>Mercado</span>
      <div className="relative min-w-0 flex-1">
        <div ref={ref} className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -my-1 py-1 pr-7">
          {MARKET_ITEMS.map((m) => (
            <Chip key={m.value} active={value === m.value} onClick={() => onChange(m.value)}>{m.label}</Chip>
          ))}
        </div>
        {more && (
          <button
            type="button"
            aria-label="Ver mais mercados"
            onClick={() => ref.current?.scrollBy({ left: 160, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-line grid place-items-center shadow-sm hover:bg-canvas-2"
          >
            <ChevronRight className="w-3.5 h-3.5 text-ink-2" />
          </button>
        )}
      </div>
    </div>
  );
}

// Dropdown compacto de filtro (label + valor atual + opções). Limpo no mobile.
function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-rebrand-sm border border-line bg-white text-[12px] font-semibold text-ink hover:bg-canvas-2 transition shrink-0">
          <span className="text-ink-3 font-medium uppercase tracking-[0.1em] text-[10px]">{label}</span>
          <span>{current?.label ?? '—'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="theme-bolao bg-white border-line min-w-[160px]">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`cursor-pointer text-[13px] ${o.value === value ? 'text-forest font-semibold' : 'text-ink'}`}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Linha da tabela (desktop)
function OppRow({ o, onClick, muted, locked, result, homeGoals, awayGoals }: {
  o: OppLike; onClick: () => void; muted?: boolean; locked?: boolean;
  result?: BetResult | null; homeGoals?: number | null; awayGoals?: number | null;
}) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const chance = chancePct(o.prob_justa_fechamento);
  const showLock = !!locked && !result; // histórico (com resultado) é sempre visível
  const hasScore = homeGoals != null && awayGoals != null;
  const semDado = avisoSemDado(o.premissas_sem_dado);
  // Sem os números do instante em que era oportunidade, mostra "—" em vez de
  // chutar faixa (faixaWord de vazio diria "Baixa", que seria falso).
  const badgeCls = o.faixa != null ? faixaBadgeCls(o.faixa) : 'bg-canvas-2 text-ink-3 border border-line';
  return (
    <button onClick={onClick} className={`${GRID} w-full text-left px-5 py-3 border-t border-line hover:bg-canvas-2 transition ${muted ? 'opacity-60' : ''}`}>
      <span className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums text-[16px] w-10 h-9 ${badgeCls}`}>{o.score ?? '—'}</span>
      <span className={`px-1.5 h-5 w-fit inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] ${badgeCls}`}>{o.faixa != null ? faixaWord(o.faixa) : '—'}</span>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <Crest teamId={o.home_team_id} name={o.home_team_name} size={20} />
          <Crest teamId={o.away_team_id} name={o.away_team_name} size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold tracking-tight text-ink truncate"><Blur active={showLock}>{pick}</Blur></span>
            {result && <ResultBadge r={result} />}
          </div>
          <div className="text-[11px] text-ink-3 truncate">
            {hasScore
              ? `${o.home_team_name} ${homeGoals} × ${awayGoals} ${o.away_team_name}`
              : `${o.home_team_name} × ${o.away_team_name}`}
          </div>
          {/* Ressalva, não defeito: fala da nossa confiança, não da aposta. */}
          {semDado && <div className="text-[11px] text-ink-3 truncate">{semDado.curto}</div>}
        </div>
      </div>
      <div className="min-w-0">
        <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{marketLabel(o.market)}</span>
        <div className="text-[10px] mt-1 tabular-nums text-ink-3 truncate">{competitionLabel(o.competition)} · {fmtHour(o.kickoff_utc)}</div>
      </div>
      <div className="text-right tabular-nums text-[13px] font-semibold text-ink"><Blur active={showLock}>{chance != null ? `${chance}%` : '—'}</Blur></div>
      <div className="text-right tabular-nums text-[13px] font-semibold text-ink"><Blur active={showLock}>{o.best_odd.toFixed(2)}</Blur></div>
      <div className="text-right tabular-nums text-[14px] font-bold text-forest"><Blur active={showLock}>{o.edge != null ? fmtEdgeScore(o.edge) : '—'}</Blur></div>
      <ChevronRight className="w-4 h-4 text-ink-3 justify-self-end" />
    </button>
  );
}

// Card (mobile)
function OppMobileCard({ o, onClick, locked, result, homeGoals, awayGoals }: {
  o: OppLike; onClick: () => void; locked?: boolean;
  result?: BetResult | null; homeGoals?: number | null; awayGoals?: number | null;
}) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const chance = chancePct(o.prob_justa_fechamento);
  const showLock = !!locked && !result;
  const hasScore = homeGoals != null && awayGoals != null;
  const semDado = avisoSemDado(o.premissas_sem_dado);
  return (
    <button onClick={onClick} className="w-full text-left rounded-rebrand-md p-3.5 bg-white border border-line">
      <div className="flex items-start gap-3">
        <div className="flex items-center -space-x-1 shrink-0 pt-0.5">
          <Crest teamId={o.home_team_id} name={o.home_team_name} size={24} />
          <Crest teamId={o.away_team_id} name={o.away_team_name} size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-1.5 h-5 inline-flex items-center rounded text-[9px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{marketLabel(o.market)}</span>
            {o.faixa != null && (
              <span className={`px-1.5 h-5 inline-flex items-center rounded text-[9px] font-bold uppercase tracking-[0.1em] ${faixaBadgeCls(o.faixa)}`}>{faixaWord(o.faixa)}</span>
            )}
            {result && <ResultBadge r={result} />}
          </div>
          <div className="text-[15px] font-semibold tracking-tight mt-1.5 text-ink"><Blur active={showLock}>{pick}</Blur></div>
          <div className="text-[11px] text-ink-3 truncate">
            {hasScore
              ? `${o.home_team_name} ${homeGoals} × ${awayGoals} ${o.away_team_name} · ${fmtHour(o.kickoff_utc)}`
              : `${o.home_team_name} × ${o.away_team_name} · ${fmtHour(o.kickoff_utc)}`}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[8px] uppercase tracking-[0.14em] font-semibold text-ink-3">Score</div>
          <div className="text-[22px] font-bold tabular-nums tracking-tight leading-none text-forest">{o.score ?? '—'}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-3 pt-2.5 border-t border-line">
        {[['Chance', chance != null ? `${chance}%` : '—'], ['Odd', o.best_odd.toFixed(2)], ['Valor', o.edge != null ? fmtEdgeScore(o.edge) : '—']].map(([l, v], i) => (
          <div key={l}>
            <div className="text-[8px] uppercase tracking-[0.14em] font-semibold text-ink-3">{l}</div>
            <div className={`text-[13px] font-semibold tabular-nums leading-none mt-0.5 ${i === 2 ? 'text-forest' : 'text-ink'}`}><Blur active={showLock}>{v}</Blur></div>
          </div>
        ))}
      </div>
    </button>
  );
}

function FaixaKpi({ n, label, tone }: { n: number; label: string; tone: 'alta' | 'media' | 'baixa' }) {
  const style = tone === 'alta' ? { background: '#dcefe2', color: '#0a3d2e' }
    : tone === 'media' ? { background: '#fef7df', color: '#9a6c00' }
    : { background: '#eef0ec', color: '#5a625a' };
  return (
    <div className="px-3 py-2 rounded-rebrand-sm text-center min-w-[62px]" style={style}>
      <div className="text-[18px] font-bold tabular-nums leading-none">{n}</div>
      <div className="text-[9px] uppercase tracking-[0.14em] font-bold mt-1">{label}</div>
    </div>
  );
}

const Regua = () => (
  <div className="px-5 py-2.5 flex items-center gap-2 bg-canvas-2 border-t border-line">
    <span className="flex-1 h-px bg-line" />
    <span className="shrink-0 px-2 text-[11px] text-ink-3">abaixo daqui: sem valor claro</span>
    <span className="flex-1 h-px bg-line" />
  </div>
);

// Selo de resultado (histórico): Bateu / Anulada / Não bateu (verde/cinza/vermelho).
function ResultBadge({ r }: { r: BetResult }) {
  const b = resultBadge(r);
  const style = b.tone === 'won' ? { background: '#dcefe2', color: '#0a3d2e' }
    : b.tone === 'push' ? { background: '#eef0ec', color: '#5a625a' }
    : { background: '#fbe3e8', color: '#be123c' };
  return (
    <span className="shrink-0 px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.06em]" style={style}>
      {b.label}
    </span>
  );
}

export default function FutebolOportunidades() {
  const navigate = useNavigate();
  const { data: rows, isLoading } = useFutebolValueBoard();
  const { data: fixtures } = useFutebolFixturesMulti(ALL_COMPETITIONS, 2026);
  const { data: access } = useFutebolAccess();
  const oppTour = useOnboardingTour(FUT_OPP_TOUR_ID, { enabled: !isLoading });
  const isDemo = oppTour.run; // durante o tour, preenche a tela com exemplo
  const locked = isDemo ? false : !access?.unlocked;
  const [mercado, setMercado] = useState<MarketFilter>('all');
  const [faixa, setFaixa] = useState<FaixaFilter>('all');
  const [comp, setComp] = useState<CompFilter>('all');
  const [day, setDay] = useState<string | null>(null);

  const allRows = useMemo(() => rows ?? [], [rows]);

  // Placar por fixture (pra liquidar os jogos já encerrados = histórico "bateu/não").
  const goalsMap = useMemo(() => {
    const m = new Map<number, { gh: number | null; ga: number | null }>();
    (fixtures ?? []).forEach((f) => m.set(f.fixture_id, { gh: f.goals_home, ga: f.goals_away }));
    return m;
  }, [fixtures]);
  // Fixture completo (escudo, nome, status) pra montar a linha de uma
  // oportunidade registrada que o board não tem mais.
  const fixtureMap = useMemo(() => {
    const m = new Map<number, FutebolFixture>();
    (fixtures ?? []).forEach((f) => m.set(f.fixture_id, f));
    return m;
  }, [fixtures]);

  const resultOf = (o: OppLike): BetResult | null => {
    if (!FINISHED_STATUS.has(o.status_short ?? '')) return null;
    const g = goalsMap.get(o.fixture_id);
    return g ? settleFutebol(o.market, o.outcome, o.line_value, g.gh, g.ga) : null;
  };

  // ── Oportunidades REGISTRADAS ─────────────────────────────────────────────
  // O mart é full-refresh e escolhe UMA janela de odds por jogo (t24h de manhã →
  // t15m no fechamento), então uma oportunidade que existiu durante o dia pode
  // não estar mais lá — foi o caso do "Palmeiras −0,25" de 22/07, que saiu no
  // daily e deu green. Ela FOI oportunidade de fato, então o registro entra na
  // lista do dia como qualquer outra, com os valores do momento em que era.
  // Fonte: daily_opportunity_picks via get_futebol_alerted_picks (migration 091).
  const { data: alertedRaw } = useFutebolAlertedPicks();
  // Sem market/outcome não há como casar com o board nem liquidar (linhas
  // anteriores ao 091 podem vir sem).
  const registradasAll = useMemo(
    () => (alertedRaw ?? []).filter((a) => !!a.market && !!a.outcome),
    [alertedRaw]
  );

  // Dias no stepper: dias COM oportunidade (board = passado + presente) + dias
  // FUTUROS com jogos agendados (fixtures, janela curta) — pra navegar pra frente
  // mesmo antes das odds entrarem (~24h antes do jogo).
  const days = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => { const d = brtDayStr(r.kickoff_utc); if (d) set.add(d); });
    // Dias que tiveram oportunidade registrada: o mart larga dia antigo (o 22/07
    // já não tem nenhuma linha lá), e sem isto o dia ficaria inalcançável.
    registradasAll.forEach((a) => set.add(a.game_day));
    const now = Date.now();
    const horizon = now + 8 * 864e5; // ~8 dias à frente
    (fixtures ?? []).forEach((f) => {
      const t = kickoffMs(f.kickoff_utc);
      if (t != null && t > now && t < horizon && !FINISHED_STATUS.has(f.status_short ?? '')) {
        const d = brtDayStr(f.kickoff_utc);
        if (d) set.add(d);
      }
    });
    return [...set].sort();
  }, [allRows, fixtures, registradasAll]);
  // Default: hoje se houver; senão o próximo dia futuro; senão o último disponível.
  const selectedDay = (day && days.includes(day))
    ? day
    : (days.includes(TODAY_BRT) ? TODAY_BRT : (days.find((d) => d >= TODAY_BRT) ?? days[days.length - 1]));
  const isPastDay = !!selectedDay && selectedDay < TODAY_BRT;
  const isFutureDay = !!selectedDay && selectedDay > TODAY_BRT;

  const compsOnDay = useMemo(() => {
    const s = new Set<string>();
    allRows.forEach((r) => { if (brtDayStr(r.kickoff_utc) === selectedDay) s.add(r.competition); });
    registradasAll.forEach((a) => { if (a.game_day === selectedDay && a.league) s.add(a.league); });
    return s;
  }, [allRows, selectedDay, registradasAll]);

  const faixaOptions = [{ value: 'all', label: 'Todas' }, { value: 'alta', label: 'Alta' }, { value: 'media', label: 'Média' }];
  const compOptions = [
    { value: 'all', label: 'Todas' },
    ...sortCompetitions([...compsOnDay]).map((c) => ({ value: c, label: competitionLabel(c) })),
  ];

  // Lista do dia = board + oportunidades registradas que o board não tem mais.
  // Uma lista só: as duas são oportunidade daquele dia, a diferença é de onde
  // veio o número, não de natureza.
  const dayRows = useMemo<OppLike[]>(() => {
    const board: OppLike[] = allRows.filter((r) => brtDayStr(r.kickoff_utc) === selectedDay);
    const noBoard = new Set(board.map((r) => oppKey(r.fixture_id, r.market, r.outcome, r.line_value)));
    const registradas = registradasAll
      .filter((a) => a.game_day === selectedDay)
      .filter((a) => !noBoard.has(oppKey(a.fixture_id, a.market, a.outcome, a.line_value)))
      .map((a) => oppFromAlerted(a, fixtureMap.get(a.fixture_id)));
    return [...board, ...registradas];
  }, [allRows, selectedDay, registradasAll, fixtureMap]);

  const filtered = useMemo(
    () => dayRows.filter((r) => {
      if (mercado !== 'all' && r.market !== mercado) return false;
      // Sem faixa não dá pra classificar, então o filtro de faixa a esconde.
      if (faixa !== 'all' && (r.faixa == null || faixaTone(r.faixa) !== faixa)) return false;
      if (comp !== 'all' && r.competition !== comp) return false;
      return true;
    }),
    [dayRows, mercado, faixa, comp]
  );

  // Uma linha por oportunidade (sem colapsar por jogo), ranqueado por Score.
  // Registro sem Score vai primeiro: o daily só manda pick acima do corte e do
  // topo do ranking, então na hora do envio ela era das melhores do dia — o
  // número exato daquele instante é que não foi guardado.
  const realBestRows = useMemo(
    () => [...filtered].sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return -1;
      if (b.score == null) return 1;
      return b.score - a.score;
    }),
    [filtered]
  );
  const bestRows: OppLike[] = isDemo ? demoFutebolBoard : realBestRows;
  // Registro sem Score conta como com valor: foi enviado acima do corte.
  const comValor = bestRows.filter((o) => o.score == null || o.score >= SCORE_MEDIA);
  const semValor = bestRows.filter((o) => o.score != null && o.score < SCORE_MEDIA);
  const nAlta = bestRows.filter((o) => o.faixa != null && faixaTone(o.faixa) === 'alta').length;
  const nMedia = bestRows.filter((o) => o.faixa != null && faixaTone(o.faixa) === 'media').length;
  const nBaixa = bestRows.filter((o) => o.faixa != null && faixaTone(o.faixa) === 'baixa').length;

  // Contagem de oportunidades COM VALOR por dia (badge do stepper).
  const countByDay = useMemo(() => {
    const byDay = new Map<string, FutebolValueBoardRow[]>();
    allRows.forEach((r) => {
      const d = brtDayStr(r.kickoff_utc);
      if (!d) return;
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(r);
    });
    const out: Record<string, number> = {};
    byDay.forEach((rs, d) => { out[d] = rs.filter((o) => o.score >= SCORE_MEDIA).length; });
    // Registrada que o board não tem entra na conta, senão dia que só tem
    // registro apareceria zerado no seletor.
    registradasAll.forEach((a) => {
      const naLista = (byDay.get(a.game_day) ?? []).some(
        (r) => oppKey(r.fixture_id, r.market, r.outcome, r.line_value) === oppKey(a.fixture_id, a.market, a.outcome, a.line_value)
      );
      if (!naLista) out[a.game_day] = (out[a.game_day] ?? 0) + 1;
    });
    return out;
  }, [allRows, registradasAll]);

  // Resumo do dia passado: quantas das "com valor" bateram.
  const resumo = useMemo(() => {
    if (!isPastDay) return null;
    let hit = 0, miss = 0, push = 0, settled = 0;
    comValor.forEach((o) => {
      const r = resultOf(o);
      if (!r) return;
      settled++;
      if (r === 'push') push++;
      else if (isHit(r)) hit++;
      else miss++;
    });
    return { hit, miss, push, settled };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPastDay, comValor, goalsMap]);

  const go = (id: number) => navigate(`/futebol/jogo/${id}`);
  const key = (o: OppLike) => `${o.fixture_id}-${o.market}-${o.outcome}-${o.line_value}`;

  const oppSteps = useMemo(
    () => makeFutebolOportunidadesSteps({ hasDayBar: !isLoading && days.length > 0, hasBoard: bestRows.length > 0 }),
    [isLoading, days.length, bestRows.length],
  );

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <OnboardingTour tourId={FUT_OPP_TOUR_ID} steps={oppSteps} run={oppTour.run} onFinish={oppTour.finish} />

      {/* Day stepper */}
      {!isLoading && days.length > 0 && (
        <div data-tour="fut-opp-datas" className="bg-white border-b border-line">
          <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-3">
            <FutebolDayStepper days={days} value={selectedDay} onChange={setDay} counts={countByDay} />
          </div>
        </div>
      )}

      {/* Header + KPIs de faixa */}
      <div className="bg-white border-b border-line">
        <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-5 md:py-6 flex items-end justify-between gap-4">
          <div>
            <div className={`${LABEL} flex items-center gap-2`}>{isPastDay ? 'Histórico' : 'Oportunidades'}{isDemo && <DemoBadge />}</div>
            {isPastDay && resumo && resumo.settled > 0 ? (
              <>
                <h1 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-ink mt-1">{resumo.hit} de {resumo.settled} deram green</h1>
                <p className="text-[13px] mt-1 text-ink-2">Resultado das oportunidades com valor deste dia{resumo.push > 0 ? ` · ${resumo.push} anulada${resumo.push === 1 ? '' : 's'}` : ''}</p>
              </>
            ) : (
              <>
                <h1 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-ink mt-1">{comValor.length} aposta{comValor.length === 1 ? '' : 's'} com valor</h1>
                <p className="text-[13px] mt-1 text-ink-2">{isPastDay ? 'Resultado das oportunidades com valor deste dia' : 'Onde a odd paga acima da chance estimada · em ordem de confiança'}</p>
              </>
            )}
          </div>
          {!isLoading && bestRows.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <FaixaKpi n={nAlta} label="Alta" tone="alta" />
              <FaixaKpi n={nMedia} label="Média" tone="media" />
              <FaixaKpi n={nBaixa} label="Baixa" tone="baixa" />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-6 flex flex-col gap-4 flex-1">
        <DemoRibbon show={isDemo} />
        <FutebolAccessBanner access={access} />

        {/* Filtros — desktop: 1 linha (Mercado à esq · dropdowns à dir); mobile: 2 linhas */}
        <div data-tour="fut-opp-filtros" className="rounded-rebrand-md p-3 bg-white border border-line flex flex-col sm:flex-row sm:items-center gap-3">
          <MarketChips value={mercado} onChange={setMercado} />
          <div className="h-px bg-line/70 sm:hidden" />
          {/* `flex-wrap`: os dois filtros somam ~294px e não cabem lado a lado
              abaixo de ~340px. Sem isso a linha `shrink-0` estourava a página. */}
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:shrink-0">
            <FilterSelect label="Faixa" value={faixa} options={faixaOptions} onChange={(v) => setFaixa(v as FaixaFilter)} />
            <FilterSelect label="Competição" value={comp} options={compOptions} onChange={(v) => setComp(v as CompFilter)} />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
        ) : (isPastDay ? comValor.length === 0 : bestRows.length === 0) ? (
          <div className="rounded-rebrand-md bg-white border border-line p-6 text-center">
            <p className="text-sm text-ink-2">
              {isPastDay ? 'Nenhuma oportunidade com valor nesse dia.'
                : isFutureDay ? 'Ainda sem oportunidades para este dia.'
                : 'Nenhum jogo com odds nesse filtro.'}
            </p>
            <p className="text-xs text-ink-3 mt-1">
              {isPastDay ? 'Só listamos aqui as apostas que sinalizamos com valor.'
                : isFutureDay ? 'As odds costumam ser coletadas a partir de ~24h antes do jogo — as oportunidades aparecem aqui quando chegarem.'
                : 'As oportunidades aparecem quando há odds coletadas antes do jogo.'}
            </p>
          </div>
        ) : (
          <div data-tour="fut-opp-lista">
            {/* Tabela (desktop) */}
            <div className="hidden md:block rounded-rebrand-md overflow-hidden bg-white border border-line">
              <div className={`${GRID} px-5 py-2.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3 bg-canvas-2`}>
                <div>Score ↓</div><div>Faixa</div><div>Aposta</div><div>Mercado</div>
                <div className="text-right">Chance</div><div className="text-right">Odd</div><div className="text-right">Valor</div><div />
              </div>
              {comValor.map((o) => {
                const res = resultOf(o);
                const g = goalsMap.get(o.fixture_id);
                return (
                  <div key={key(o)}>
                    <OppRow o={o} onClick={() => go(o.fixture_id)} locked={locked} result={res} homeGoals={g?.gh} awayGoals={g?.ga} />
                    {!isPastDay && !locked && !res && (
                      <div className="px-5 pb-2 -mt-0.5">
                        <RegistrarApostaCTA variant="text" draft={draftFromBoardRow(o)} />
                      </div>
                    )}
                  </div>
                );
              })}
              {!isPastDay && semValor.length > 0 && <Regua />}
              {!isPastDay && semValor.map((o) => <OppRow key={key(o)} o={o} onClick={() => go(o.fixture_id)} muted locked={locked} />)}
            </div>

            {/* Cards (mobile) */}
            <div className="md:hidden flex flex-col gap-2.5">
              {comValor.map((o) => {
                const res = resultOf(o);
                const g = goalsMap.get(o.fixture_id);
                return (
                  <div key={key(o)}>
                    <OppMobileCard o={o} onClick={() => go(o.fixture_id)} locked={locked} result={res} homeGoals={g?.gh} awayGoals={g?.ga} />
                    {!isPastDay && !locked && !res && <div className="px-1 pt-1.5"><RegistrarApostaCTA variant="text" draft={draftFromBoardRow(o)} /></div>}
                  </div>
                );
              })}
              {!isPastDay && semValor.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <span className="flex-1 h-px bg-line" /><span className="text-[11px] text-ink-3">sem valor claro</span><span className="flex-1 h-px bg-line" />
                </div>
              )}
              {!isPastDay && semValor.map((o) => <div key={key(o)} className="opacity-60"><OppMobileCard o={o} onClick={() => go(o.fixture_id)} locked={locked} /></div>)}
            </div>
          </div>
        )}

        {/* Banner honesto */}
        <div className="rounded-rebrand-md px-5 py-4 flex items-start gap-3" style={{ background: '#fef7df', border: '1px solid #fde68a' }}>
          <span className="mt-0.5 shrink-0" style={{ color: '#9a6c00' }}><AlertTriangle className="w-4 h-4" /></span>
          <div className="text-[12px] leading-relaxed" style={{ color: '#5a3c00' }}>
            <span className="font-semibold">Não é recomendação.</span> Valor = a odd paga acima da chance estimada. A régua separa o que tem valor claro do resto. Abaixo dela, não enxergamos vantagem.
          </div>
        </div>

        {/* Como ler o Score + Faixas */}
        <div data-tour="fut-opp-metodologia" className="grid md:grid-cols-2 gap-4 mt-2">
          <div className="rounded-rebrand-md bg-white border border-line p-4">
            <div className={LABEL}>Como ler o Score</div>
            <p className="text-[12px] text-ink-2 mt-2 leading-relaxed">
              O <b className="text-ink">Score (0–100)</b> mostra o quanto a oportunidade é <b className="text-ink">confiável</b>, não a chance de acerto. Ele junta quatro coisas: o tamanho do valor (o quanto a odd paga acima do risco real), o cenário do jogo (ataque, defesa, mando, forma…), se a odd não é exagerada (nem zebra, nem mixaria) e se as principais casas vêm concordando com esse lado. Por isso uma "zebra" com valor alto bancada por uma casa só fica com score baixo.
            </p>
          </div>
          <div className="rounded-rebrand-md bg-white border border-line p-4">
            <div className={LABEL}>Faixas</div>
            <ul className="mt-2 space-y-2 text-[12px] text-ink-2">
              <li className="flex items-center gap-2"><span className={`w-9 text-center text-[11px] font-bold rounded px-1 py-0.5 ${faixaBadgeCls('Alta')}`}>60+</span> Alta, oportunidade de destaque</li>
              <li className="flex items-center gap-2"><span className={`w-9 text-center text-[11px] font-bold rounded px-1 py-0.5 ${faixaBadgeCls('Média')}`}>40+</span> Média, vale acompanhar</li>
              <li className="flex items-center gap-2"><span className={`w-9 text-center text-[11px] font-bold rounded px-1 py-0.5 ${faixaBadgeCls('Baixa')}`}>&lt;40</span> Baixa, não sinaliza</li>
            </ul>
            <p className="text-[10px] text-ink-3 mt-3 leading-snug">
              Odds pré-jogo (não ao vivo). Mercados: Resultado (1X2), Gols (Over/Under), Handicap asiático, Ambos marcam e Dupla chance; outros entram conforme liberados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
