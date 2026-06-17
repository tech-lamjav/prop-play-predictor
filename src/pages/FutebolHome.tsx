import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Target } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolFixtures, useFutebolStandings, useFutebolLeaders } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import type { FutebolFixture } from '@/services/futebol-data.service';
import { futebolZone, FUTEBOL_ZONE_COLOR } from '@/services/futebol-data.service';

const COMPETITION = 'brasileirao' as const;
const SEASON = 2026;
const SAO_PAULO_TZ = 'America/Sao_Paulo';

function parseUtc(raw: string | null): Date | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDayTime(raw: string | null): string {
  const d = parseUtc(raw);
  if (!d) return '—';
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
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

function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{title}</p>
      {onMore && (
        <button onClick={onMore} className="flex items-center gap-0.5 text-[11px] text-forest hover:text-forest-2 font-semibold">
          Ver mais <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function FutebolHome() {
  const navigate = useNavigate();
  const { data: fixtures, isLoading: loadingFix } = useFutebolFixtures(COMPETITION, SEASON);
  const { data: standings, isLoading: loadingStand } = useFutebolStandings(COMPETITION, SEASON);
  const { data: leaders, isLoading: loadingLead } = useFutebolLeaders(COMPETITION, SEASON);

  const proximos = useMemo(() => {
    const now = Date.now();
    return (fixtures || [])
      .filter((f: FutebolFixture) => !isFinished(f.status_short))
      .filter((f) => {
        const d = parseUtc(f.kickoff_utc || f.date_utc);
        return d ? d.getTime() >= now : true;
      })
      .slice(0, 6);
  }, [fixtures]);
  const topTabela = (standings || []).slice(0, 6);
  const topArtilheiros = (leaders?.scorers || []).slice(0, 5);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex-1">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-extrabold text-ink">Futebol</h1>
          <p className="text-sm text-ink-2">Brasileirão Série A · {SEASON}</p>
        </div>

        {/* CTA Oportunidades (value bet) */}
        <button
          onClick={() => navigate('/futebol/oportunidades')}
          className="w-full mb-6 flex items-center gap-3 rounded-rebrand-md bg-forest text-canvas px-4 py-3 hover:bg-forest-2 transition-colors text-left"
        >
          <Target className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Oportunidades</p>
            <p className="text-[11px] text-canvas/80">Onde a melhor odd está acima da linha justa — ordenado por valor (+EV).</p>
          </div>
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>

        {/* Próximos jogos */}
        <div className="mb-6">
          <SectionHeader title="Próximos jogos" onMore={() => navigate('/futebol/jogos')} />
          {loadingFix ? (
            <div className="space-y-1.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-canvas-2 rounded-rebrand-md" />)}</div>
          ) : proximos.length === 0 ? (
            <div className={`${CARD} p-6 text-center text-sm text-ink-3`}>Sem jogos futuros agendados.</div>
          ) : (
            <div className="space-y-1.5">
              {proximos.map((f) => (
                <button key={f.fixture_id} onClick={() => navigate(`/futebol/jogo/${f.fixture_id}`)}
                  className={`${CARD} w-full flex items-center gap-3 px-3 py-2.5 hover:border-line-2 transition-colors`}>
                  <span className="w-24 text-[10px] text-ink-3 text-left shrink-0">{fmtDayTime(f.kickoff_utc || f.date_utc)}</span>
                  <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
                    <span className="text-sm text-ink truncate text-right">{f.home_team_name}</span>
                    <Crest teamId={f.home_team_id} name={f.home_team_name} />
                  </div>
                  <span className="text-[11px] text-ink-3 font-semibold">x</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <Crest teamId={f.away_team_id} name={f.away_team_name} />
                    <span className="text-sm text-ink truncate">{f.away_team_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Classificação */}
          <div>
            <SectionHeader title="Classificação" onMore={() => navigate('/futebol/jogos?view=tabela')} />
            {loadingStand ? (
              <Skeleton className="h-56 w-full bg-canvas-2 rounded-rebrand-md" />
            ) : (
              <div className={`${CARD} overflow-hidden`}>
                {topTabela.map((r) => {
                  const zone = futebolZone(r.rank_description);
                  return (
                    <button key={r.team_id} onClick={() => navigate(`/futebol/time/${r.team_id}?c=${COMPETITION}&s=${SEASON}`)}
                      style={{ borderLeftColor: zone ? FUTEBOL_ZONE_COLOR[zone] : 'transparent' }}
                      className="w-full flex items-center gap-2 px-3 py-2 border-b border-line last:border-b-0 border-l-4 hover:bg-canvas-2 text-sm">
                      <span className="w-4 text-xs text-ink-3 tabular-nums">{r.rank}</span>
                      <Crest teamId={r.team_id} name={r.team_name} />
                      <span className="flex-1 truncate text-ink text-left">{r.team_name}</span>
                      <span className="text-xs text-ink-3 tabular-nums">{r.played}j</span>
                      <span className="w-8 text-right font-bold text-ink tabular-nums">{r.points}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Artilheiros */}
          <div>
            <SectionHeader title="Artilheiros" onMore={() => navigate('/futebol/jogos?view=artilheiros')} />
            {loadingLead ? (
              <Skeleton className="h-56 w-full bg-canvas-2 rounded-rebrand-md" />
            ) : (
              <div className={`${CARD} overflow-hidden`}>
                {topArtilheiros.length ? topArtilheiros.map((s, i) => (
                  <div key={s.player_id} className="flex items-center gap-2 px-3 py-2 border-b border-line last:border-0 text-sm">
                    <span className="w-4 text-xs text-ink-3 tabular-nums">{i + 1}</span>
                    <span className="flex-1 truncate text-ink">{s.player_name}</span>
                    <span className="text-xs text-ink-3 truncate max-w-[110px] text-right">{s.team_name}</span>
                    <span className="w-7 text-right font-bold text-forest tabular-nums">{s.goals}</span>
                  </div>
                )) : <div className="p-6 text-center text-sm text-ink-3">Sem dados.</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
