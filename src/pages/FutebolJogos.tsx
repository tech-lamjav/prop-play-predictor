import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolFixtures, useFutebolStandings } from '@/hooks/use-futebol-data';
import type { Competition, FutebolFixture, FutebolStandingRow } from '@/services/futebol-data.service';

const COMPETITIONS: { value: Competition; label: string }[] = [
  { value: 'brasileirao', label: 'Brasileirão' },
  { value: 'copa_mundo', label: 'Copa do Mundo' },
];

const SEASONS: Record<Competition, number[]> = {
  brasileirao: [2024, 2025, 2026],
  copa_mundo: [2026],
};

const SAO_PAULO_TZ = 'America/Sao_Paulo';
const TODAY = new Date();

function parseUtc(raw: string | null): Date | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}

function fmtTime(raw: string | null): string {
  const d = parseUtc(raw);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, hour: '2-digit', minute: '2-digit' }).format(d);
}

function fmtDayHeader(dateUtc: string | null): string {
  if (!dateUtc) return '—';
  const d = new Date(`${dateUtc}T12:00:00Z`);
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, weekday: 'short', day: '2-digit', month: '2-digit' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyRound(round: string | null): string {
  if (!round) return 'Rodada';
  const m = round.match(/Regular Season\s*-\s*(\d+)/i);
  return m ? `Rodada ${m[1]}` : round;
}

function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}

function isFinished(status: string | null): boolean {
  return status === 'FT' || status === 'AET' || status === 'PEN';
}

function Crest({ name, logo }: { name: string; logo: string | null }) {
  const [err, setErr] = useState(false);
  if (logo && !err) {
    return <img src={logo} alt={name} onError={() => setErr(true)} className="w-6 h-6 object-contain" loading="lazy" />;
  }
  return (
    <div className="w-6 h-6 rounded-full bg-canvas-2 border border-line flex items-center justify-center text-[9px] font-bold text-ink-2">
      {crestInitials(name)}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-rebrand-sm text-xs font-semibold transition-colors ${
        active ? 'bg-forest text-canvas' : 'bg-canvas-2 text-ink-2 border border-line hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

const GRID = 'grid grid-cols-[24px_1fr_repeat(5,26px)_34px] gap-1 items-center';

function StandingsTable({ rows, loading, onTeam }: { rows?: FutebolStandingRow[]; loading: boolean; onTeam: (id: number) => void }) {
  if (loading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full bg-canvas-2 rounded-rebrand-sm" />
        ))}
      </div>
    );
  }
  if (!rows?.length) {
    return <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-ink-3">Sem classificação pra esse filtro.</div>;
  }
  return (
    <div className="bg-white border border-line rounded-rebrand-md overflow-hidden">
      <div className={`${GRID} px-3 py-2 text-[10px] uppercase tracking-wide text-ink-3 border-b border-line`}>
        <span>#</span><span>Time</span>
        <span className="text-center">P</span><span className="text-center">V</span>
        <span className="text-center">E</span><span className="text-center">D</span>
        <span className="text-center">SG</span><span className="text-center">Pts</span>
      </div>
      {rows.map((r, i) => (
        <button
          key={r.team_id}
          onClick={() => onTeam(r.team_id)}
          className={`${GRID} w-full px-3 py-2 text-sm hover:bg-canvas-2 border-b border-line last:border-0`}
        >
          <span className="text-ink-3 text-xs tabular-nums text-left">{i + 1}</span>
          <span className="flex items-center gap-2 min-w-0">
            <Crest name={r.team_name} logo={r.team_logo} />
            <span className="truncate text-ink text-left">{r.team_name}</span>
          </span>
          <span className="text-center text-ink-2 tabular-nums">{r.played}</span>
          <span className="text-center text-ink-2 tabular-nums">{r.wins}</span>
          <span className="text-center text-ink-2 tabular-nums">{r.draws}</span>
          <span className="text-center text-ink-2 tabular-nums">{r.losses}</span>
          <span className="text-center text-ink-2 tabular-nums">{r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}</span>
          <span className="text-center font-bold text-ink tabular-nums">{r.points}</span>
        </button>
      ))}
    </div>
  );
}

function MatchRow({ fixture, onClick }: { fixture: FutebolFixture; onClick: () => void }) {
  const finished = isFinished(fixture.status_short);
  const homeWin = finished && (fixture.goals_home ?? 0) > (fixture.goals_away ?? 0);
  const awayWin = finished && (fixture.goals_away ?? 0) > (fixture.goals_home ?? 0);
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-white border border-line rounded-rebrand-md px-3 py-2.5 hover:border-line-2 hover:shadow-sm transition-all"
    >
      {/* Home */}
      <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
        <span className={`text-sm truncate text-right ${homeWin ? 'text-ink font-semibold' : 'text-ink-2'}`}>
          {fixture.home_team_name}
        </span>
        <Crest name={fixture.home_team_name} logo={fixture.home_team_logo} />
      </div>

      {/* Placar / hora */}
      <div className="shrink-0 w-16 text-center">
        {finished ? (
          <span className="inline-block px-2 py-0.5 rounded-rebrand-sm bg-canvas-2 text-ink text-sm font-bold tabular-nums">
            {fixture.goals_home ?? '-'}–{fixture.goals_away ?? '-'}
          </span>
        ) : (
          <span className="text-xs font-semibold text-ink-3 tabular-nums">{fmtTime(fixture.kickoff_utc) || 'x'}</span>
        )}
      </div>

      {/* Away */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Crest name={fixture.away_team_name} logo={fixture.away_team_logo} />
        <span className={`text-sm truncate ${awayWin ? 'text-ink font-semibold' : 'text-ink-2'}`}>
          {fixture.away_team_name}
        </span>
      </div>
    </button>
  );
}

export default function FutebolJogos() {
  const navigate = useNavigate();
  const [competition, setCompetition] = useState<Competition>('brasileirao');
  const [season, setSeason] = useState<number>(2025);
  const [roundIdx, setRoundIdx] = useState(0);

  const [view, setView] = useState<'jogos' | 'tabela'>('jogos');

  const { data: fixtures, isLoading, isError } = useFutebolFixtures(competition, season);
  const { data: standings, isLoading: loadingStandings } = useFutebolStandings(competition, season, view === 'tabela');

  // rodadas na ordem cronológica (fixtures já vêm ordenadas por kickoff)
  const rounds = useMemo(() => {
    const seen: string[] = [];
    (fixtures || []).forEach((f) => {
      if (f.round && !seen.includes(f.round)) seen.push(f.round);
    });
    return seen;
  }, [fixtures]);

  // default: rodada do jogo mais próximo de hoje
  useEffect(() => {
    if (!fixtures?.length || !rounds.length) return;
    let bestRound = fixtures[0].round;
    let bestDelta = Infinity;
    for (const f of fixtures) {
      const d = parseUtc(f.kickoff_utc || f.date_utc);
      if (!d) continue;
      const delta = Math.abs(d.getTime() - TODAY.getTime());
      if (delta < bestDelta) { bestDelta = delta; bestRound = f.round; }
    }
    const idx = rounds.indexOf(bestRound as string);
    setRoundIdx(idx >= 0 ? idx : 0);
  }, [fixtures, rounds]);

  const currentRound = rounds[roundIdx];

  // jogos da rodada agrupados por dia
  const groups = useMemo(() => {
    const list = (fixtures || []).filter((f) => f.round === currentRound);
    const byDay = new Map<string, FutebolFixture[]>();
    list.forEach((f) => {
      const key = f.date_utc || '—';
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(f);
    });
    return Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [fixtures, currentRound]);

  const roundCount = groups.reduce((n, [, g]) => n + g.length, 0);

  const handleCompetition = (c: Competition) => {
    setCompetition(c);
    setSeason(SEASONS[c][0]);
  };

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex-1">
        <div className="mb-4">
          <h1 className="font-display text-2xl font-extrabold text-ink">Futebol</h1>
          <p className="text-sm text-ink-2">
            Estatística por jogo. <span className="text-ink-3">Análise de valor entra quando o modelo estiver pronto.</span>
          </p>
        </div>

        {/* Segmento Jogos / Tabela */}
        <div className="flex gap-1 mb-3 bg-canvas-2 border border-line rounded-rebrand-md p-1 w-fit">
          {(['jogos', 'tabela'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`h-7 px-4 rounded-rebrand-sm text-xs font-semibold transition-colors ${
                view === v ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {v === 'jogos' ? 'Jogos' : 'Tabela'}
            </button>
          ))}
        </div>

        {/* Competição + temporada (pills) */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {COMPETITIONS.map((c) => (
            <Pill key={c.value} active={competition === c.value} onClick={() => handleCompetition(c.value)}>
              {c.label}
            </Pill>
          ))}
          <span className="w-px h-5 bg-line mx-1" />
          {SEASONS[competition].map((s) => (
            <Pill key={s} active={season === s} onClick={() => setSeason(s)}>{s}</Pill>
          ))}
        </div>

        {/* Stepper de rodada */}
        {view === 'jogos' && !isLoading && !isError && rounds.length > 0 && (
          <div className="flex items-center justify-between bg-white border border-line rounded-rebrand-md px-2 py-1.5 mb-4">
            <button
              onClick={() => setRoundIdx((i) => Math.max(0, i - 1))}
              disabled={roundIdx <= 0}
              className="h-8 w-8 flex items-center justify-center rounded-rebrand-sm text-ink-2 hover:bg-canvas-2 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Rodada anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <div className="text-sm font-bold text-ink">{prettyRound(currentRound)}</div>
              <div className="text-[10px] text-ink-3">{roundCount} jogos · {roundIdx + 1}/{rounds.length}</div>
            </div>
            <button
              onClick={() => setRoundIdx((i) => Math.min(rounds.length - 1, i + 1))}
              disabled={roundIdx >= rounds.length - 1}
              className="h-8 w-8 flex items-center justify-center rounded-rebrand-sm text-ink-2 hover:bg-canvas-2 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Próxima rodada"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Conteúdo */}
        {view === 'tabela' ? (
          <StandingsTable
            rows={standings}
            loading={loadingStandings}
            onTeam={(id) => navigate(`/futebol/time/${id}?c=${competition}&s=${season}`)}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-canvas-2 rounded-rebrand-md" />
            ))}
          </div>
        ) : isError ? (
          <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-status-danger">
            Erro ao carregar os jogos. Tente novamente.
          </div>
        ) : roundCount === 0 ? (
          <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-ink-3">
            Nenhum jogo nesta rodada.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([day, games]) => (
              <div key={day}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3 mb-1.5 px-1">
                  {fmtDayHeader(day)}
                </div>
                <div className="space-y-1.5">
                  {games.map((f) => (
                    <MatchRow key={f.fixture_id} fixture={f} onClick={() => navigate(`/futebol/jogo/${f.fixture_id}`)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
