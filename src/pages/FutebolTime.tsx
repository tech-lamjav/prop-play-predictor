import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolTeamProfile } from '@/hooks/use-futebol-data';
import type { Competition, FutebolScopeResult, FutebolScopeStats } from '@/services/futebol-data.service';

const COMP_LABEL: Record<string, string> = { brasileirao: 'Brasileirão', copa_mundo: 'Copa do Mundo' };
const SCOPE_LABEL: Record<string, string> = { geral: 'Geral', casa: 'Em casa', fora: 'Fora' };
const SCOPE_ORDER = ['geral', 'casa', 'fora'];
const CARD = 'bg-white border border-line rounded-rebrand-md';

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

function num(v: number | null | undefined, suffix = ''): string {
  return v === null || v === undefined ? '—' : `${v}${suffix}`;
}

export default function FutebolTime() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const competition = (params.get('c') as Competition) || 'brasileirao';
  const season = Number(params.get('s')) || 2025;

  const { data, isLoading, isError } = useFutebolTeamProfile(teamId ? Number(teamId) : undefined, competition, season);

  const results = (data?.results || []).slice().sort((a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope));
  const stats = (data?.stats_avg || []).slice().sort((a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope));

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex-1">
        <button
          onClick={() => navigate('/futebol/jogos')}
          className="flex items-center gap-1 text-xs text-ink-2 hover:text-ink mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-40 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-40 w-full bg-canvas-2 rounded-rebrand-md" />
          </div>
        ) : isError || !data?.team ? (
          <div className={`${CARD} p-6 text-center text-sm text-status-danger`}>Não foi possível carregar este time.</div>
        ) : (
          <>
            {/* Header */}
            <div className={`${CARD} p-4 flex items-center gap-3`}>
              <Crest name={data.team.team_name || ''} logo={data.team.team_logo} />
              <div>
                <h1 className="font-display text-xl font-extrabold text-ink">{data.team.team_name}</h1>
                <p className="text-xs text-ink-3">{COMP_LABEL[competition] || competition} · {season}</p>
              </div>
            </div>

            {/* Resultados por mando */}
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3 mb-2 px-1">Resultados</p>
              <div className={`${CARD} overflow-hidden`}>
                <div className="grid grid-cols-[80px_1fr_72px_56px_56px] gap-1 px-3 py-2 text-[10px] uppercase tracking-wide text-ink-3 border-b border-line">
                  <span></span><span className="text-center">V-E-D</span><span className="text-center">Gols (pró/contra)</span><span className="text-center">+2.5</span><span className="text-center">BTTS</span>
                </div>
                {results.length ? results.map((r: FutebolScopeResult) => (
                  <div key={r.scope} className="grid grid-cols-[80px_1fr_72px_56px_56px] gap-1 px-3 py-2.5 items-center text-sm border-b border-line last:border-0">
                    <span className="font-semibold text-ink">{SCOPE_LABEL[r.scope]}</span>
                    <span className="text-center text-ink-2 tabular-nums">{r.wins}-{r.draws}-{r.losses}</span>
                    <span className="text-center text-ink-2 tabular-nums">{num(r.avg_gf)} / {num(r.avg_ga)}</span>
                    <span className="text-center tabular-nums font-medium text-forest">{num(r.over25_pct, '%')}</span>
                    <span className="text-center tabular-nums font-medium text-amber-2">{num(r.btts_pct, '%')}</span>
                  </div>
                )) : <div className="px-3 py-4 text-center text-sm text-ink-3">Sem jogos.</div>}
              </div>
              <p className="text-[10px] text-ink-3 mt-1 px-1">Médias de gols por jogo · +2.5 = jogos com 3+ gols · BTTS = ambos marcaram</p>
            </div>

            {/* Médias por jogo */}
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3 mb-2 px-1">Médias por jogo</p>
              <div className={`${CARD} overflow-hidden`}>
                <div className="grid grid-cols-[80px_repeat(5,1fr)] gap-1 px-3 py-2 text-[10px] uppercase tracking-wide text-ink-3 border-b border-line">
                  <span></span><span className="text-center">Posse</span><span className="text-center">Fin.</span><span className="text-center">xG</span><span className="text-center">Esc.</span><span className="text-center">Amar.</span>
                </div>
                {stats.length ? stats.map((s: FutebolScopeStats) => (
                  <div key={s.scope} className="grid grid-cols-[80px_repeat(5,1fr)] gap-1 px-3 py-2.5 items-center text-sm border-b border-line last:border-0">
                    <span className="font-semibold text-ink">{SCOPE_LABEL[s.scope]}</span>
                    <span className="text-center text-ink-2 tabular-nums">{num(s.avg_possession, '%')}</span>
                    <span className="text-center text-ink-2 tabular-nums">{num(s.avg_shots)}</span>
                    <span className="text-center tabular-nums font-medium text-forest">{num(s.avg_xg)}</span>
                    <span className="text-center text-ink-2 tabular-nums">{num(s.avg_corners)}</span>
                    <span className="text-center text-ink-2 tabular-nums">{num(s.avg_yellow)}</span>
                  </div>
                )) : <div className="px-3 py-4 text-center text-sm text-ink-3">Sem estatísticas.</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
