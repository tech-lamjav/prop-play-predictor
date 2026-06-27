import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, ChevronRight, AlertTriangle } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolValueBoard, useFutebolAccess } from '@/hooks/use-futebol-data';
import FutebolDayStepper from '@/components/FutebolDayStepper';
import { Blur, FutebolAccessBanner } from '@/components/futebol/FutebolGate';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  pickLabel, marketLabel, fmtEdgeScore, groupBoardByFixture,
  faixaBadgeCls, faixaWord, faixaTone, chancePct, SCORE_MEDIA,
} from '@/utils/futebol-score';
import type { FutebolValueBoardRow } from '@/services/futebol-data.service';

const SAO_PAULO_TZ = 'America/Sao_Paulo';
const COMP_LABEL: Record<string, string> = { brasileirao: 'Brasileirão', copa_mundo: 'Copa do Mundo' };
const FINISHED_STATUS = new Set(['FT', 'AET', 'PEN']);

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
// Janela curta da navegação por dias (não varre a temporada inteira).
const DAY_WINDOW = 8;

type MarketFilter = 'all' | 'match_winner' | 'goals_over_under' | 'asian_handicap' | 'btts' | 'double_chance';
type FaixaFilter = 'all' | 'alta' | 'media';
type CompFilter = 'all' | 'brasileirao' | 'copa_mundo';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`h-8 px-3 rounded-rebrand-sm text-[12px] font-semibold border transition-colors shrink-0 ${active ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink border-line hover:bg-canvas-2'}`}>
      {children}
    </button>
  );
}

// Linha da tabela (desktop)
function OppRow({ o, onClick, muted, locked }: { o: FutebolValueBoardRow; onClick: () => void; muted?: boolean; locked?: boolean }) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const chance = chancePct(o.prob_justa_fechamento);
  return (
    <button onClick={onClick} className={`${GRID} w-full text-left px-5 py-3 border-t border-line hover:bg-canvas-2 transition ${muted ? 'opacity-60' : ''}`}>
      <span className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums text-[16px] w-10 h-9 ${faixaBadgeCls(o.faixa)}`}>{o.score}</span>
      <span className={`px-1.5 h-5 w-fit inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] ${faixaBadgeCls(o.faixa)}`}>{faixaWord(o.faixa)}</span>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <Crest teamId={o.home_team_id} name={o.home_team_name} size={20} />
          <Crest teamId={o.away_team_id} name={o.away_team_name} size={20} />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-tight text-ink truncate"><Blur active={!!locked}>{pick}</Blur></div>
          <div className="text-[11px] text-ink-3 truncate">{o.home_team_name} × {o.away_team_name}</div>
        </div>
      </div>
      <div className="min-w-0">
        <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{marketLabel(o.market)}</span>
        <div className="text-[10px] mt-1 tabular-nums text-ink-3 truncate">{COMP_LABEL[o.competition] || o.competition} · {fmtHour(o.kickoff_utc)}</div>
      </div>
      <div className="text-right tabular-nums text-[13px] font-semibold text-ink"><Blur active={!!locked}>{chance != null ? `${chance}%` : '—'}</Blur></div>
      <div className="text-right tabular-nums text-[13px] font-semibold text-ink"><Blur active={!!locked}>{o.best_odd.toFixed(2)}</Blur></div>
      <div className="text-right tabular-nums text-[14px] font-bold text-forest"><Blur active={!!locked}>{fmtEdgeScore(o.edge)}</Blur></div>
      <ChevronRight className="w-4 h-4 text-ink-3 justify-self-end" />
    </button>
  );
}

// Card (mobile)
function OppMobileCard({ o, onClick, locked }: { o: FutebolValueBoardRow; onClick: () => void; locked?: boolean }) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const chance = chancePct(o.prob_justa_fechamento);
  return (
    <button onClick={onClick} className="w-full text-left rounded-rebrand-md p-3.5 bg-white border border-line">
      <div className="flex items-start gap-3">
        <div className="flex items-center -space-x-1 shrink-0 pt-0.5">
          <Crest teamId={o.home_team_id} name={o.home_team_name} size={24} />
          <Crest teamId={o.away_team_id} name={o.away_team_name} size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 h-5 inline-flex items-center rounded text-[9px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{marketLabel(o.market)}</span>
            <span className={`px-1.5 h-5 inline-flex items-center rounded text-[9px] font-bold uppercase tracking-[0.1em] ${faixaBadgeCls(o.faixa)}`}>{faixaWord(o.faixa)}</span>
          </div>
          <div className="text-[15px] font-semibold tracking-tight mt-1.5 text-ink"><Blur active={!!locked}>{pick}</Blur></div>
          <div className="text-[11px] text-ink-3 truncate">{o.home_team_name} × {o.away_team_name} · {fmtHour(o.kickoff_utc)}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[8px] uppercase tracking-[0.14em] font-semibold text-ink-3">Score</div>
          <div className="text-[22px] font-bold tabular-nums tracking-tight leading-none text-forest">{o.score}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-3 pt-2.5 border-t border-line">
        {[['Chance', chance != null ? `${chance}%` : '—'], ['Odd', o.best_odd.toFixed(2)], ['Valor', fmtEdgeScore(o.edge)]].map(([l, v], i) => (
          <div key={l}>
            <div className="text-[8px] uppercase tracking-[0.14em] font-semibold text-ink-3">{l}</div>
            <div className={`text-[13px] font-semibold tabular-nums leading-none mt-0.5 ${i === 2 ? 'text-forest' : 'text-ink'}`}><Blur active={!!locked}>{v}</Blur></div>
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

export default function FutebolOportunidades() {
  const navigate = useNavigate();
  const { data: rows, isLoading } = useFutebolValueBoard();
  const { data: access } = useFutebolAccess();
  const locked = !access?.unlocked;
  const [mercado, setMercado] = useState<MarketFilter>('all');
  const [faixa, setFaixa] = useState<FaixaFilter>('all');
  const [comp, setComp] = useState<CompFilter>('all');
  const [day, setDay] = useState<string | null>(null);

  // pré-jogo (só tempo) — base estável da navegação por dias
  const timeUpcoming = useMemo(() => {
    if (!rows?.length) return [];
    const now = Date.now();
    return rows.filter((r) => {
      const t = kickoffMs(r.kickoff_utc);
      return t != null && t > now && !FINISHED_STATUS.has(r.status_short ?? '');
    });
  }, [rows]);

  const days = useMemo(() => {
    const set = new Set<string>();
    timeUpcoming.forEach((r) => { const d = brtDayStr(r.kickoff_utc); if (d) set.add(d); });
    return [...set].sort().slice(0, DAY_WINDOW);
  }, [timeUpcoming]);
  const selectedDay = (day && days.includes(day)) ? day : (days.includes(TODAY_BRT) ? TODAY_BRT : days[0]);

  const compsOnDay = useMemo(() => {
    const s = new Set<string>();
    timeUpcoming.forEach((r) => { if (brtDayStr(r.kickoff_utc) === selectedDay) s.add(r.competition); });
    return s;
  }, [timeUpcoming, selectedDay]);

  const filtered = useMemo(
    () => timeUpcoming.filter((r) => {
      if (brtDayStr(r.kickoff_utc) !== selectedDay) return false;
      if (mercado !== 'all' && r.market !== mercado) return false;
      if (faixa !== 'all' && faixaTone(r.faixa) !== faixa) return false;
      if (comp !== 'all' && r.competition !== comp) return false;
      return true;
    }),
    [timeUpcoming, selectedDay, mercado, faixa, comp]
  );

  const bestRows = useMemo(() => groupBoardByFixture(filtered).map((bf) => bf.best), [filtered]);
  const comValor = bestRows.filter((o) => o.score >= SCORE_MEDIA);
  const semValor = bestRows.filter((o) => o.score < SCORE_MEDIA);
  const nAlta = bestRows.filter((o) => faixaTone(o.faixa) === 'alta').length;
  const nMedia = bestRows.filter((o) => faixaTone(o.faixa) === 'media').length;
  const nBaixa = bestRows.filter((o) => faixaTone(o.faixa) === 'baixa').length;

  const go = (id: number) => navigate(`/futebol/jogo/${id}`);
  const key = (o: FutebolValueBoardRow) => `${o.fixture_id}-${o.market}-${o.outcome}-${o.line_value}`;

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />

      {/* Day stepper */}
      {!isLoading && days.length > 0 && (
        <div className="bg-white border-b border-line">
          <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-3">
            <FutebolDayStepper days={days} value={selectedDay} onChange={setDay} counts={Object.fromEntries(days.map((dd) => [dd, timeUpcoming.filter((r) => brtDayStr(r.kickoff_utc) === dd).length]))} />
          </div>
        </div>
      )}

      {/* Header + KPIs de faixa */}
      <div className="bg-white border-b border-line">
        <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-5 md:py-6 flex items-end justify-between gap-4">
          <div>
            <div className={LABEL}>Oportunidades</div>
            <h1 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-ink mt-1">{comValor.length} aposta{comValor.length === 1 ? '' : 's'} com valor</h1>
            <p className="text-[13px] mt-1 text-ink-2">Onde a odd paga acima da chance estimada · ranqueado por confiabilidade</p>
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
        <FutebolAccessBanner access={access} />

        {/* Filtros */}
        <div className="rounded-rebrand-md p-3 flex items-center gap-2 flex-wrap bg-white border border-line">
          <Filter className="w-4 h-4 text-ink-2 ml-1" />
          <span className={`${LABEL} mr-1`}>Mercado</span>
          <Chip active={mercado === 'all'} onClick={() => setMercado('all')}>Todos</Chip>
          <Chip active={mercado === 'match_winner'} onClick={() => setMercado('match_winner')}>Resultado</Chip>
          <Chip active={mercado === 'goals_over_under'} onClick={() => setMercado('goals_over_under')}>Gols</Chip>
          <Chip active={mercado === 'btts'} onClick={() => setMercado('btts')}>Ambos marcam</Chip>
          <Chip active={mercado === 'asian_handicap'} onClick={() => setMercado('asian_handicap')}>Handicap</Chip>
          <Chip active={mercado === 'double_chance'} onClick={() => setMercado('double_chance')}>Dupla chance</Chip>
          <div className="w-px h-5 mx-1 bg-line" />
          <span className={`${LABEL} mr-1`}>Faixa</span>
          <Chip active={faixa === 'all'} onClick={() => setFaixa('all')}>Todas</Chip>
          <Chip active={faixa === 'alta'} onClick={() => setFaixa('alta')}>Alta</Chip>
          <Chip active={faixa === 'media'} onClick={() => setFaixa('media')}>Média</Chip>
          <div className="flex-1 min-w-2" />
          <span className={`${LABEL} mr-1`}>Competição</span>
          <Chip active={comp === 'all'} onClick={() => setComp('all')}>Todas</Chip>
          {compsOnDay.has('brasileirao') && <Chip active={comp === 'brasileirao'} onClick={() => setComp('brasileirao')}>Brasileirão</Chip>}
          {compsOnDay.has('copa_mundo') && <Chip active={comp === 'copa_mundo'} onClick={() => setComp('copa_mundo')}>Copa</Chip>}
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
        ) : bestRows.length === 0 ? (
          <div className="rounded-rebrand-md bg-white border border-line p-6 text-center">
            <p className="text-sm text-ink-2">Nenhum jogo com odds nesse filtro.</p>
            <p className="text-xs text-ink-3 mt-1">As oportunidades aparecem quando há odds coletadas antes do jogo.</p>
          </div>
        ) : (
          <>
            {/* Tabela (desktop) */}
            <div className="hidden md:block rounded-rebrand-md overflow-hidden bg-white border border-line">
              <div className={`${GRID} px-5 py-2.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-3 bg-canvas-2`}>
                <div>Score ↓</div><div>Faixa</div><div>Aposta</div><div>Mercado</div>
                <div className="text-right">Chance</div><div className="text-right">Odd</div><div className="text-right">Valor</div><div />
              </div>
              {comValor.map((o) => <OppRow key={key(o)} o={o} onClick={() => go(o.fixture_id)} locked={locked} />)}
              {semValor.length > 0 && <Regua />}
              {semValor.map((o) => <OppRow key={key(o)} o={o} onClick={() => go(o.fixture_id)} muted locked={locked} />)}
            </div>

            {/* Cards (mobile) */}
            <div className="md:hidden flex flex-col gap-2.5">
              {comValor.map((o) => <OppMobileCard key={key(o)} o={o} onClick={() => go(o.fixture_id)} locked={locked} />)}
              {semValor.length > 0 && (
                <div className="flex items-center gap-2 py-1">
                  <span className="flex-1 h-px bg-line" /><span className="text-[11px] text-ink-3">sem valor claro</span><span className="flex-1 h-px bg-line" />
                </div>
              )}
              {semValor.map((o) => <div key={key(o)} className="opacity-60"><OppMobileCard o={o} onClick={() => go(o.fixture_id)} locked={locked} /></div>)}
            </div>
          </>
        )}

        {/* Banner honesto */}
        <div className="rounded-rebrand-md px-5 py-4 flex items-start gap-3" style={{ background: '#fef7df', border: '1px solid #fde68a' }}>
          <span className="mt-0.5 shrink-0" style={{ color: '#9a6c00' }}><AlertTriangle className="w-4 h-4" /></span>
          <div className="text-[12px] leading-relaxed" style={{ color: '#5a3c00' }}>
            <span className="font-semibold">Não é recomendação.</span> Valor = a odd paga acima da chance estimada. A régua separa o que tem valor claro do resto — abaixo dela, não enxergamos vantagem.
          </div>
        </div>

        {/* Como ler o Score + Faixas */}
        <div className="grid md:grid-cols-2 gap-4 mt-2">
          <div className="rounded-rebrand-md bg-white border border-line p-4">
            <div className={LABEL}>Como ler o Score</div>
            <p className="text-[12px] text-ink-2 mt-2 leading-relaxed">
              O <b className="text-ink">Score (0–100)</b> mostra o quanto a oportunidade é <b className="text-ink">confiável</b> — não a chance de acerto. Ele junta quatro coisas: o tamanho do valor (o quanto a odd paga acima do risco real), as premissas do jogo (ataque, defesa, mando, forma…), se a odd não é exagerada (nem zebra, nem mixaria) e se as principais casas vêm concordando com esse lado. Por isso uma "zebra" com valor alto bancada por uma casa só fica com score baixo.
            </p>
          </div>
          <div className="rounded-rebrand-md bg-white border border-line p-4">
            <div className={LABEL}>Faixas</div>
            <ul className="mt-2 space-y-2 text-[12px] text-ink-2">
              <li className="flex items-center gap-2"><span className={`w-9 text-center text-[11px] font-bold rounded px-1 py-0.5 ${faixaBadgeCls('Alta')}`}>60+</span> Alta — oportunidade de destaque</li>
              <li className="flex items-center gap-2"><span className={`w-9 text-center text-[11px] font-bold rounded px-1 py-0.5 ${faixaBadgeCls('Média')}`}>40+</span> Média — monitorar</li>
              <li className="flex items-center gap-2"><span className={`w-9 text-center text-[11px] font-bold rounded px-1 py-0.5 ${faixaBadgeCls('Baixa')}`}>&lt;40</span> Baixa — não sinaliza</li>
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
