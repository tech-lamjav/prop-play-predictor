import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, X } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolFixtures, useFutebolStandings, useFutebolLeaders, useFutebolValueBoard } from '@/hooks/use-futebol-data';
import type { Competition, FutebolFixture, FutebolStandingRow, FutebolLeaders, FutebolZone, FutebolValueBoardRow } from '@/services/futebol-data.service';
import { futebolZone, FUTEBOL_ZONE_COLOR as ZONE_COLOR, FUTEBOL_ZONE_LABEL as ZONE_LABEL } from '@/services/futebol-data.service';
import { getFutebolTeamLogoUrl, getFutebolPlayerPhotoUrl } from '@/utils/futebol-logos';
import { groupBoardByFixture, faixaWord, faixaBadgeCls } from '@/utils/futebol-score';

const COMPETITIONS: { value: Competition; label: string }[] = [
  { value: 'brasileirao', label: 'Brasileirão' },
  { value: 'serie_b', label: 'Série B' },
  { value: 'copa_mundo', label: 'Copa do Mundo' },
];
const SEASONS: Record<Competition, number[]> = { brasileirao: [2024, 2025, 2026], copa_mundo: [2026], serie_b: [2024, 2025, 2026] };
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
  return d ? new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, hour: '2-digit', minute: '2-digit' }).format(d) : '';
}
function fmtDayHeader(dateUtc: string | null): string {
  if (!dateUtc) return '—';
  const d = new Date(`${dateUtc}T12:00:00Z`);
  const s = new Intl.DateTimeFormat('pt-BR', { timeZone: SAO_PAULO_TZ, weekday: 'long', day: '2-digit', month: 'short' }).format(d).replace('.', '');
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
function Crest({ name, id, size = 24 }: { name: string; id: number; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(id);
  if (logo && !err) return <img src={logo} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain shrink-0" loading="lazy" />;
  return <div style={{ width: size, height: size }} className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[8px] font-bold text-ink-2 shrink-0">{crestInitials(name)}</div>;
}
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`h-8 px-3 rounded-rebrand-sm text-xs font-semibold transition-colors ${active ? 'bg-forest text-canvas' : 'bg-white text-ink border border-line hover:bg-canvas-2'}`}>
      {children}
    </button>
  );
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-rebrand-lg bg-canvas border border-line overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 flex items-center justify-between border-b border-line bg-white shrink-0">
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">{title}</div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-rebrand-sm text-ink-2 hover:bg-canvas-2" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto minimal-scrollbar p-4">{children}</div>
      </div>
    </div>
  );
}

const STAND_GRID = 'grid grid-cols-[28px_1fr_repeat(4,30px)_40px_44px] gap-2 items-center';

function StandingsTable({ rows, loading, onTeam }: { rows?: FutebolStandingRow[]; loading: boolean; onTeam: (id: number) => void }) {
  if (loading) return <div className="space-y-1">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-9 w-full bg-canvas-2 rounded-rebrand-sm" />)}</div>;
  if (!rows?.length) return <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-ink-3">Sem classificação pra esse filtro.</div>;
  const zonesPresent = Array.from(new Set(rows.map((r) => futebolZone(r.rank_description)).filter(Boolean))) as Exclude<FutebolZone, null>[];
  return (
    <div className="bg-white border border-line rounded-rebrand-md overflow-hidden">
      <div className={`${STAND_GRID} px-4 py-2.5 text-[10px] uppercase tracking-[0.12em] font-bold text-ink-3 bg-canvas-2 border-b border-line`}>
        <span>#</span><span>Time</span>
        <span className="text-center">J</span><span className="text-center">V</span><span className="text-center">E</span><span className="text-center">D</span>
        <span className="text-center">SG</span><span className="text-center">Pts</span>
      </div>
      {rows.map((r, i) => {
        const zone = futebolZone(r.rank_description);
        return (
          <button key={r.team_id} onClick={() => onTeam(r.team_id)}
            className={`${STAND_GRID} w-full px-4 py-2.5 hover:bg-canvas-2 transition ${i ? 'border-t border-line/60' : ''}`}>
            <span className="flex items-center gap-1.5">
              {zone && <span className="w-1 h-5 rounded-full shrink-0" style={{ background: ZONE_COLOR[zone] }} title={ZONE_LABEL[zone]} />}
              <span className="text-[12px] tabular-nums font-semibold text-ink-2">{r.rank}</span>
            </span>
            <span className="flex items-center gap-2 min-w-0">
              <Crest name={r.team_name} id={r.team_id} size={24} />
              <span className="truncate text-[12px] font-semibold tracking-tight text-ink text-left">{r.team_name}</span>
            </span>
            <span className="text-center text-[12px] tabular-nums text-ink-2">{r.played}</span>
            <span className="text-center text-[12px] tabular-nums text-ink-2">{r.wins}</span>
            <span className="text-center text-[12px] tabular-nums text-ink-2">{r.draws}</span>
            <span className="text-center text-[12px] tabular-nums text-ink-2">{r.loses}</span>
            <span className="text-center text-[12px] tabular-nums" style={{ color: r.goals_diff > 0 ? 'var(--forest)' : r.goals_diff < 0 ? '#be123c' : undefined }}>{r.goals_diff > 0 ? '+' : ''}{r.goals_diff}</span>
            <span className="text-center text-[14px] font-bold tabular-nums text-ink">{r.points}</span>
          </button>
        );
      })}
      {zonesPresent.length > 0 && (
        <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-[10px] bg-canvas-2 border-t border-line text-ink-3">
          {zonesPresent.map((z) => (
            <span key={z} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: ZONE_COLOR[z] }} />{ZONE_LABEL[z]}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerAvatar({ id, name, size = 28 }: { id: number; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const url = getFutebolPlayerPhotoUrl(id);
  if (url && !err) return <img src={url} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="rounded-full object-cover bg-canvas-2 shrink-0" loading="lazy" />;
  return <div style={{ width: size, height: size }} className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[9px] font-bold text-ink-2 shrink-0">{crestInitials(name)}</div>;
}

function ScorersCard({ leaders, loading, full }: { leaders?: FutebolLeaders; loading: boolean; full?: boolean }) {
  const scorers = full ? (leaders?.scorers || []) : (leaders?.scorers || []).slice(0, 8);
  return (
    <div className="bg-white border border-line rounded-rebrand-md overflow-hidden">
      {loading ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full bg-canvas-2 rounded" />)}</div>
        : scorers.length ? scorers.map((s, i) => (
          <div key={s.player_id} className={`px-4 py-2.5 flex items-center gap-3 ${i ? 'border-t border-line/60' : ''}`}>
            <span className="text-[12px] tabular-nums font-semibold text-ink-3 w-4">{i + 1}</span>
            <PlayerAvatar id={s.player_id} name={s.player_name} />
            <span className="text-[13px] font-semibold tracking-tight text-ink flex-1 min-w-0 truncate">{s.player_name}</span>
            <span className="text-[11px] text-ink-3 truncate max-w-[100px] text-right">{s.team_name}</span>
            <span className="text-[15px] font-semibold tabular-nums text-forest">{s.goals}</span>
            <span className="text-[10px] text-ink-3">gols</span>
          </div>
        )) : <div className="p-4 text-center text-sm text-ink-3">Sem dados.</div>}
    </div>
  );
}

function FixtureRow({ fixture, best, onClick }: { fixture: FutebolFixture; best: FutebolValueBoardRow | null; onClick: () => void }) {
  const finished = isFinished(fixture.status_short);
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3 flex items-center gap-3 border-t border-line/60 first:border-t-0 hover:bg-canvas-2 transition">
      <div className="w-12 shrink-0 text-center">
        {finished ? <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-ink-3">Fim</span>
          : <span className="text-[12px] font-semibold tabular-nums text-ink">{fmtTime(fixture.kickoff_utc) || '—'}</span>}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-[12px] font-semibold tracking-tight truncate text-ink">{fixture.home_team_name}</span>
        <Crest name={fixture.home_team_name} id={fixture.home_team_id} size={22} />
      </div>
      <div className="shrink-0 text-center" style={{ minWidth: 52 }}>
        {finished ? <span className="text-[15px] font-semibold tabular-nums tracking-tight text-ink">{fixture.goals_home ?? '-'} <span className="text-ink-3">×</span> {fixture.goals_away ?? '-'}</span>
          : <span className="text-[11px] text-ink-3">×</span>}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Crest name={fixture.away_team_name} id={fixture.away_team_id} size={22} />
        <span className="text-[12px] font-semibold tracking-tight truncate text-ink">{fixture.away_team_name}</span>
      </div>
      <div className="shrink-0 w-16 text-right">
        {!finished && (best
          ? <span className={`px-1.5 h-5 inline-flex items-center rounded text-[9px] font-bold uppercase tracking-[0.1em] ${faixaBadgeCls(best.faixa)}`}>{faixaWord(best.faixa)}</span>
          : <span className="text-[9px] text-ink-3">sem valor</span>)}
      </div>
    </button>
  );
}

export default function FutebolJogos() {
  const navigate = useNavigate();
  const [competition, setCompetition] = useState<Competition>('brasileirao');
  const [season, setSeason] = useState<number>(2026);
  const [roundIdx, setRoundIdx] = useState(0);
  const [modal, setModal] = useState<null | 'tabela' | 'artilheiros'>(null);

  const { data: fixtures, isLoading, isError } = useFutebolFixtures(competition, season);
  const { data: standings, isLoading: loadingStandings } = useFutebolStandings(competition, season, true);
  const { data: leaders, isLoading: loadingLeaders } = useFutebolLeaders(competition, season, true);
  const { data: board } = useFutebolValueBoard();

  const bestByFixture = useMemo(() => {
    const m = new Map<number, FutebolValueBoardRow>();
    groupBoardByFixture(board || []).forEach((bf) => m.set(bf.fixtureId, bf.best));
    return m;
  }, [board]);

  const rounds = useMemo(() => {
    const seen: string[] = [];
    (fixtures || []).forEach((f) => { if (f.round && !seen.includes(f.round)) seen.push(f.round); });
    return seen;
  }, [fixtures]);

  useEffect(() => {
    if (!fixtures?.length || !rounds.length) return;
    let bestRound = fixtures[0].round, bestDelta = Infinity;
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
  const groups = useMemo(() => {
    const list = (fixtures || []).filter((f) => f.round === currentRound);
    const byDay = new Map<string, FutebolFixture[]>();
    list.forEach((f) => { const k = f.date_utc || '—'; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k)!.push(f); });
    return Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [fixtures, currentRound]);
  const roundCount = groups.reduce((n, [, g]) => n + g.length, 0);

  // Mantém a temporada se a nova competição também a tiver; senão vai pra mais
  // recente (SEASONS é crescente — o índice 0 é a mais ANTIGA, ex.: 2024).
  const handleCompetition = (c: Competition) => {
    setCompetition(c);
    setSeason(SEASONS[c].includes(season) ? season : SEASONS[c][SEASONS[c].length - 1]);
  };
  const goTeam = (id: number) => navigate(`/futebol/time/${id}?c=${competition}&s=${season}`);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />

      {/* Header */}
      <div className="bg-white border-b border-line">
        <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-5 md:py-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink-3">{COMPETITIONS.find((c) => c.value === competition)?.label}</div>
            <h1 className="font-display text-2xl md:text-[28px] font-extrabold tracking-tight text-ink mt-1">{prettyRound(currentRound)}</h1>
            <p className="text-[13px] mt-1 text-ink-2">Rodadas, classificação e artilheiros · temporada {season}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {COMPETITIONS.map((c) => <Pill key={c.value} active={competition === c.value} onClick={() => handleCompetition(c.value)}>{c.label}</Pill>)}
            <span className="w-px h-5 bg-line mx-1" />
            {SEASONS[competition].map((s) => <Pill key={s} active={season === s} onClick={() => setSeason(s)}>{s}</Pill>)}
          </div>
        </div>
      </div>

      <div className="max-w-[1480px] w-full mx-auto px-4 md:px-6 py-6 flex-1">
        {/* Stepper de rodada */}
        {!isLoading && !isError && rounds.length > 0 && (
          <div className="flex items-center justify-between bg-white border border-line rounded-rebrand-md px-2 py-1.5 mb-4 max-w-sm">
            <button onClick={() => setRoundIdx((i) => Math.max(0, i - 1))} disabled={roundIdx <= 0} className="h-8 w-8 grid place-items-center rounded-rebrand-sm text-ink-2 hover:bg-canvas-2 disabled:opacity-30" aria-label="Rodada anterior"><ChevronLeft className="w-4 h-4" /></button>
            <div className="text-center">
              <div className="text-sm font-bold text-ink">{prettyRound(currentRound)}</div>
              <div className="text-[10px] text-ink-3">{roundCount} jogos · {roundIdx + 1}/{rounds.length}</div>
            </div>
            <button onClick={() => setRoundIdx((i) => Math.min(rounds.length - 1, i + 1))} disabled={roundIdx >= rounds.length - 1} className="h-8 w-8 grid place-items-center rounded-rebrand-sm text-ink-2 hover:bg-canvas-2 disabled:opacity-30" aria-label="Próxima rodada"><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}

        {isError ? (
          <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-status-danger">Erro ao carregar os jogos.</div>
        ) : (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
            {/* Jogos da rodada */}
            <div className="flex flex-col gap-4">
              {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full bg-canvas-2 rounded-rebrand-md" />)
                : roundCount === 0 ? <div className="bg-white border border-line rounded-rebrand-md p-6 text-center text-sm text-ink-3">Nenhum jogo nesta rodada.</div>
                : groups.map(([day, games]) => (
                  <div key={day} className="bg-white border border-line rounded-rebrand-md overflow-hidden">
                    <div className="px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] font-bold text-ink-2 bg-canvas-2 border-b border-line">{fmtDayHeader(day)}</div>
                    {games.map((f) => (
                      <FixtureRow key={f.fixture_id} fixture={f} best={bestByFixture.get(f.fixture_id) ?? null} onClick={() => navigate(`/futebol/jogo/${f.fixture_id}`)} />
                    ))}
                  </div>
                ))}
            </div>
            {/* Rail: classificação + artilheiros */}
            <div className="flex flex-col gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink-3">Classificação</div>
                  <button onClick={() => setModal('tabela')} className="text-[11px] font-semibold inline-flex items-center gap-1 text-forest hover:text-forest-2">Tabela completa <ArrowRight className="w-3 h-3" /></button>
                </div>
                <StandingsTable rows={standings?.slice(0, 9)} loading={loadingStandings} onTeam={goTeam} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink-3">Artilheiros</div>
                  {(leaders?.scorers?.length ?? 0) > 8 && <button onClick={() => setModal('artilheiros')} className="text-[11px] font-semibold inline-flex items-center gap-1 text-forest hover:text-forest-2">Ver todos <ArrowRight className="w-3 h-3" /></button>}
                </div>
                <ScorersCard leaders={leaders} loading={loadingLeaders} />
              </div>
            </div>
          </div>
        )}
      </div>

      {modal === 'tabela' && (
        <Modal title="Classificação completa" onClose={() => setModal(null)}>
          <StandingsTable rows={standings} loading={loadingStandings} onTeam={(id) => { setModal(null); goTeam(id); }} />
        </Modal>
      )}
      {modal === 'artilheiros' && (
        <Modal title="Artilheiros" onClose={() => setModal(null)}>
          <ScorersCard leaders={leaders} loading={loadingLeaders} full />
        </Modal>
      )}
    </div>
  );
}
