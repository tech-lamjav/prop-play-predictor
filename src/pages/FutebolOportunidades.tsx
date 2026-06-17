import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, ChevronRight } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import FutebolSubNav from '@/components/FutebolSubNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolOddsBoard } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import { computeBoardOpportunities, fmtPct, fmtEdge, type Opportunity } from '@/utils/futebol-value';

const SAO_PAULO_TZ = 'America/Sao_Paulo';
const COMP_LABEL: Record<string, string> = { brasileirao: 'Brasileirão', copa_mundo: 'Copa do Mundo' };

function fmtKickoff(raw: string | null): string {
  if (!raw) return '—';
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return '—';
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}
function Crest({ teamId, name }: { teamId: number; name: string }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) return <img src={logo} alt={name} onError={() => setErr(true)} className="w-5 h-5 object-contain" loading="lazy" />;
  return <div className="w-5 h-5 rounded-full bg-canvas-2 border border-line flex items-center justify-center text-[8px] font-bold text-ink-2">{crestInitials(name)}</div>;
}

const CARD = 'bg-white border border-line rounded-rebrand-md';

function edgeCls(edge: number): string {
  if (edge >= 0.015) return 'bg-forest text-canvas';
  if (edge >= 0) return 'bg-forest/15 text-forest border border-forest/40';
  return 'bg-canvas-2 text-ink-3 border border-line';
}

function OpportunityCard({ o, onClick }: { o: Opportunity; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${CARD} w-full text-left p-3 hover:border-line-2 transition-colors`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] text-ink-3 mb-1">
            <span className="uppercase tracking-wide">{COMP_LABEL[o.competition] || o.competition}</span>
            <span>•</span>
            <span>{fmtKickoff(o.kickoffUtc)}</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Crest teamId={o.homeId} name={o.homeName} />
            <span className="text-sm font-semibold text-ink truncate">{o.homeName} <span className="text-ink-3 font-normal">x</span> {o.awayName}</span>
            <Crest teamId={o.awayId} name={o.awayName} />
          </div>
          <p className="text-xs text-ink-2">
            <span className="text-ink-3">{o.marketLabel}:</span> <b className="text-ink">{o.outcomeLabel}</b>
          </p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            melhor odd <b className="text-ink">{o.bestOdd.toFixed(2)}</b> na <b className="text-ink">{o.bestBook}</b> · justa {fmtPct(o.fairProb)} · {o.nBooks} casas
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-sm font-extrabold rounded px-1.5 py-0.5 tabular-nums ${edgeCls(o.edge)}`}>{fmtEdge(o.edge)}</span>
          <ChevronRight className="w-4 h-4 text-ink-3" />
        </div>
      </div>
    </button>
  );
}

export default function FutebolOportunidades() {
  const navigate = useNavigate();
  const { data: rows, isLoading } = useFutebolOddsBoard();
  const board = useMemo(() => (rows?.length ? computeBoardOpportunities(rows) : null), [rows]);

  const go = (id: number) => navigate(`/futebol/jogo/${id}`);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <FutebolSubNav />
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex-1">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-extrabold text-ink">Oportunidades</h1>
          <p className="text-sm text-ink-2">
            Onde a melhor odd do mercado está acima da linha justa (sharp). Ordenado por valor (+EV).
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
        ) : !board || board.fixtures === 0 ? (
          <div className={`${CARD} p-6 text-center`}>
            <p className="text-sm text-ink-2">Sem jogos com odds no momento.</p>
            <p className="text-xs text-ink-3 mt-1">As oportunidades aparecem quando há odds coletadas (janelas T-24h e T-1h antes do jogo).</p>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-ink-3 mb-3">
              {board.fixtures} jogo{board.fixtures === 1 ? '' : 's'} com odds · {board.opportunities.length} oportunidade{board.opportunities.length === 1 ? '' : 's'} com valor
            </p>

            {board.opportunities.length > 0 ? (
              <div className="space-y-2">
                {board.opportunities.map((o) => (
                  <OpportunityCard key={`${o.fixtureId}-${o.marketKey}-${o.outcomeKey}`} o={o} onClick={() => go(o.fixtureId)} />
                ))}
              </div>
            ) : (
              <div className={`${CARD} p-5 text-center text-sm text-ink-2`}>
                Nenhum mercado com valor claro agora — as melhores odds estão abaixo da linha justa. Veja os jogos monitorados abaixo.
              </div>
            )}

            {/* Jogos monitorados (cobertura) */}
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3 mt-6 mb-2 px-1">Jogos monitorados</p>
            <div className={`${CARD} overflow-hidden`}>
              {board.monitored.map((m) => (
                <button key={m.fixtureId} onClick={() => go(m.fixtureId)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-line last:border-0 hover:bg-canvas-2 text-sm">
                  <Crest teamId={m.homeId} name={m.homeName} />
                  <span className="flex-1 truncate text-ink text-left">{m.homeName} <span className="text-ink-3">x</span> {m.awayName}</span>
                  <span className="text-[10px] text-ink-3 hidden sm:inline">{fmtKickoff(m.kickoffUtc)}</span>
                  <span className={`text-[11px] font-bold tabular-nums w-14 text-right ${m.bestEdge >= 0 ? 'text-forest' : 'text-ink-3'}`}>{fmtEdge(m.bestEdge)}</span>
                  <ChevronRight className="w-4 h-4 text-ink-3" />
                </button>
              ))}
            </div>

            <div className="flex items-start gap-2 mt-4">
              <Info className="w-3.5 h-3.5 text-amber-2 mt-0.5 shrink-0" />
              <p className="text-[10px] text-ink-3 leading-snug">
                "Justa" = probabilidade do mercado após remover a margem (devig) da linha sharp da Pinnacle (ou do consenso quando a Pinnacle não cobre). Valor = melhor odd acima da justa. Odds coletadas em T-24h e T-1h (não ao vivo). Mercados: Resultado, Mais/Menos 2,5 gols e Ambos marcam. Não é recomendação de aposta.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
