import { useState, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Star, CheckCircle2, XCircle, PlayCircle, ArrowRight, Lightbulb, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FREE_PLAYERS } from "@/config/freemium";
import { getTeamLogoUrl, getPlayerPhotoUrl, teamAbbrToName } from "@/utils/team-logos";
import { Seo } from "@/components/Seo";
import { faqPageSchema, type FaqItem } from "@/lib/structured-data";
import { SeletorDeIdiomaCompacto } from '@/components/SeletorDeIdioma';

const getFreePlayerDashboardPath = () => {
  const name = FREE_PLAYERS[0];
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "-");
  return `/nba-dashboard/${slug}`;
};

// Espelha o StatTypeSelector rebrandado (PR #162): grupos BÁSICOS e COMBOS.
// `stat` é o identificador da API, que endereça o rótulo no catálogo.
const STAT_BASIC = [
  { id: 'PTS', stat: 'player_points' },
  { id: 'AST', stat: 'player_assists' },
  { id: 'REB', stat: 'player_rebounds' },
  { id: '3PT', stat: 'player_threes' },
  { id: 'STL', stat: 'player_steals' },
  { id: 'BLK', stat: 'player_blocks' },
  { id: 'TO',  stat: 'player_turnovers' },
];
const STAT_COMBOS = [
  { id: 'P+A', stat: 'player_points_assists' },
  { id: 'P+R', stat: 'player_points_rebounds' },
  { id: 'PRA', stat: 'player_points_rebounds_assists' },
];

type MockStatData = { values: number[]; line: number; seasonAvg: number };

const MOCK_DATA: Record<string, MockStatData> = {
  PTS:  { values: [24,31,28,33,22,30,27,35,29,25,32,28,34,23,30], line: 27.5, seasonAvg: 27.5 },
  AST:  { values: [8,12,10,14,7,11,9,13,10,8,12,11,15,6,10],     line: 9.5,  seasonAvg: 10.6 },
  REB:  { values: [11,14,13,15,9,12,10,16,13,11,14,12,15,10,13],  line: 11.5, seasonAvg: 12.9 },
  '3PT':{ values: [1,2,1,3,0,2,1,2,1,0,3,2,1,0,2],               line: 1.5,  seasonAvg: 1.4 },
  STL:  { values: [1,2,1,0,2,1,3,1,2,0,1,2,1,1,2],               line: 1.5,  seasonAvg: 1.3 },
  BLK:  { values: [1,0,1,2,0,1,1,0,2,1,0,1,0,1,1],               line: 0.5,  seasonAvg: 0.8 },
  TO:   { values: [3,4,2,5,3,2,4,3,2,4,3,5,2,3,4],               line: 3.5,  seasonAvg: 3.3 },
  'P+A':{ values: [32,43,38,47,29,41,36,48,39,33,44,39,49,29,40], line: 37.5, seasonAvg: 38.1 },
  'P+R':{ values: [35,45,41,48,31,42,37,51,42,36,46,40,49,33,43], line: 39.5, seasonAvg: 40.4 },
  PRA:  { values: [43,57,51,62,38,53,46,64,52,44,58,51,64,39,53], line: 49.5, seasonAvg: 51.0 },
};

// Datas em DD/MM, como o dashboard real exibe pro público brasileiro.
const MOCK_GAMES = [
  { opp: 'LAL', date: '14/02' }, { opp: 'GSW', date: '12/02' }, { opp: 'BOS', date: '10/02' },
  { opp: 'MIA', date: '08/02' }, { opp: 'PHX', date: '06/02' }, { opp: 'DAL', date: '04/02' },
  { opp: 'NYK', date: '02/02' }, { opp: 'MIL', date: '31/01' }, { opp: 'CLE', date: '29/01' },
  { opp: 'OKC', date: '27/01' }, { opp: 'MIN', date: '25/01' }, { opp: 'PHI', date: '23/01' },
  { opp: 'SAC', date: '21/01' }, { opp: 'HOU', date: '19/01' }, { opp: 'LAC', date: '17/01' },
];

const TEAMMATES = [
  { name: 'Jamal Murray', pos: 'G', stars: 3, out: false },
  { name: 'Peyton Watson', pos: 'G', stars: 3, out: true },
  { name: 'Tim Hardaway Jr.', pos: 'G', stars: 3, out: false },
  { name: 'Bruce Brown', pos: 'G', stars: 2, out: false },
];

const GAME_WINDOWS = [5, 10, 15] as const;

// Jogos (índices de MOCK_GAMES) em que o Murray ficou fora — base do filtro
// de gatilho que demonstra a metodologia (desfalque → números sobem).
const WITHOUT_MURRAY_IDX = [1, 2, 3, 5, 7, 10, 12, 13, 14];

function StarRow({ n, size = 'w-3 h-3' }: { n: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {[0, 1, 2].map((i) => (
        <Star key={i} className={`${size} ${i < n ? 'text-amber fill-current' : 'text-line-2 fill-current'}`} />
      ))}
    </span>
  );
}

function PlayerAvatar({ name, className, initialsClass }: { name: string; className: string; initialsClass: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className={`relative overflow-hidden shrink-0 bg-gradient-to-br from-canvas-2 to-line-2 grid place-items-center ${className}`}>
      <span className={`font-semibold text-ink-2 ${initialsClass}`}>{initials}</span>
      <img
        src={getPlayerPhotoUrl(name, 'Denver Nuggets')}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    </div>
  );
}

const Landing = () => {
  const { t } = useTranslation('nba');
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboardPath = getFreePlayerDashboardPath();
  const firstFreePlayerName = FREE_PLAYERS[0];
  const [selectedStat, setSelectedStat] = useState('PTS');
  const [gamesWindow, setGamesWindow] = useState<(typeof GAME_WINDOWS)[number]>(15);
  // Filtro de gatilho ("sem Murray em quadra") — ativado pelo card de insight,
  // como o onInsightClick do PropInsightsCard real.
  const [triggerFilter, setTriggerFilter] = useState(false);

  const statData = useMemo(() => MOCK_DATA[selectedStat] || MOCK_DATA.PTS, [selectedStat]);

  // Janela de jogos selecionada (Últ. 5 / 10 / 15), como no GameChart real.
  // Com o filtro de gatilho ativo, só entram os jogos sem o Murray — com os
  // números mais altos que sustentam o insight.
  const windowed = useMemo(() => {
    const boost = Math.max(1, Math.round(statData.line * 0.04));
    const baseValues = triggerFilter
      ? WITHOUT_MURRAY_IDX.map((i) => statData.values[i] + boost)
      : statData.values;
    const baseGames = triggerFilter
      ? WITHOUT_MURRAY_IDX.map((i) => MOCK_GAMES[i])
      : MOCK_GAMES;
    const values = baseValues.slice(0, gamesWindow);
    const games = baseGames.slice(0, gamesWindow);
    const over = values.filter((v) => v > statData.line).length;
    const hitRate = ((over / values.length) * 100).toFixed(1);
    const maxVal = Math.ceil((Math.max(...values) + 3) / 2) * 2;
    const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    return { values, games, over, total: values.length, hitRate, maxVal, avg };
  }, [statData, gamesWindow, triggerFilter]);

  // Tabela "Jogos Recentes" no formato do dashboard real (até 10 jogos).
  const recentGames = useMemo(() => {
    const rows = windowed.values.slice(0, 10).map((v, i) => ({
      ...windowed.games[i],
      value: v,
      diffPct: Math.round(((v - statData.line) / statData.line) * 100),
    }));
    const hits = rows.filter((r) => r.value > statData.line).length;
    return { rows, hitPct: Math.round((hits / rows.length) * 100) };
  }, [windowed, statData]);

  // Números do insight derivados dos mesmos dados do gráfico filtrado,
  // pra história fechar quando o visitante clicar.
  const insightStats = useMemo(() => {
    const pts = MOCK_DATA.PTS;
    const boost = Math.max(1, Math.round(pts.line * 0.04));
    const vals = WITHOUT_MURRAY_IDX.map((i) => pts.values[i] + boost);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const pct = Math.round(((avg - pts.seasonAvg) / pts.seasonAvg) * 100);
    return { avg: avg.toFixed(1), pct };
  }, []);

  const handleInsightClick = () => {
    setSelectedStat('PTS');
    setTriggerFilter(true);
    document.getElementById('lp-grafico-desempenho')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const hitRateGood = parseFloat(windowed.hitRate) >= 50;
  const linePct = (statData.line / windowed.maxVal) * 100;

  const statPill = (s: { id: string; stat: string }) => {
    const active = selectedStat === s.id;
    return (
      <button
        key={s.id}
        onClick={() => setSelectedStat(s.id)}
        className={`shrink-0 h-8 px-3.5 rounded-full border text-[12px] font-semibold whitespace-nowrap transition-colors ${
          active
            ? 'bg-forest text-white border-forest'
            : 'bg-white text-ink border-line hover:border-forest/30'
        }`}
      >
        {t(`estatisticas.nome.${s.stat}`)}
      </button>
    );
  };

  const FAQ: FaqItem[] = [
    { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { q: t('landing.faq.q2'), a: t('landing.faq.a2', { jogadores: FREE_PLAYERS.join(' e do ') }) },
    { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { q: t('landing.faq.q4'), a: t('landing.faq.a4') },
    { q: t('landing.faq.q5'), a: t('landing.faq.a5') },
  ];

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Seo route="/nba" jsonLd={faqPageSchema(FAQ)} />
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-canvas/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center">
            {/* logo branca vira escura no canvas claro (mesmo filtro do Footer) */}
            <img src="/logo.png" alt="Smart Betting" className="h-9 invert hue-rotate-180" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sem usuário não há menu da conta, e é lá que o idioma mora.
                Esta tela tem cabeçalho próprio, então precisa do seu. */}
            <SeletorDeIdiomaCompacto tom="claro" />
            <button
              type="button"
              onClick={() => navigate(user ? "/onboarding" : "/auth")}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-semibold text-sm transition-colors"
            >
              {user ? t('landing.nav.acessar') : t('landing.nav.entrar')}
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              {t('landing.nav.comecar')}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero — copy à esquerda, produto vaza a dobra logo abaixo */}
      <section className="relative bg-forest text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-forest via-forest-2 to-forest pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(212,160,23,0.16),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-40 sm:pb-56">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-5">
            {t('landing.hero.etiqueta')}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
            {t('landing.hero.titulo1')}<br />
            <span className="text-amber">{t('landing.hero.titulo2')}</span>
          </h1>
          <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
            <Trans
              t={t}
              i18nKey="landing.hero.texto"
              components={[<span className="text-white font-semibold" key="cta" />]}
            />
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <PlayCircle className="h-5 w-5 shrink-0" />
              <span className="sm:hidden">{t('landing.hero.verMobile')}</span>
              <span className="hidden sm:inline">{t('landing.hero.verDesktop', { jogador: firstFreePlayerName })}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-white text-forest hover:bg-white/90 font-bold text-[15px] shadow-md transition-colors"
            >
              {t('landing.hero.criarConta')}
            </button>
          </div>
          <p className="text-[12px] text-white/55 mt-4">
            {t('landing.hero.rodape')}
          </p>
        </div>
      </section>

      {/* Produto vazando a dobra — réplica do NBADashboard rebrandado (PR #162) */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 -mt-28 sm:-mt-40">
        <div className="rounded-rebrand-xl overflow-hidden shadow-2xl border border-line-2 bg-canvas">
          {/* Barra de janela */}
          <div className="flex items-center justify-between gap-3 bg-ink px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            </div>
            <span className="font-mono text-[10px] sm:text-[11px] text-white/50 truncate">
              smartbetting.app/nba-dashboard/nikola-jokic
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber bg-amber/15 border border-amber/40 rounded-full px-2 py-0.5 whitespace-nowrap">
              {t('landing.demo.selo')}
            </span>
          </div>

          <div className="p-3 sm:p-5">
            <div className="grid lg:grid-cols-[300px_1fr] gap-3">
              {/* Coluna esquerda — Player header + Companheiros */}
              <div className="space-y-3">
                <div className="rounded-rebrand-lg bg-white border border-line p-4">
                  <div className="flex items-start gap-3.5">
                    <PlayerAvatar name="Nikola Jokic" className="w-16 h-16 rounded-rebrand-lg" initialsClass="text-[20px]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-ink leading-tight">Nikola Jokic</h3>
                        <span className="inline-flex items-center gap-0.5 bg-amber/15 border border-amber/30 rounded-full px-2 py-1">
                          <StarRow n={3} />
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] text-ink-2 mt-1 flex-wrap">
                        <img src={getTeamLogoUrl('Denver Nuggets')} alt="Denver Nuggets" className="w-4 h-4 object-contain" loading="lazy" />
                        <span>Denver Nuggets</span>
                        <span className="text-ink-3">·</span>
                        <span>C</span>
                        <span className="text-ink-3">·</span>
                        <span className="text-forest font-semibold">{t('estado.longo.active')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-0.5">{t('estatisticas.nome.player_points')}</div>
                      <div className="text-xl font-bold text-ink tabular-nums">27.5</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-0.5">{t('estatisticas.nome.player_assists')}</div>
                      <div className="text-xl font-bold text-ink tabular-nums">10.6</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-0.5">{t('estatisticas.nome.player_rebounds')}</div>
                      <div className="text-xl font-bold text-ink tabular-nums">12.9</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-3 mt-3 pt-3 border-t border-line">
                    {t('landing.demo.idade')}
                  </p>
                </div>

                {/* Insight de oportunidade — espelho do PropInsightsCard real */}
                <div className="rounded-rebrand-lg bg-white border border-line p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-2 shrink-0" />
                    <span className="text-[10px] font-bold text-amber-2 uppercase tracking-widest">{t('landing.demo.insightEtiqueta')}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-status-danger/10 text-status-danger">
                      {t('estado.selo.out')}
                    </span>
                  </div>
                  <p className="text-xs text-ink/80 mb-3 leading-relaxed">
                    <Trans
                      t={t}
                      i18nKey="landing.demo.insightFrase"
                      values={{ pct: insightStats.pct }}
                      components={[
                        <span className="font-bold text-status-danger" key="gatilho" />,
                        <span className="font-bold text-forest" key="estatistica" />,
                        <span className="font-bold text-forest" key="pct" />,
                      ]}
                    />
                  </p>
                  <button
                    type="button"
                    onClick={handleInsightClick}
                    className={`w-full text-left bg-canvas-2 rounded-rebrand-sm border p-3 transition-all cursor-pointer ${
                      triggerFilter ? 'border-forest/50 bg-forest/[0.06]' : 'border-amber/30 hover:border-amber/60 hover:bg-amber/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-ink uppercase">{t('estatisticas.nome.player_points')}</span>
                      <div className="flex items-center gap-1.5">
                        <StarRow n={3} size="w-2.5 h-2.5" />
                        <ArrowRight className="w-3.5 h-3.5 text-amber-2" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink-3 tabular-nums">27.5</span>
                      <span className="text-xs text-ink-3">→</span>
                      <span className="text-lg font-bold text-forest leading-none tabular-nums">{insightStats.avg}</span>
                      <span className="text-[11px] font-semibold text-forest bg-forest/10 px-1.5 py-0.5 rounded tabular-nums">
                        +{insightStats.pct}%
                      </span>
                    </div>
                    <div className="text-[9px] text-ink-3 mt-1">
                      {t('landing.demo.mediaNormal')}
                    </div>
                  </button>
                  <p className="text-[9px] text-amber-2/70 mt-2 text-center">
                    {triggerFilter ? t('landing.demo.filtroAplicado') : t('landing.demo.cliqueFiltrar')}
                  </p>
                </div>

                <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
                  <div className="px-4 pt-3.5 pb-2.5 border-b border-line">
                    <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">{t('landing.demo.companheiros')}</p>
                    <p className="text-[11px] text-ink-3 mt-0.5">Denver Nuggets</p>
                  </div>
                  {TEAMMATES.map((companheiro) => (
                    <div key={companheiro.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-b-0">
                      <PlayerAvatar name={companheiro.name} className="w-8 h-8 rounded-full" initialsClass="text-[10px]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink leading-tight truncate">{companheiro.name}</p>
                        <p className="text-[11px] text-ink-3 flex items-center gap-1.5">
                          {companheiro.pos}
                          {companheiro.out && (
                            <span className="text-[9px] font-bold uppercase text-status-danger bg-status-danger/10 border border-status-danger/30 rounded px-1">
                              {t('estado.longo.out')}
                            </span>
                          )}
                        </p>
                      </div>
                      <StarRow n={companheiro.stars} size="w-2.5 h-2.5" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna direita — Stats + Gráfico */}
              <div className="space-y-3 min-w-0">
                {/* Stat selector — BÁSICOS / COMBOS com pills */}
                <div className="rounded-rebrand-lg bg-white border border-line px-4 py-3">
                  <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3 shrink-0">{t('landing.demo.basicos')}</span>
                    <div className="flex gap-1.5">
                      {STAT_BASIC.map(statPill)}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3 shrink-0 pl-2 border-l border-line">{t('landing.demo.combos')}</span>
                    <div className="flex gap-1.5">
                      {STAT_COMBOS.map(statPill)}
                    </div>
                  </div>
                </div>

                {/* Gráfico de desempenho */}
                <div id="lp-grafico-desempenho" className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 pt-3.5 pb-3 border-b border-line">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">{t('landing.demo.graficoTitulo')}</span>
                      <span className="text-[10px] tabular-nums text-ink-3">{t('landing.demo.ultimos', { n: windowed.total })}</span>
                      {triggerFilter && (
                        <button
                          type="button"
                          onClick={() => setTriggerFilter(false)}
                          className="inline-flex items-center gap-1.5 h-6 px-2 rounded-rebrand-sm bg-forest text-white text-[10px] font-semibold hover:bg-forest-2 transition-colors"
                        >
                          {t('landing.demo.semMurray')}
                          <X className="w-3 h-3 opacity-80" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[12px]">
                      <span className="text-ink-2">
                        {t('landing.demo.taxaAcerto')}{' '}
                        <span className={`font-semibold tabular-nums ${hitRateGood ? 'text-forest' : 'text-status-danger'}`}>
                          {windowed.hitRate}%
                        </span>{' '}
                        <span className="text-ink-3 tabular-nums">({windowed.over}/{windowed.total})</span>
                      </span>
                      <span className="text-ink-2">
                        {t('landing.demo.linha')} <span className="font-semibold text-ink tabular-nums">{statData.line}</span>
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-3 flex items-center gap-1.5">
                    {GAME_WINDOWS.map((w) => (
                      <button
                        key={w}
                        onClick={() => setGamesWindow(w)}
                        className={`shrink-0 h-8 px-3 text-[12px] font-semibold rounded-rebrand-sm whitespace-nowrap transition-colors border ${
                          gamesWindow === w
                            ? 'bg-forest text-white border-forest'
                            : 'bg-white text-ink border-line hover:border-forest/30'
                        }`}
                      >
                        {t('landing.demo.ultN', { n: w })}
                      </button>
                    ))}
                  </div>

                  <div className="px-4 pb-2">
                    <div className="flex gap-2">
                      {/* Eixo Y */}
                      <div className="relative w-7 h-[180px] shrink-0 text-right">
                        <span className="absolute -top-1.5 right-0 text-[10px] text-ink-3 tabular-nums">{windowed.maxVal}</span>
                        <span className="absolute right-0 text-[10px] text-ink-3 tabular-nums" style={{ top: 'calc(50% - 7px)' }}>{Math.round(windowed.maxVal / 2)}</span>
                        <span className="absolute -bottom-1.5 right-0 text-[10px] text-ink-3 tabular-nums">0</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="h-[180px] flex items-end gap-[3px] sm:gap-1 relative border-l border-b border-line">
                          {/* gridlines */}
                          <div className="absolute inset-x-0 top-0 border-t border-line/70" />
                          <div className="absolute inset-x-0 border-t border-line/70" style={{ top: '50%' }} />
                          {/* linha da casa — sólida, com chip do valor (como no real) */}
                          <div className="absolute inset-x-0 border-t-2 border-ink z-10" style={{ bottom: `${linePct}%` }} />
                          <div
                            className="absolute -right-1 z-10 bg-ink text-white px-1.5 py-0.5 rounded-sm text-[10px] font-bold tabular-nums shadow-sm"
                            style={{ bottom: `${linePct}%`, transform: 'translateY(50%)' }}
                          >
                            {statData.line}
                          </div>
                          {windowed.values.map((v, i) => {
                            const h = Math.max((v / windowed.maxVal) * 180, 14);
                            return (
                              <div key={i} className="flex-1 flex items-end justify-center min-w-0">
                                <div
                                  className={`w-full max-w-[30px] transition-all duration-300 rounded-t-[3px] relative ${v > statData.line ? 'bg-forest' : 'bg-status-danger'}`}
                                  style={{ height: `${h}px` }}
                                >
                                  <span className="absolute bottom-0.5 inset-x-0 text-center text-[8px] sm:text-[10px] font-bold text-white tabular-nums">
                                    {v}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Eixo X — logos dos adversários + data */}
                        <div className="flex gap-[3px] sm:gap-1 mt-1.5">
                          {windowed.games.map((g, i) => (
                            <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-0.5">
                              <img
                                src={getTeamLogoUrl(teamAbbrToName(g.opp))}
                                alt={g.opp}
                                className="w-4 h-4 object-contain"
                                loading="lazy"
                              />
                              <span className="hidden sm:block text-[8px] text-ink-3 tabular-nums leading-none">{g.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 border-t border-line text-[11px] text-ink-2">
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-ink-3">{t('landing.demo.ultN', { n: windowed.total })}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-forest" /> {t('landing.demo.acima')}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-status-danger" /> {t('landing.demo.abaixo')}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-px bg-ink" /> {t('landing.demo.linha')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span>{t('landing.demo.media')} <span className="font-semibold text-ink">{windowed.avg}</span></span>
                      <span>{t('landing.demo.mediaTemporada')} <span className="font-semibold text-ink">{statData.seasonAvg}</span></span>
                    </div>
                  </div>
                </div>

                {/* Jogos Recentes */}
                <div className="rounded-rebrand-lg bg-white border border-line p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">{t('landing.demo.jogosRecentes')}</span>
                    <span className="text-[10px] text-ink-3">Nikola Jokic</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left">
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium">{t('tabelaRecentes.data')}</th>
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium">{t('tabelaRecentes.adversario')}</th>
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium hidden sm:table-cell">{t('tabelaRecentes.local')}</th>
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">{t('tabelaRecentes.valor')}</th>
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">{t('tabelaRecentes.linha')}</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">{t('tabelaRecentes.resultado')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentGames.rows.slice(0, 7).map((g, i) => (
                          <tr key={i} className="border-t border-line">
                            <td className="py-1.5 pr-3 text-ink-2 tabular-nums">{g.date}</td>
                            <td className="py-1.5 pr-3 font-semibold text-ink">{i % 2 === 0 ? '@' : ''}{g.opp}</td>
                            <td className="py-1.5 pr-3 text-ink-3 hidden sm:table-cell">{i % 2 === 0 ? t('tabelaRecentes.fora') : t('tabelaRecentes.casa')}</td>
                            <td className="py-1.5 pr-3 text-right font-bold text-ink tabular-nums">{g.value.toFixed(1)}</td>
                            <td className="py-1.5 pr-3 text-right text-ink-2 tabular-nums">{statData.line}</td>
                            <td className={`py-1.5 text-right font-bold tabular-nums ${g.value > statData.line ? 'text-forest' : 'text-status-danger'}`}>
                              {g.diffPct > 0 ? '+' : ''}{g.diffPct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA abaixo do produto */}
        <div className="text-center mt-8 sm:mt-10">
          <button
            type="button"
            onClick={() => navigate(dashboardPath)}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
          >
            <PlayCircle className="h-5 w-5" />
            {t('landing.demo.abrirDashboard')}
          </button>
          <p className="text-sm text-ink-3 mt-3">
            {t('landing.demo.semLogin', { jogador: firstFreePlayerName })}
          </p>
        </div>
      </section>

      {/* Faixa de fatos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14 sm:mt-20">
        <div className="border-y border-line py-4 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-2 sm:gap-x-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <span>{t('landing.fatos.mercados')}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t('landing.fatos.janelas')}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t('landing.fatos.relatorio')}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t('landing.fatos.linha')}</span>
        </div>
      </section>

      {/* O que tem dentro — lista editorial numerada */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-24">
        <div className="grid md:grid-cols-[minmax(220px,300px)_1fr] gap-10 md:gap-16">
          <div className="md:sticky md:top-24 self-start">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              {t('landing.dentro.etiqueta')}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight mb-4">
              {t('landing.dentro.titulo')}
            </h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              {t('landing.dentro.texto')}
            </p>
          </div>

          <div>
            {[
              { num: '01', title: t('landing.dentro.item1Titulo'), text: t('landing.dentro.item1Texto') },
              { num: '02', title: t('landing.dentro.item2Titulo'), text: t('landing.dentro.item2Texto') },
              { num: '03', title: t('landing.dentro.item3Titulo'), text: t('landing.dentro.item3Texto') },
              { num: '04', title: t('landing.dentro.item4Titulo'), text: t('landing.dentro.item4Texto') },
            ].map((f) => (
              <div key={f.num} className="grid grid-cols-[56px_1fr] sm:grid-cols-[88px_1fr] gap-4 sm:gap-8 py-7 border-t border-line last:border-b">
                <span className="font-mono text-3xl sm:text-5xl font-black text-amber leading-none tabular-nums">{f.num}</span>
                <div>
                  <h3 className="text-lg font-bold text-ink mb-1.5">{f.title}</h3>
                  <p className="text-[14px] text-ink-2 leading-relaxed max-w-xl">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O combinado — faixa manifesto em verde-mata, de ponta a ponta */}
      <section className="bg-forest text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(212,160,23,0.10),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-3">
            {t('landing.combinado.etiqueta')}
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-10 sm:mb-12 max-w-2xl">
            {t('landing.combinado.titulo')}
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 pb-3 border-b border-white/15">
                {t('landing.combinado.nunca')}
              </h3>
              {[
                t('landing.combinado.nunca1'),
                t('landing.combinado.nunca2'),
                t('landing.combinado.nunca3'),
                t('landing.combinado.nunca4'),
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white/85">
                  <XCircle className="w-4 h-4 text-white/40 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber pb-3 border-b border-white/15">
                {t('landing.combinado.sempre')}
              </h3>
              {[
                t('landing.combinado.sempre1'),
                t('landing.combinado.sempre2'),
                t('landing.combinado.sempre3'),
                t('landing.combinado.sempre4'),
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white">
                  <CheckCircle2 className="w-4 h-4 text-amber shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 mt-10">
            {t('landing.combinado.assinatura')}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
            {t('landing.faq.etiqueta')}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">{t('landing.faq.titulo')}</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-rebrand-md border border-line bg-white px-5 py-4 cursor-pointer hover:border-line-2 transition-colors"
            >
              <summary className="flex items-center justify-between gap-3 list-none font-bold text-[14px] text-ink">
                {item.q}
                <ArrowRight className="w-4 h-4 text-ink-3 group-open:rotate-90 transition-transform shrink-0" />
              </summary>
              <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA — fechamento editorial */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="border-t border-line py-14 sm:py-20 grid md:grid-cols-[1fr_auto] gap-8 md:gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-ink leading-tight mb-3">
              {t('landing.final.titulo')}
            </h2>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-lg">
              {t('landing.final.texto', { jogador: firstFreePlayerName })}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:min-w-[240px]">
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <PlayCircle className="h-5 w-5" />
              {t('landing.final.verAnalise')}
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-bold text-[15px] transition-colors"
            >
              {t('landing.hero.criarConta')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
