import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, MapPin } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFutebolFixtureDetail } from '@/hooks/use-futebol-data';
import type {
  FutebolEvent, FutebolFormResult, FutebolLineupPlayer, FutebolTeamStats,
} from '@/services/futebol-data.service';

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

function prettyRound(round: string | null): string {
  if (!round) return '';
  const m = round.match(/Regular Season\s*-\s*(\d+)/i);
  return m ? `Rodada ${m[1]}` : round;
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

function FormChips({ form }: { form: FutebolFormResult[] }) {
  if (!form?.length) return <span className="text-xs text-ink-3">Sem histórico</span>;
  const ordered = [...form].reverse(); // antigo → recente
  return (
    <div className="flex gap-1">
      {ordered.map((g) => (
        <span
          key={g.fixture_id}
          title={`${g.side === 'home' ? 'vs' : '@'} ${g.opponent} • ${g.goals_for}-${g.goals_against}`}
          className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${FORM_COLORS[g.result] || ''}`}
        >
          {g.result}
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

function StatRow({ label, home, away }: { label: string; home: number | null; away: number | null }) {
  const h = typeof home === 'number' ? home : null;
  const a = typeof away === 'number' ? away : null;
  const total = (h ?? 0) + (a ?? 0);
  const hPct = total > 0 ? ((h ?? 0) / total) * 100 : 50;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm tabular-nums mb-1">
        <span className="font-bold text-ink w-12">{h ?? '—'}</span>
        <span className="text-[11px] text-ink-3 uppercase tracking-wide">{label}</span>
        <span className="font-bold text-ink w-12 text-right">{a ?? '—'}</span>
      </div>
      <div className="flex h-1.5 rounded overflow-hidden bg-canvas-2">
        <div className="bg-forest" style={{ width: `${hPct}%` }} />
        <div className="bg-amber" style={{ width: `${100 - hPct}%` }} />
      </div>
    </div>
  );
}

function LineupColumn({ players, side }: { players: FutebolLineupPlayer[]; side: 'home' | 'away' }) {
  const list = players.filter((p) => p.team_side === side);
  const starters = list.filter((p) => p.is_starter);
  const bench = list.filter((p) => !p.is_starter);
  const Row = (p: FutebolLineupPlayer) => (
    <div key={`${p.player_id}-${p.player_slot}`} className="flex items-center gap-2 py-1 text-sm text-ink-2">
      <span className="w-6 text-[11px] text-ink-3 tabular-nums text-right">{p.shirt_number ?? '–'}</span>
      <span className="truncate text-ink">{p.player_name}</span>
      {p.position && <span className="ml-auto text-[10px] text-ink-3">{p.position}</span>}
    </div>
  );
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-1">Titulares</p>
      {starters.length ? starters.map(Row) : <p className="text-xs text-ink-3">—</p>}
      {bench.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wide text-ink-3 mt-3 mb-1">Banco</p>
          {bench.map(Row)}
        </>
      )}
    </div>
  );
}

const GOAL_SUFFIX: Record<string, string> = { Penalty: ' (pênalti)', 'Own Goal': ' (gol contra)' };

function eventMinute(e: FutebolEvent): string {
  if (e.minute == null) return '—';
  return e.minute_extra ? `${e.minute}+${e.minute_extra}'` : `${e.minute}'`;
}

function EventRow({ e }: { e: FutebolEvent }) {
  const sideColor = e.team_side === 'home' ? 'text-forest' : 'text-amber-2';
  const dot = e.team_side === 'home' ? 'bg-forest' : 'bg-amber';
  let indicator: ReactNode;
  let text: ReactNode;

  if (e.event_type === 'Goal') {
    indicator = <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />;
    text = (
      <span className="text-ink-2">
        <b className="text-ink">{e.player_name}</b> Gol{e.event_detail ? GOAL_SUFFIX[e.event_detail] || '' : ''}
        {e.assist_player_name && <span className="text-ink-3"> · assist. {e.assist_player_name}</span>}
      </span>
    );
  } else if (e.event_type === 'Card') {
    const red = (e.event_detail || '').toLowerCase().includes('red');
    indicator = <span className={`w-2 h-3 rounded-sm ${red ? 'bg-status-danger' : 'bg-amber'}`} />;
    text = <span className="text-ink-2">{e.player_name} · {red ? 'Vermelho' : 'Amarelo'}</span>;
  } else if (e.event_type === 'subst') {
    indicator = <span className="text-[8px] font-bold text-ink-3">SUB</span>;
    text = (
      <span className="text-ink-2">
        <span className="text-status-success">Entra {e.assist_player_name}</span>
        <span className="text-ink-3"> · Sai {e.player_name}</span>
      </span>
    );
  } else if (e.event_type === 'Var') {
    indicator = <span className="text-[8px] font-bold text-ink-3 border border-line rounded px-1 leading-tight">VAR</span>;
    text = <span className="text-ink-3">{e.event_detail}{e.player_name ? ` (${e.player_name})` : ''}</span>;
  } else {
    indicator = <span className={`w-2 h-2 rounded-full ${dot}`} />;
    text = <span className="text-ink-2">{e.event_type} {e.player_name}</span>;
  }

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={`w-9 shrink-0 text-xs tabular-nums text-right font-semibold ${sideColor}`}>{eventMinute(e)}</span>
      <span className="w-8 shrink-0 flex items-center justify-center">{indicator}</span>
      <span className="text-sm flex-1 min-w-0">{text}</span>
    </div>
  );
}

const CARD = 'bg-white border border-line rounded-rebrand-md';

export default function FutebolJogo() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useFutebolFixtureDetail(fixtureId ? Number(fixtureId) : undefined);

  const fixture = data?.fixture;
  const stats = data?.stats || [];
  const home = stats.find((s) => s.team_side === 'home');
  const away = stats.find((s) => s.team_side === 'away');
  const finished = fixture?.status_short === 'FT' || fixture?.status_short === 'AET' || fixture?.status_short === 'PEN';

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" />
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex-1">
        <button
          onClick={() => navigate('/futebol/jogos')}
          className="flex items-center gap-1 text-xs text-ink-2 hover:text-ink mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar pros jogos
        </button>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-10 w-full bg-canvas-2 rounded-rebrand-md" />
            <Skeleton className="h-64 w-full bg-canvas-2 rounded-rebrand-md" />
          </div>
        ) : isError || !fixture ? (
          <div className={`${CARD} p-6 text-center text-sm text-status-danger`}>
            Não foi possível carregar este jogo.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className={`${CARD} p-4`}>
              <div className="flex items-center justify-center gap-2 mb-3 text-[10px] uppercase tracking-wide text-ink-3">
                <span>{prettyRound(fixture.round)}</span>
                {fixture.venue_name && (
                  <><span>•</span><MapPin className="w-3 h-3" /><span>{fixture.venue_name}{fixture.venue_city ? `, ${fixture.venue_city}` : ''}</span></>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1 flex flex-col items-center gap-2">
                  <Crest name={fixture.home_team_name} logo={fixture.home_team_logo} />
                  <span className="text-sm text-ink font-medium text-center">{fixture.home_team_name}</span>
                </div>
                <div className="px-4 text-center">
                  {finished ? (
                    <div className="text-3xl font-extrabold text-ink tabular-nums">
                      {fixture.goals_home ?? '-'} <span className="text-ink-3">:</span> {fixture.goals_away ?? '-'}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-ink-2">{fmtDateTime(fixture.kickoff_utc)}</div>
                  )}
                  <div className="text-[10px] text-ink-3 mt-1">
                    {finished ? 'Encerrado' : (fixture.status_long || 'Agendado')}
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center gap-2">
                  <Crest name={fixture.away_team_name} logo={fixture.away_team_logo} />
                  <span className="text-sm text-ink font-medium text-center">{fixture.away_team_name}</span>
                </div>
              </div>
            </div>

            {/* Slot de Oportunidade (placeholder — depende do modelo) */}
            <div className="mt-3 flex items-start gap-2 rounded-rebrand-md border border-dashed border-line bg-canvas-2 p-3">
              <Info className="w-4 h-4 text-amber-2 mt-0.5 shrink-0" />
              <p className="text-xs text-ink-2">
                Sem oportunidade mapeada nos mercados monitorados — dados abaixo pra você tirar suas
                próprias conclusões. <span className="text-ink-3">(Análise de valor entra quando o modelo estiver pronto.)</span>
              </p>
            </div>

            {/* Estatística descritiva */}
            <div className="mt-4">
              <Tabs defaultValue="stats">
                <TabsList className="bg-canvas-2 border border-line">
                  <TabsTrigger value="stats" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Estatísticas</TabsTrigger>
                  <TabsTrigger value="lances" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Lances</TabsTrigger>
                  <TabsTrigger value="form" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Forma & H2H</TabsTrigger>
                  <TabsTrigger value="lineups" className="text-xs text-ink-2 data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm">Escalação</TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="mt-3">
                  <div className={`${CARD} p-4`}>
                    {home || away ? (
                      <>
                        <div className="flex items-center justify-between text-[11px] mb-2">
                          <span className="text-forest font-bold">{fixture.home_team_name}</span>
                          <span className="text-amber-2 font-bold">{fixture.away_team_name}</span>
                        </div>
                        {STAT_ROWS.map((r) => (
                          <StatRow
                            key={r.key}
                            label={r.label}
                            home={(home?.[r.key] as number | null) ?? null}
                            away={(away?.[r.key] as number | null) ?? null}
                          />
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-ink-3 text-center py-4">Estatísticas disponíveis após o jogo.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="lances" className="mt-3">
                  <div className={`${CARD} p-4`}>
                    {data!.events.length ? (
                      <div className="divide-y divide-line">
                        {data!.events.map((e, i) => <EventRow key={i} e={e} />)}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-3 text-center py-4">Lances disponíveis após o jogo.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="form" className="mt-3 space-y-3">
                  <div className={`${CARD} p-4 space-y-3`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink truncate">{fixture.home_team_name}</span>
                      <FormChips form={data!.form_home} />
                    </div>
                    <div className="h-px bg-line" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink truncate">{fixture.away_team_name}</span>
                      <FormChips form={data!.form_away} />
                    </div>
                  </div>

                  <div className={`${CARD} p-4`}>
                    <p className="text-[10px] uppercase tracking-wide text-ink-3 mb-2">Confrontos diretos</p>
                    {data!.h2h.length ? (
                      <div className="space-y-1">
                        {data!.h2h.map((h) => (
                          <div key={h.fixture_id} className="flex items-center justify-between text-sm text-ink">
                            <span className="text-[11px] text-ink-3 w-16">{fmtDate(h.date_utc)}</span>
                            <span className="flex-1 text-right truncate">{h.home_team_name}</span>
                            <span className="px-2 font-bold tabular-nums">{h.goals_home}-{h.goals_away}</span>
                            <span className="flex-1 truncate">{h.away_team_name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-ink-3">Sem confrontos diretos no histórico carregado.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="lineups" className="mt-3">
                  <div className={`${CARD} p-4`}>
                    {data!.lineup_players.length ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm font-semibold text-ink mb-2">
                            {fixture.home_team_name}
                            {data!.lineups.find((l) => l.team_side === 'home')?.formation && (
                              <span className="ml-2 text-[10px] text-amber-2 font-bold">
                                {data!.lineups.find((l) => l.team_side === 'home')?.formation}
                              </span>
                            )}
                          </p>
                          <LineupColumn players={data!.lineup_players} side="home" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink mb-2">
                            {fixture.away_team_name}
                            {data!.lineups.find((l) => l.team_side === 'away')?.formation && (
                              <span className="ml-2 text-[10px] text-amber-2 font-bold">
                                {data!.lineups.find((l) => l.team_side === 'away')?.formation}
                              </span>
                            )}
                          </p>
                          <LineupColumn players={data!.lineup_players} side="away" />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-3 text-center py-4">Escalação disponível próximo ao jogo.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
