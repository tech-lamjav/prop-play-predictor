import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useFutebolTeamProfile, useFutebolTeamSeason, useFutebolStandings, useFutebolFixtures } from '@/hooks/use-futebol-data';
import { getFutebolTeamLogoUrl } from '@/utils/futebol-logos';
import { useCopyDoFutebol } from '@/hooks/use-copy-do-futebol';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboardingTour } from '@/components/onboarding/useOnboardingTour';
import { FUTEBOL_TIME_TOUR_ID, makeFutebolTimeSteps } from '@/components/onboarding/tours';
import { DemoRibbon, DemoBadge } from '@/components/onboarding/DemoRibbon';
import { demoTeamProfile, demoTeamSeason, demoFutebolStandings, demoTeamFixtures } from '@/components/onboarding/demo/futebol';
import type { Competition, FutebolScopeResult, FutebolScopeStats } from '@/services/futebol-data.service';

// Paleta do mockup (espelha theme-bolao)
const C = {
  forest: '#0a3d2e',
  ink: '#1a1d1a',
  ink2: '#4a4f48',
  ink3: '#8a8f86',
  line: '#e3e6e0',
  lineSoft: '#eef0ec',
  lineSoft2: '#f4f5f2',
  danger: '#b8341c',
  greenBg: '#dcefe2', greenFg: '#0a3d2e',
  dangerBg: '#fbeeec', dangerFg: '#b8341c',
};

const SCOPE_ORDER = ['geral', 'casa', 'fora'] as const;
const FINISHED = new Set(['FT', 'AET', 'PEN']);
const CARD = 'rounded-2xl overflow-hidden bg-white border border-line';

function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, '').trim().slice(0, 3).toUpperCase() || '?';
}

function Crest({ name, id, size = 28 }: { name: string; id: number | null | undefined; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = id ? getFutebolTeamLogoUrl(id) : null;
  if (logo && !err) {
    return <img src={logo} alt={name} onError={() => setErr(true)} style={{ width: size, height: size }} className="object-contain shrink-0" loading="lazy" />;
  }
  return (
    <div style={{ width: size, height: size, fontSize: size <= 24 ? 9 : size <= 40 ? 11 : 18 }}
      className="rounded-full bg-canvas-2 border border-line grid place-items-center font-bold text-ink-2 shrink-0">
      {crestInitials(name)}
    </div>
  );
}

// Forma do time (W/D/L da API) renderizada com a letra do idioma ativo.
//
// A CHAVE do rótulo, e não a letra: em espanhol a inicial pode não ser a mesma
// (#538). O lado esquerdo do mapa continua sendo o código da API, que é
// identificador — traduzir não pode mudar qual cor um resultado ganha.
function FormDots({ form, size = 16 }: { form: string; size?: number }) {
  const { t } = useTranslation('futebol');
  const map: Record<string, { chave: string; bg: string }> = {
    W: { chave: 'jogo.forma.vitoria', bg: C.forest },
    D: { chave: 'jogo.forma.empate', bg: C.ink3 },
    L: { chave: 'jogo.forma.derrota', bg: C.danger },
  };
  const last = form.slice(-5).split('');
  return (
    <span className="inline-flex items-center gap-1">
      {last.map((r, i) => {
        const m = map[r];
        const letra = m ? t(m.chave) : r;
        const bg = m ? m.bg : C.ink3;
        return (
          <span key={i} className="inline-flex items-center justify-center font-bold text-white"
            style={{ width: size, height: size, borderRadius: 4, fontSize: size <= 13 ? 8 : 9, background: bg }}>
            {letra}
          </span>
        );
      })}
    </span>
  );
}

function fmtAvg(v: number | null | undefined, pct = false): string {
  if (v == null) return '—';
  return `${v}${pct ? '%' : ''}`;
}

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '');
}

// Sequência corrente a partir do fim da string de forma (mais recente = último char)
function trailingStreak(form: string | null | undefined, keep: (c: string) => boolean): number {
  if (!form) return 0;
  let n = 0;
  for (let i = form.length - 1; i >= 0; i--) {
    if (keep(form[i])) n++; else break;
  }
  return n;
}

export default function FutebolTime() {
  const { t } = useTranslation('futebol');
  const copy = useCopyDoFutebol();
  const { teamId } = useParams<{ teamId: string }>();
  const [params] = useSearchParams();
  const competition = (params.get('c') as Competition) || 'brasileirao';
  const season = Number(params.get('s')) || 2026;
  const tid = teamId ? Number(teamId) : undefined;

  const { data: realProfile, isLoading, isError } = useFutebolTeamProfile(tid, competition, season);
  const { data: realRaiox } = useFutebolTeamSeason(tid, competition, season);
  const { data: realStandings } = useFutebolStandings(competition, season, !!tid);
  const { data: realFixtures } = useFutebolFixtures(competition, season);

  const timeTour = useOnboardingTour(FUTEBOL_TIME_TOUR_ID, { enabled: !isLoading });
  const isDemo = timeTour.run; // durante o tour, preenche a tela com exemplo
  const profile = isDemo ? demoTeamProfile : realProfile;
  const raiox = isDemo ? demoTeamSeason : realRaiox;
  const standings = isDemo ? demoFutebolStandings : realStandings;
  const fixtures = isDemo ? demoTeamFixtures : realFixtures;
  const tidEff = isDemo ? 121 : tid;

  const stand = useMemo(() => (standings || []).find((s) => s.team_id === tidEff), [standings, tidEff]);

  const results = useMemo(() =>
    (profile?.results || []).slice().sort((a, b) => SCOPE_ORDER.indexOf(a.scope as never) - SCOPE_ORDER.indexOf(b.scope as never)),
    [profile]);
  const stats = useMemo(() =>
    (profile?.stats_avg || []).slice().sort((a, b) => SCOPE_ORDER.indexOf(a.scope as never) - SCOPE_ORDER.indexOf(b.scope as never)),
    [profile]);

  const byScope = (scope: string) => ({
    r: results.find((x) => x.scope === scope) as FutebolScopeResult | undefined,
    s: stats.find((x) => x.scope === scope) as FutebolScopeStats | undefined,
  });
  const geral = byScope('geral');

  // Médias por mando. O `label` é CHAVE de catálogo, traduzida na hora de pintar.
  const medias = useMemo(() => {
    const row = (label: string, pick: (sc: string) => number | null | undefined, pct = false) => ({
      label, pct,
      geral: pick('geral'), casa: pick('casa'), fora: pick('fora'),
    });
    return [
      row('time.medias.golsMarcados', (sc) => sc === 'geral' ? raiox?.goals_for_avg_total : sc === 'casa' ? raiox?.goals_for_avg_home : raiox?.goals_for_avg_away),
      row('time.medias.golsSofridos', (sc) => sc === 'geral' ? raiox?.goals_against_avg_total : sc === 'casa' ? raiox?.goals_against_avg_home : raiox?.goals_against_avg_away),
      row('time.medias.posse', (sc) => byScope(sc).s?.avg_possession, true),
      row('time.medias.finalizacoes', (sc) => byScope(sc).s?.avg_shots),
      row('time.medias.escanteios', (sc) => byScope(sc).s?.avg_corners),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiox, results, stats]);

  // Eficiência gols × xG (totais)
  const efic = useMemo(() => {
    const games = geral.r?.games ?? raiox?.played_total ?? 0;
    const xgFor = geral.s?.avg_xg;
    const xgAga = geral.s?.avg_xg_against;
    if (!games || stand == null || xgFor == null || xgAga == null) return null;
    return {
      games,
      ataque: { real: stand.goals_for, esperado: +(xgFor * games).toFixed(1) },
      defesa: { real: stand.goals_against, esperado: +(xgAga * games).toFixed(1) },
    };
  }, [geral, raiox, stand]);

  // Últimos resultados (a partir dos jogos do time)
  const recent = useMemo(() => {
    if (!tidEff) return [];
    return (fixtures || [])
      .filter((f) => (f.home_team_id === tidEff || f.away_team_id === tidEff)
        && FINISHED.has(f.status_short || '') && f.goals_home != null && f.goals_away != null)
      .sort((a, b) => new Date(b.kickoff_utc || b.date_utc || 0).getTime() - new Date(a.kickoff_utc || a.date_utc || 0).getTime())
      .slice(0, 6)
      .map((f) => {
        const home = f.home_team_id === tidEff;
        const gf = (home ? f.goals_home : f.goals_away) as number;
        const ga = (home ? f.goals_away : f.goals_home) as number;
        return {
          oppId: home ? f.away_team_id : f.home_team_id,
          oppName: home ? f.away_team_name : f.home_team_name,
          // Mando e resultado como IDENTIFICADOR, não como rótulo: é por eles
          // que a cor é escolhida abaixo, e texto traduzido não pode decidir
          // cor nenhuma (#544). Quem traduz é a pintura.
          local: home,
          placar: `${gf} × ${ga}`,
          res: gf > ga ? 'V' : gf === ga ? 'E' : 'D',
          when: fmtDay(f.kickoff_utc || f.date_utc),
        };
      });
  }, [fixtures, tidEff]);

  const timeSteps = useMemo(() => makeFutebolTimeSteps({ hasRaiox: !!raiox }), [raiox]);

  return (
    <div className="theme-bolao min-h-screen bg-canvas flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />
      <OnboardingTour tourId={FUTEBOL_TIME_TOUR_ID} steps={timeSteps} run={timeTour.run} onFinish={timeTour.finish} />
      <div className="max-w-5xl w-full mx-auto px-4 md:px-6 py-6 flex-1">
        {isLoading ? (
          <div className="space-y-5">
            <Skeleton className="h-44 w-full bg-canvas-2 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Skeleton className="h-60 w-full bg-canvas-2 rounded-2xl" />
              <Skeleton className="h-60 w-full bg-canvas-2 rounded-2xl" />
            </div>
            <Skeleton className="h-40 w-full bg-canvas-2 rounded-2xl" />
          </div>
        ) : !profile?.team ? (
          <div className={`${CARD} p-6 text-center text-sm text-status-danger`}>{t('time.erro')}</div>
        ) : (
          <div className="flex flex-col gap-5">
            {isDemo && <DemoRibbon show />}
            {/* ── Header magazine ── */}
            <div data-tour="ftime-header" className={CARD}>
              <div className="px-5 md:px-8 py-5 md:py-6 flex items-center gap-4 md:gap-5" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                <Crest name={profile.team.team_name || ''} id={profile.team.team_id} size={64} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0"><h1 className="text-xl md:text-[28px] font-extrabold tracking-tight leading-tight text-ink truncate">{profile.team.team_name}</h1>{isDemo && <DemoBadge />}</div>
                  <p className="text-xs mt-1 text-ink-2">
                    {copy.competicao(competition)} · {season}
                    {stand?.rank ? (
                      <>
                        {' '}
                        · <span className="font-semibold text-ink">{t('time.colocado', { rank: stand.rank })}</span>
                      </>
                    ) : null}
                  </p>
                  {raiox?.form && <div className="mt-2"><FormDots form={raiox.form} /></div>}
                </div>
                {/* A primeira posição do par é a CHAVE do rótulo, não o rótulo:
                    o destaque verde é do primeiro item (pontos) e é decidido
                    pela chave, que não muda de idioma. */}
                <div className="hidden md:flex items-center gap-6 shrink-0">
                  {([['time.kpi.pontos', stand?.points], ['time.kpi.jogos', stand?.played ?? raiox?.played_total], ['time.kpi.saldo', stand ? (stand.goals_diff > 0 ? '+' : '') + stand.goals_diff : undefined]] as [string, number | string | null | undefined][]).map(([chave, v]) => (
                    <div key={chave} className="text-center">
                      <div className="text-[28px] font-extrabold tabular-nums tracking-tight leading-none" style={{ color: chave === 'time.kpi.pontos' ? C.forest : C.ink }}>{v ?? '—'}</div>
                      <div className="text-[10px] uppercase tracking-[0.14em] font-bold mt-1.5 text-ink-3">{t(chave)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4">
                {([['time.kpi.vitorias', raiox?.wins_total, C.forest], ['time.kpi.empates', raiox?.draws_total, C.ink2], ['time.kpi.derrotas', raiox?.loses_total, C.danger], ['time.kpi.gols', stand ? `${stand.goals_for}:${stand.goals_against}` : '—', C.ink]] as [string, number | string | null | undefined, string][]).map(([chave, v, color], i) => (
                  <div key={chave} className="px-2 md:px-6 py-3 md:py-4 text-center" style={{ borderLeft: i ? `1px solid ${C.lineSoft}` : 'none' }}>
                    <div className="text-lg md:text-[22px] font-extrabold tabular-nums tracking-tight leading-none" style={{ color }}>{v ?? '—'}</div>
                    <div className="text-[9px] uppercase tracking-[0.14em] font-bold mt-1.5 text-ink-3">{t(chave)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Médias por mando · Eficiência ── */}
            <div data-tour="ftime-medias" className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Médias */}
              <div className={CARD}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">{t('time.medias.titulo')}</div>
                  <div className="grid grid-cols-[44px_44px_44px] gap-2 text-right text-[10px] uppercase tracking-[0.12em] font-bold text-ink-3"><span>{t('time.medias.geral')}</span><span>{t('time.medias.casa')}</span><span>{t('time.medias.fora')}</span></div>
                </div>
                {medias.map((m, i) => (
                  <div key={m.label} className="px-5 py-2.5 grid grid-cols-[1fr_44px_44px_44px] gap-2 items-center" style={{ borderTop: i ? `1px solid ${C.lineSoft2}` : 'none' }}>
                    <span className="text-[12px] font-medium text-ink">{t(m.label)}</span>
                    <span className="text-right text-[13px] tabular-nums font-semibold text-ink">{fmtAvg(m.geral, m.pct)}</span>
                    <span className="text-right text-[13px] tabular-nums" style={{ color: C.forest }}>{fmtAvg(m.casa, m.pct)}</span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2">{fmtAvg(m.fora, m.pct)}</span>
                  </div>
                ))}
              </div>

              {/* Eficiência */}
              <div className={CARD}>
                <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">{t('time.eficiencia.titulo')}</div>
                    {efic && <span className="text-[10px] font-semibold text-ink-3 whitespace-nowrap">{t('time.eficiencia.totais', { count: efic.games })}</span>}
                  </div>
                  <div className="text-[10px] mt-0.5 text-ink-3 leading-snug">{t('time.eficiencia.explicacao')}</div>
                </div>
                {efic ? (
                  <div className="p-5 flex flex-col gap-5">
                    <EficBar label={t('time.eficiencia.ataque')} real={efic.ataque.real} esperado={efic.ataque.esperado} good />
                    <EficBar label={t('time.eficiencia.defesa')} real={efic.defesa.real} esperado={efic.defesa.esperado} good={false} />
                  </div>
                ) : (
                  <div className="p-5 text-sm text-ink-3">{t('time.eficiencia.semDados')}</div>
                )}
              </div>
            </div>

            {/* ── Raio-X da temporada ── */}
            {raiox && (
              <div data-tour="ftime-raiox" className={CARD}>
                <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">{t('time.raiox.titulo')}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-px" style={{ background: C.lineSoft }}>
                  {[
                    { l: 'time.raiox.semSofrerGol', v: raiox.clean_sheet_total ?? '—', s: 'time.raiox.semSofrerGolSub' },
                    { l: 'time.raiox.naoMarcou', v: raiox.failed_to_score_total ?? '—', s: 'time.raiox.naoMarcouSub' },
                    { l: 'time.raiox.invicto', v: trailingStreak(raiox.form, (c) => c !== 'L'), s: 'time.raiox.invictoSub' },
                    { l: 'time.raiox.sequenciaVitorias', v: trailingStreak(raiox.form, (c) => c === 'W'), s: 'time.raiox.sequenciaVitoriasSub' },
                    { l: 'time.raiox.over25', v: geral.r?.over25_pct != null ? `${geral.r.over25_pct}%` : '—', s: 'time.raiox.over25Sub' },
                    { l: 'time.raiox.ambosMarcam', v: geral.r?.btts_pct != null ? `${geral.r.btts_pct}%` : '—', s: 'time.raiox.ambosMarcamSub' },
                  ].map((tile) => (
                    <div key={tile.l} className="px-5 py-4 bg-white">
                      <div className="text-[24px] font-extrabold tabular-nums tracking-tight leading-none" style={{ color: C.forest }}>{tile.v}</div>
                      <div className="text-[11px] font-semibold mt-1.5 text-ink">{t(tile.l)}</div>
                      <div className="text-[10px] text-ink-3">{t(tile.s)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Últimos resultados ── */}
            <div data-tour="ftime-resultados" className={CARD}>
              <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">{t('time.resultados.titulo')}</div>
              </div>
              {recent.length ? recent.map((g, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-3" style={{ borderTop: i ? `1px solid ${C.lineSoft2}` : 'none' }}>
                  <span className="inline-flex w-6 h-6 rounded items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: g.res === 'V' ? C.forest : g.res === 'E' ? C.ink3 : C.danger }}>
                    {g.res === 'V' ? t('jogo.forma.vitoria') : g.res === 'E' ? t('jogo.forma.empate') : t('jogo.forma.derrota')}
                  </span>
                  <span className="text-[11px] tabular-nums w-12 shrink-0 text-ink-3">{g.local ? t('time.resultados.casa') : t('time.resultados.fora')}</span>
                  <Crest name={g.oppName} id={g.oppId} size={22} />
                  <span className="text-[12px] font-semibold tracking-tight flex-1 min-w-0 truncate text-ink">{g.oppName}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-ink">{g.placar}</span>
                  <span className="text-[10px] tabular-nums w-12 text-right text-ink-3">{g.when}</span>
                </div>
              )) : <div className="px-5 py-6 text-center text-sm text-ink-3">{t('time.resultados.vazio')}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Veredito mastigado da eficiência (relativo, escala com totais ou médias).
//
// Devolve CHAVE de catálogo e não frase: a tela pode estar em espanhol (#538).
function eficVerdict(good: boolean, real: number, esperado: number): string {
  const ratio = esperado > 0 ? (real - esperado) / esperado : 0;
  const emLinha = Math.abs(ratio) <= 0.1;
  if (good) {
    // Ataque: real = gols feitos
    if (emLinha) return 'time.eficiencia.ataqueEmLinha';
    return ratio > 0 ? 'time.eficiencia.ataqueAcima' : 'time.eficiencia.ataqueAbaixo';
  }
  // Defesa: real = gols sofridos
  if (emLinha) return 'time.eficiencia.defesaEmLinha';
  return ratio > 0 ? 'time.eficiencia.defesaAcima' : 'time.eficiencia.defesaAbaixo';
}

// Barra Real vs Esperado (gols × xG)
function EficBar({ label, real, esperado, good }: { label: string; real: number; esperado: number; good: boolean }) {
  const { t } = useTranslation('futebol');
  const delta = +(real - esperado).toFixed(1);
  const max = Math.max(real, esperado) * 1.15 || 1;
  const positive = good ? delta > 0 : delta < 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold tracking-tight text-ink">{label}</span>
        <span className="text-[11px] tabular-nums font-semibold px-1.5 h-5 inline-flex items-center rounded"
          style={{ background: positive ? C.greenBg : C.dangerBg, color: positive ? C.greenFg : C.dangerFg }}>
          {t('time.eficiencia.vsEsperado', { delta: `${delta > 0 ? '+' : ''}${delta}` })}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold w-[74px] shrink-0 text-ink-3">{t('time.eficiencia.real')}</span>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: C.lineSoft }}><div style={{ width: `${(real / max) * 100}%`, height: '100%', background: C.forest }} /></div>
          <span className="text-[12px] tabular-nums font-semibold w-8 text-right text-ink">{real}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold w-[74px] shrink-0 text-ink-3">{t('time.eficiencia.esperado')}</span>
          <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: C.lineSoft }}><div style={{ width: `${(esperado / max) * 100}%`, height: '100%', background: C.ink3 }} /></div>
          <span className="text-[12px] tabular-nums w-8 text-right text-ink-2">{esperado}</span>
        </div>
      </div>
      <p className="text-[11px] text-ink-2 mt-2 leading-snug">{t(eficVerdict(good, real, esperado))}</p>
    </div>
  );
}
