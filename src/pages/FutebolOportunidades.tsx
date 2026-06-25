import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, ChevronRight, Check } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolValueBoard } from '@/hooks/use-futebol-data';
import FutebolDayStepper from '@/components/FutebolDayStepper';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import {
  pickLabel, marketLabel, fmtEdgeScore, freqEmDez, groupBoardByFixture,
  faixaBadgeCls, faixaSpineCls, faixaWord, faixaTone, topEvidencia,
  SCORE_ALTA, SCORE_MEDIA,
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
function fmtKickoff(raw: string | null): string {
  const ms = kickoffMs(raw);
  if (ms == null) return '—';
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}
function Crest({ teamId, name, size = 20 }: { teamId: number; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) return <img src={logo} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain shrink-0" loading="lazy" />;
  return <div style={{ width: size, height: size }} className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[8px] font-bold text-ink-2 shrink-0">{crestInitials(name)}</div>;
}

const CARD = 'bg-white border border-line rounded-rebrand-md';
const LABEL = 'text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-3';

type MarketFilter = 'all' | 'match_winner' | 'goals_over_under' | 'asian_handicap' | 'btts';
type FaixaFilter = 'all' | 'alta' | 'media';

/** Data BRT (YYYY-MM-DD) de um kickoff; null se inválido. */
function brtDayStr(raw: string | null): string | null {
  const ms = kickoffMs(raw);
  if (ms == null) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
const TODAY_BRT = new Intl.DateTimeFormat('en-CA', { timeZone: SAO_PAULO_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`h-7 px-3 rounded-rebrand-sm text-[11px] font-semibold border transition-colors ${active ? 'bg-forest text-canvas border-forest' : 'bg-white text-ink-2 border-line hover:text-ink'}`}>
      {children}
    </button>
  );
}

// Card rico de oportunidade em destaque (com color-spine + "por quê")
function DestaqueCard({ o, onClick }: { o: FutebolValueBoardRow; onClick: () => void }) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  const ev = topEvidencia(o.evidencias);
  return (
    <button onClick={onClick} className={`${CARD} border-l-4 ${faixaSpineCls(o.faixa)} p-4 text-left hover:shadow-sm hover:border-line-2 transition w-full`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-ink-3">{COMP_LABEL[o.competition] || o.competition} · {fmtKickoff(o.kickoff_utc)}</div>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <Crest teamId={o.home_team_id} name={o.home_team_name} size={18} />
            <span className="text-sm font-semibold text-ink truncate">{o.home_team_name} <span className="text-ink-3 font-normal">x</span> {o.away_team_name}</span>
            <Crest teamId={o.away_team_id} name={o.away_team_name} size={18} />
          </div>
        </div>
        <div className="text-center shrink-0">
          <span className={`text-base font-extrabold rounded px-2 py-0.5 tabular-nums ${faixaBadgeCls(o.faixa)}`}>{o.score}</span>
          <div className="text-[9px] uppercase tracking-wide text-ink-3 mt-0.5">{faixaWord(o.faixa)}</div>
        </div>
      </div>
      <div className="mt-2.5 text-sm">
        <span className="text-ink-3">{marketLabel(o.market)}:</span> <b className="text-ink">{pick}</b>
      </div>
      {ev && (
        <p className="flex items-start gap-1.5 text-[12px] text-ink-2 mt-1.5">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-status-success" /><span>{ev}</span>
        </p>
      )}
      <div className="text-[11px] text-ink-3 mt-2.5 pt-2.5 border-t border-line tabular-nums">
        odd <b className="text-ink">{o.best_odd.toFixed(2)}</b> · valor <span className="text-forest font-semibold">{fmtEdgeScore(o.edge)}</span> · se paga em ~{freqEmDez(o.best_odd)} de 10
      </div>
    </button>
  );
}

// Linha da tabela de monitorados (color-spine + colunas)
function MonitorRow({ o, onClick }: { o: FutebolValueBoardRow; onClick: () => void }) {
  const pick = pickLabel(o.market, o.outcome, o.line_value, o.home_team_name, o.away_team_name);
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 pl-3 pr-3 py-3 border-l-4 ${faixaSpineCls(o.faixa)} border-b border-line last:border-b-0 hover:bg-canvas-2 transition text-left`}>
      <Crest teamId={o.home_team_id} name={o.home_team_name} size={18} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ink truncate">{o.home_team_name} <span className="text-ink-3">x</span> {o.away_team_name}</div>
        <div className="text-[11px] text-ink-3 truncate">{fmtKickoff(o.kickoff_utc)} · {marketLabel(o.market)}: {pick}</div>
      </div>
      <div className="hidden sm:flex items-center gap-4 text-[12px] tabular-nums shrink-0">
        <span className="text-ink-2 w-14 text-right">odd {o.best_odd.toFixed(2)}</span>
        <span className="text-forest font-semibold w-14 text-right">{fmtEdgeScore(o.edge)}</span>
      </div>
      <span className={`text-[12px] font-bold rounded px-2 py-0.5 tabular-nums shrink-0 ${faixaBadgeCls(o.faixa)}`} title="Score de Confiabilidade">{o.score}</span>
      <ChevronRight className="w-4 h-4 text-ink-3 shrink-0" />
    </button>
  );
}

export default function FutebolOportunidades() {
  const navigate = useNavigate();
  const { data: rows, isLoading } = useFutebolValueBoard();
  const [mercado, setMercado] = useState<MarketFilter>('all');
  const [faixa, setFaixa] = useState<FaixaFilter>('all');
  const [day, setDay] = useState<string | null>(null);

  // pré-jogo (só tempo) — base estável da navegação por dias (independe de mercado/faixa)
  const timeUpcoming = useMemo(() => {
    if (!rows?.length) return [];
    const now = Date.now();
    return rows.filter((r) => {
      const t = kickoffMs(r.kickoff_utc);
      return t != null && t > now && !FINISHED_STATUS.has(r.status_short ?? '');
    });
  }, [rows]);

  // dias disponíveis (BRT) e o dia efetivamente selecionado
  const days = useMemo(() => {
    const set = new Set<string>();
    timeUpcoming.forEach((r) => { const d = brtDayStr(r.kickoff_utc); if (d) set.add(d); });
    return [...set].sort();
  }, [timeUpcoming]);
  const selectedDay = (day && days.includes(day)) ? day : (days.includes(TODAY_BRT) ? TODAY_BRT : days[0]);

  // dia selecionado + filtros de mercado/faixa
  const filtered = useMemo(
    () => timeUpcoming.filter((r) => {
      if (brtDayStr(r.kickoff_utc) !== selectedDay) return false;
      if (mercado !== 'all' && r.market !== mercado) return false;
      if (faixa !== 'all' && faixaTone(r.faixa) !== faixa) return false;
      return true;
    }),
    [timeUpcoming, selectedDay, mercado, faixa]
  );

  const byFixture = useMemo(() => groupBoardByFixture(filtered), [filtered]);
  const bestRows = useMemo(() => byFixture.map((bf) => bf.best), [byFixture]);

  const destaque = bestRows.filter((o) => o.score >= SCORE_MEDIA).slice(0, 6);
  const destaqueIds = new Set(destaque.map((o) => o.fixture_id));
  const monitorados = bestRows.filter((o) => !destaqueIds.has(o.fixture_id));
  const nAlta = bestRows.filter((o) => o.score >= SCORE_ALTA).length;
  const nMedia = bestRows.filter((o) => o.score >= SCORE_MEDIA && o.score < SCORE_ALTA).length;

  const go = (id: number) => navigate(`/futebol/jogo/${id}`);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-6 flex-1">
        <div className="mb-4">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-ink">Oportunidades</h1>
            {!isLoading && days.length > 0 && (
              <FutebolDayStepper days={days} value={selectedDay} onChange={setDay} className="mt-1 shrink-0" />
            )}
          </div>
          <p className="text-sm text-ink-2 mt-1">
            Ordenado pelo <b className="text-ink">Score de Confiabilidade</b> — combina o tamanho do valor, as premissas do jogo, uma odd nem exagerada nem mixaria e a concordância das principais casas.
          </p>
          {!isLoading && byFixture.length > 0 && (
            <p className="text-[11px] text-ink-3 mt-2">
              {byFixture.length} jogo{byFixture.length === 1 ? '' : 's'} monitorado{byFixture.length === 1 ? '' : 's'}
              {nAlta > 0 && <> · <span className="text-forest font-semibold">{nAlta} de alta confiabilidade</span></>}
              {nMedia > 0 && <> · <span className="text-amber-2 font-semibold">{nMedia} de média</span></>}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className={LABEL + ' mr-1'}>Mercado</span>
            <Chip active={mercado === 'all'} onClick={() => setMercado('all')}>Todos</Chip>
            <Chip active={mercado === 'match_winner'} onClick={() => setMercado('match_winner')}>Resultado</Chip>
            <Chip active={mercado === 'goals_over_under'} onClick={() => setMercado('goals_over_under')}>Gols</Chip>
            <Chip active={mercado === 'asian_handicap'} onClick={() => setMercado('asian_handicap')}>Handicap</Chip>
            <Chip active={mercado === 'btts'} onClick={() => setMercado('btts')}>Ambos marcam</Chip>
            <span className={LABEL + ' ml-3 mr-1'}>Faixa</span>
            <Chip active={faixa === 'all'} onClick={() => setFaixa('all')}>Todas</Chip>
            <Chip active={faixa === 'alta'} onClick={() => setFaixa('alta')}>Alta</Chip>
            <Chip active={faixa === 'media'} onClick={() => setFaixa('media')}>Média</Chip>
          </div>
        </div>

        {isLoading ? (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
            <div className="lg:col-span-4"><Skeleton className="h-40 w-full bg-canvas-2 rounded-rebrand-md" /></div>
          </div>
        ) : byFixture.length === 0 ? (
          <div className={`${CARD} p-6 text-center`}>
            <p className="text-sm text-ink-2">Nenhum jogo com odds nesse filtro.</p>
            <p className="text-xs text-ink-3 mt-1">As oportunidades aparecem quando há odds coletadas antes do jogo.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-6">
            {/* Board */}
            <div className="lg:col-span-8">
              {/* Em destaque */}
              <div className={LABEL}>Em destaque</div>
              {destaque.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  {destaque.map((o) => (
                    <DestaqueCard key={`${o.fixture_id}-${o.market}-${o.outcome}-${o.line_value}`} o={o} onClick={() => go(o.fixture_id)} />
                  ))}
                </div>
              ) : (
                <div className={`${CARD} p-5 mt-2 text-sm text-ink-2`}>
                  Nada de alta/média confiabilidade agora — as melhores odds estão perto da linha justa. Veja os jogos monitorados abaixo.
                </div>
              )}

              {/* Monitorados (tabela) */}
              {monitorados.length > 0 && (
                <>
                  <div className={`${LABEL} mt-6 mb-2`}>Monitorados</div>
                  <div className="hidden sm:flex items-center gap-3 px-3 pb-2 text-[10px] uppercase tracking-wide text-ink-3 font-semibold">
                    <span className="w-[18px]" />
                    <span className="flex-1">Jogo · melhor aposta</span>
                    <span className="w-14 text-right">Odd</span>
                    <span className="w-14 text-right">Valor</span>
                    <span className="w-8 text-right">Score</span>
                    <span className="w-4" />
                  </div>
                  <div className={`${CARD} overflow-hidden`}>
                    {monitorados.map((o) => (
                      <MonitorRow key={`${o.fixture_id}-${o.market}-${o.outcome}-${o.line_value}`} o={o} onClick={() => go(o.fixture_id)} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trilho */}
            <aside className="lg:col-span-4 space-y-4">
              <div className={`${CARD} p-4`}>
                <div className={LABEL}>Como ler o Score</div>
                <p className="text-[12px] text-ink-2 mt-2 leading-relaxed">
                  O <b className="text-ink">Score (0–100)</b> mostra o quanto a oportunidade é <b className="text-ink">confiável</b> — não a chance de acerto. Ele junta quatro coisas: o tamanho do valor (o quanto a odd paga acima do risco real), as premissas do jogo (ataque, defesa, mando, forma…), se a odd não é exagerada (nem zebra, nem mixaria) e se as principais casas vêm concordando com esse lado. Por isso uma "zebra" com valor alto bancada por uma casa só fica com score baixo.
                </p>
              </div>
              <div className={`${CARD} p-4`}>
                <div className={LABEL}>Faixas</div>
                <ul className="mt-2 space-y-2 text-[12px] text-ink-2">
                  <li className="flex items-center gap-2"><span className={`w-8 text-center text-[11px] font-bold rounded ${faixaBadgeCls('Alta')}`}>60+</span> Alta — oportunidade de destaque</li>
                  <li className="flex items-center gap-2"><span className={`w-8 text-center text-[11px] font-bold rounded ${faixaBadgeCls('Média')}`}>40+</span> Média — monitorar</li>
                  <li className="flex items-center gap-2"><span className={`w-8 text-center text-[11px] font-bold rounded ${faixaBadgeCls('Baixa')}`}>&lt;40</span> Baixa — não sinaliza</li>
                </ul>
              </div>
              <div className="flex items-start gap-2 px-1">
                <Info className="w-3.5 h-3.5 text-amber-2 mt-0.5 shrink-0" />
                <p className="text-[10px] text-ink-3 leading-snug">
                  Odds pré-jogo (não ao vivo). Mercados: Resultado (1X2), Gols (Over/Under), Handicap asiático e Ambos marcam; outros entram conforme liberados. Não é recomendação de aposta.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
