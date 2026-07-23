import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Star, CheckCircle2, XCircle, PlayCircle, ArrowRight, Lightbulb, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FREE_PLAYERS } from "@/config/freemium";
import { getTeamLogoUrl, getPlayerPhotoUrl, teamAbbrToName } from "@/utils/team-logos";
import { Seo } from "@/components/Seo";
import { faqPageSchema, type FaqItem } from "@/lib/structured-data";

const getFreePlayerDashboardPath = () => {
  const name = FREE_PLAYERS[0];
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "-");
  return `/nba-dashboard/${slug}`;
};

// Espelha o StatTypeSelector rebrandado (PR #162): grupos BÁSICOS e COMBOS.
const STAT_BASIC = [
  { id: 'PTS', label: 'Pontos' },
  { id: 'AST', label: 'Assistências' },
  { id: 'REB', label: 'Rebotes' },
  { id: '3PT', label: '3 Pontos' },
  { id: 'STL', label: 'Roubos' },
  { id: 'BLK', label: 'Bloqueios' },
  { id: 'TO',  label: 'Turnovers' },
];
const STAT_COMBOS = [
  { id: 'P+A', label: 'Pts + Ast' },
  { id: 'P+R', label: 'Pts + Reb' },
  { id: 'PRA', label: 'PRA' },
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

  const statPill = (s: { id: string; label: string }) => {
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
        {s.label}
      </button>
    );
  };

  const FAQ: FaqItem[] = [
    {
      q: 'Vocês dão dica de aposta?',
      a: 'Quase. A gente mapeia e publica as principais oportunidades do dia com base no injury report — cada uma com o gatilho, o histórico e a linha do lado. O que a gente não faz é mandar "entrada garantida" sem o dado junto. Quem bate o martelo é sempre você.',
    },
    {
      q: 'É grátis pra testar?',
      a: `É, em dois níveis. Sem login: os dashboards do ${FREE_PLAYERS.join(' e do ')} ficam abertos. Com conta grátis: você vê as principais oportunidades de cada dia. O Premium libera a lista completa de oportunidades e o dashboard de todos os jogadores.`,
    },
    {
      q: 'De onde vêm os dados?',
      a: 'Estatísticas oficiais da NBA e a linha agregada das principais casas de aposta, atualizadas todos os dias de jogo.',
    },
    {
      q: 'Preciso entender de estatística?',
      a: 'Não. O dashboard mostra o que importa: quantas vezes o jogador passou da linha. Verde passou, vermelho não. Se quiser ir mais fundo, o dado completo tá lá.',
    },
    {
      q: 'Qual a taxa de acerto de vocês?',
      a: 'Não publicamos taxa de acerto — nem de marketing, nem nenhuma. O que você recebe é o dado por trás de cada insight antes de apostar: o gatilho, o histórico do jogador e a linha. Quem avalia se a janela vale é você, com o número na frente.',
    },
  ];

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Seo
        jsonLd={faqPageSchema(FAQ)}
        path="/nba"
        title="Análise de Prop Bets NBA com Dados em Tempo Real | Smart Betting"
        description="Compare a linha das casas com o histórico real do jogador: últimos jogos, injury report e Análise 360°. Dashboard aberto pra testar sem login."
      />
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-canvas/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center">
            {/* logo branca vira escura no canvas claro (mesmo filtro do Footer) */}
            <img src="/logo.png" alt="Smart Betting" className="h-9 invert hue-rotate-180" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(user ? "/onboarding" : "/auth")}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-semibold text-sm transition-colors"
            >
              {user ? "Acessar" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              Começar Grátis
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
            NBA · Prop Bets
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
            A casa demora pra ajustar a linha.<br />
            <span className="text-amber">Você chega antes.</span>
          </h1>
          <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
            Titular desfalcou? Os números de quem fica em quadra sobem na hora —
            a linha demora. Nossa metodologia varre o injury report e te mostra
            onde essa janela abriu, com o dado na frente. Testa num caso real:{" "}
            <span className="text-white font-semibold">clica no insight aí embaixo.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <PlayCircle className="h-5 w-5 shrink-0" />
              <span className="sm:hidden">Ver análise real grátis</span>
              <span className="hidden sm:inline">Abrir a análise de {firstFreePlayerName}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-white text-forest hover:bg-white/90 font-bold text-[15px] shadow-md transition-colors"
            >
              Criar conta grátis
            </button>
          </div>
          <p className="text-[12px] text-white/55 mt-4">
            Sem login e sem cartão pra testar · Sem promessas de ganho · A decisão é sempre sua
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
              dados de exemplo
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
                        <span className="text-forest font-semibold">Ativo</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-0.5">Pontos</div>
                      <div className="text-xl font-bold text-ink tabular-nums">27.5</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-0.5">Assistências</div>
                      <div className="text-xl font-bold text-ink tabular-nums">10.6</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-ink-3 mb-0.5">Rebotes</div>
                      <div className="text-xl font-bold text-ink tabular-nums">12.9</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-3 mt-3 pt-3 border-t border-line">
                    Idade 31 · Último jogo: ontem
                  </p>
                </div>

                {/* Insight de oportunidade — espelho do PropInsightsCard real */}
                <div className="rounded-rebrand-lg bg-white border border-line p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-2 shrink-0" />
                    <span className="text-[10px] font-bold text-amber-2 uppercase tracking-widest">Insight</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-status-danger/10 text-status-danger">
                      OUT
                    </span>
                  </div>
                  <p className="text-xs text-ink/80 mb-3 leading-relaxed">
                    Com <span className="font-bold text-status-danger">Murray</span> fora,
                    os <span className="font-bold text-forest">pontos</span> de Jokic
                    sobem <span className="font-bold text-forest">+{insightStats.pct}%</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleInsightClick}
                    className={`w-full text-left bg-canvas-2 rounded-rebrand-sm border p-3 transition-all cursor-pointer ${
                      triggerFilter ? 'border-forest/50 bg-forest/[0.06]' : 'border-amber/30 hover:border-amber/60 hover:bg-amber/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-ink uppercase">Pontos</span>
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
                      média normal → sem Murray
                    </div>
                  </button>
                  <p className="text-[9px] text-amber-2/70 mt-2 text-center">
                    {triggerFilter ? 'Filtro aplicado no gráfico ao lado' : 'Clique para filtrar o gráfico'}
                  </p>
                </div>

                <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
                  <div className="px-4 pt-3.5 pb-2.5 border-b border-line">
                    <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Companheiros</p>
                    <p className="text-[11px] text-ink-3 mt-0.5">Denver Nuggets</p>
                  </div>
                  {TEAMMATES.map((t) => (
                    <div key={t.name} className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-b-0">
                      <PlayerAvatar name={t.name} className="w-8 h-8 rounded-full" initialsClass="text-[10px]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink leading-tight truncate">{t.name}</p>
                        <p className="text-[11px] text-ink-3 flex items-center gap-1.5">
                          {t.pos}
                          {t.out && (
                            <span className="text-[9px] font-bold uppercase text-status-danger bg-status-danger/10 border border-status-danger/30 rounded px-1">
                              Out
                            </span>
                          )}
                        </p>
                      </div>
                      <StarRow n={t.stars} size="w-2.5 h-2.5" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna direita — Stats + Gráfico */}
              <div className="space-y-3 min-w-0">
                {/* Stat selector — BÁSICOS / COMBOS com pills */}
                <div className="rounded-rebrand-lg bg-white border border-line px-4 py-3">
                  <div className="flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3 shrink-0">Básicos</span>
                    <div className="flex gap-1.5">
                      {STAT_BASIC.map(statPill)}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3 shrink-0 pl-2 border-l border-line">Combos</span>
                    <div className="flex gap-1.5">
                      {STAT_COMBOS.map(statPill)}
                    </div>
                  </div>
                </div>

                {/* Gráfico de desempenho */}
                <div id="lp-grafico-desempenho" className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 pt-3.5 pb-3 border-b border-line">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Gráfico de desempenho</span>
                      <span className="text-[10px] tabular-nums text-ink-3">· últimos {windowed.total}</span>
                      {triggerFilter && (
                        <button
                          type="button"
                          onClick={() => setTriggerFilter(false)}
                          className="inline-flex items-center gap-1.5 h-6 px-2 rounded-rebrand-sm bg-forest text-white text-[10px] font-semibold hover:bg-forest-2 transition-colors"
                        >
                          Sem Murray em quadra
                          <X className="w-3 h-3 opacity-80" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[12px]">
                      <span className="text-ink-2">
                        Taxa de acerto{' '}
                        <span className={`font-semibold tabular-nums ${hitRateGood ? 'text-forest' : 'text-status-danger'}`}>
                          {windowed.hitRate}%
                        </span>{' '}
                        <span className="text-ink-3 tabular-nums">({windowed.over}/{windowed.total})</span>
                      </span>
                      <span className="text-ink-2">
                        Linha <span className="font-semibold text-ink tabular-nums">{statData.line}</span>
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
                        Últ. {w}
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
                      <span className="font-semibold text-ink-3">Últ. {windowed.total}</span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-forest" /> Over
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-status-danger" /> Under
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-px bg-ink" /> Linha
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span>Média <span className="font-semibold text-ink">{windowed.avg}</span></span>
                      <span>Média da Temporada <span className="font-semibold text-ink">{statData.seasonAvg}</span></span>
                    </div>
                  </div>
                </div>

                {/* Jogos Recentes */}
                <div className="rounded-rebrand-lg bg-white border border-line p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Jogos recentes</span>
                    <span className="text-[10px] text-ink-3">Nikola Jokic</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left">
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium">Data</th>
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium">Adv.</th>
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium hidden sm:table-cell">Local</th>
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">Valor</th>
                          <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">Linha</th>
                          <th className="pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentGames.rows.slice(0, 7).map((g, i) => (
                          <tr key={i} className="border-t border-line">
                            <td className="py-1.5 pr-3 text-ink-2 tabular-nums">{g.date}</td>
                            <td className="py-1.5 pr-3 font-semibold text-ink">{i % 2 === 0 ? '@' : ''}{g.opp}</td>
                            <td className="py-1.5 pr-3 text-ink-3 hidden sm:table-cell">{i % 2 === 0 ? 'Fora' : 'Casa'}</td>
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
            Abrir o dashboard de verdade
          </button>
          <p className="text-sm text-ink-3 mt-3">
            Sem login — dados ao vivo do {firstFreePlayerName}
          </p>
        </div>
      </section>

      {/* Faixa de fatos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14 sm:mt-20">
        <div className="border-y border-line py-4 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-2 sm:gap-x-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <span>12 mercados de props</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Últimos 5, 10 ou 15 jogos</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Injury report diário</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Linha agregada das casas</span>
        </div>
      </section>

      {/* O que tem dentro — lista editorial numerada */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-24">
        <div className="grid md:grid-cols-[minmax(220px,300px)_1fr] gap-10 md:gap-16">
          <div className="md:sticky md:top-24 self-start">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              O que tem dentro
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight mb-4">
              Tudo que você abriria em dez abas, numa só
            </h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Quem analisa prop bets na mão sabe o ritual: site de stats, site de odds,
              twitter de lesão, planilha. A plataforma junta as quatro pontas.
            </p>
          </div>

          <div>
            {[
              {
                num: '01',
                title: 'Oportunidades por desfalque',
                text: 'Saiu o injury report, a gente cruza quem tá fora com o histórico de quem fica em quadra. Onde a linha não acompanhou o desfalque, tem janela — ela chega pra você como o insight do exemplo lá em cima.',
              },
              {
                num: '02',
                title: 'Dashboard por jogador',
                text: '12 mercados de props — pontos, assistências, rebotes e combos — contra a linha, nos últimos 5, 10 ou 15 jogos, casa e fora.',
              },
              {
                num: '03',
                title: 'Injury report',
                text: 'Quem tá fora, quem é dúvida e o que isso muda na linha de quem fica. Antes de você apostar, não depois.',
              },
              {
                num: '04',
                title: 'Análise 360°',
                text: 'Escolhe o jogador e recebe a leitura completa do confronto numa tela só — desempenho, contexto e companheiros.',
              },
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
            Transparência
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-10 sm:mb-12 max-w-2xl">
            O combinado que a gente assina
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 pb-3 border-b border-white/15">
                O que você nunca vai ver aqui
              </h3>
              {[
                'Promessa de ganho garantido',
                'Palpite às cegas, sem o dado junto',
                'Taxa de acerto de marketing',
                'Depoimento inventado',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white/85">
                  <XCircle className="w-4 h-4 text-white/40 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber pb-3 border-b border-white/15">
                O que você sempre vai ter
              </h3>
              {[
                'O dado e a linha, lado a lado',
                'O porquê de cada insight — gatilho, números e contexto',
                'Linha agregada das principais casas',
                'A decisão sempre na sua mão',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white">
                  <CheckCircle2 className="w-4 h-4 text-amber shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 mt-10">
            — Smart Betting · combinado válido desde o primeiro dia
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
            Perguntas frequentes
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">Bora tirar dúvida</h2>
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
              Tira a prova agora.
            </h2>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-lg">
              O dashboard do {firstFreePlayerName} tá aberto, sem login.
              Se gostar do que ver, a conta grátis leva um minuto.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:min-w-[240px]">
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <PlayCircle className="h-5 w-5" />
              Ver a análise real
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-bold text-[15px] transition-colors"
            >
              Criar conta grátis
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
