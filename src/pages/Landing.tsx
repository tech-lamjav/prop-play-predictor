import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Clock, Shield, Target, Database, Zap, CheckCircle, PlayCircle, ArrowRight, Timer, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FREE_PLAYERS } from "@/config/freemium";

const getFreePlayerDashboardPath = () => {
  const name = FREE_PLAYERS[0];
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "-");
  return `/nba-dashboard/${slug}`;
};

const MOCK_STAT_LABELS = [
  { id: 'PTS', full: 'POINTS' },
  { id: 'AST', full: 'ASSISTS' },
  { id: 'REB', full: 'REBOUNDS' },
  { id: '3PT', full: '3-POINTERS' },
  { id: 'STL', full: 'STEALS' },
  { id: 'BLK', full: 'BLOCKS' },
  { id: 'TO',  full: 'TURNOVERS' },
  { id: 'P+A', full: 'POINTS + ASSISTS' },
  { id: 'P+R', full: 'POINTS + REBOUNDS' },
  { id: 'R+A', full: 'REBOUNDS + ASSISTS' },
  { id: 'PRA', full: 'PTS + REB + AST' },
  { id: 'DD',  full: 'DOUBLE-DOUBLE' },
];

type MockStatData = { values: number[]; line: number; avg: number; hitRate: string; over: number; total: number };

const MOCK_DATA: Record<string, MockStatData> = {
  PTS:  { values: [24,31,28,33,22,30,27,35,29,25,32,28,34,23,30], line: 27.5, avg: 29.1, hitRate: '67.0', over: 10, total: 15 },
  AST:  { values: [8,12,10,14,7,11,9,13,10,8,12,11,15,6,10],     line: 9.5,  avg: 10.2, hitRate: '60.0', over: 9,  total: 15 },
  REB:  { values: [11,14,13,15,9,12,10,16,13,11,14,12,15,10,13],  line: 11.5, avg: 12.8, hitRate: '73.3', over: 11, total: 15 },
  '3PT':{ values: [1,2,1,3,0,2,1,2,1,0,3,2,1,0,2],               line: 1.5,  avg: 1.4,  hitRate: '40.0', over: 6,  total: 15 },
  STL:  { values: [1,2,1,0,2,1,3,1,2,0,1,2,1,1,2],               line: 1.5,  avg: 1.3,  hitRate: '33.3', over: 5,  total: 15 },
  BLK:  { values: [1,0,1,2,0,1,1,0,2,1,0,1,0,1,1],               line: 0.5,  avg: 0.8,  hitRate: '53.3', over: 8,  total: 15 },
  TO:   { values: [3,4,2,5,3,2,4,3,2,4,3,5,2,3,4],               line: 3.5,  avg: 3.3,  hitRate: '33.3', over: 5,  total: 15 },
  'P+A':{ values: [32,43,38,47,29,41,36,48,39,33,44,39,49,29,40], line: 37.5, avg: 39.1, hitRate: '66.7', over: 10, total: 15 },
  'P+R':{ values: [35,45,41,48,31,42,37,51,42,36,46,40,49,33,43], line: 39.5, avg: 41.3, hitRate: '66.7', over: 10, total: 15 },
  'R+A':{ values: [19,26,23,29,16,23,19,29,23,19,26,23,30,16,23], line: 21.5, avg: 22.9, hitRate: '60.0', over: 9,  total: 15 },
  PRA:  { values: [43,57,51,62,38,53,46,64,52,44,58,51,64,39,53], line: 49.5, avg: 51.7, hitRate: '66.7', over: 10, total: 15 },
  DD:   { values: [1,1,1,1,0,1,1,1,1,1,1,1,1,0,1],               line: 0.5,  avg: 0.9,  hitRate: '86.7', over: 13, total: 15 },
};

const MOCK_GAMES = [
  { opp: 'LAL', date: '02/14' }, { opp: 'GSW', date: '02/12' }, { opp: 'BOS', date: '02/10' },
  { opp: 'MIA', date: '02/08' }, { opp: 'PHX', date: '02/06' }, { opp: 'DAL', date: '02/04' },
  { opp: 'NYK', date: '02/02' }, { opp: 'MIL', date: '01/31' }, { opp: 'CLE', date: '01/29' },
  { opp: 'OKC', date: '01/27' }, { opp: 'MIN', date: '01/25' }, { opp: 'PHI', date: '01/23' },
  { opp: 'SAC', date: '01/21' }, { opp: 'HOU', date: '01/19' }, { opp: 'LAC', date: '01/17' },
];

const Landing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dashboardPath = getFreePlayerDashboardPath();
  const firstFreePlayerName = FREE_PLAYERS[0];
  const [selectedStat, setSelectedStat] = useState('PTS');

  const statData = useMemo(() => MOCK_DATA[selectedStat] || MOCK_DATA.PTS, [selectedStat]);
  const maxVal = useMemo(() => Math.max(...statData.values) + 3, [statData]);
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-md flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground">Smartbetting</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageToggle />
            <Button 
              variant="outline" 
              onClick={() => navigate("/auth")}
              className="text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              Entrar
            </Button>
            <Button 
              onClick={() => navigate("/auth")} 
              className="bg-gradient-primary hover:opacity-90 text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              Começar Grátis
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          
          <div className="relative text-center">
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 max-w-5xl mx-auto leading-tight">
              Pare de <span className="bg-gradient-primary bg-clip-text text-[#5b9bd5]">apostar no escuro</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Análise de dados para suas apostas na NBA. 
              <span className="text-foreground font-semibold"> Baseado em evidências, não em palpites.</span>
            </p>

            {/* Social Proof */}
            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Sem promessas de ganho</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-success" />
                <span>Dados históricos transparentes</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-lg mx-auto">
              <Button size="lg" onClick={() => navigate(dashboardPath)} className="w-full sm:flex-1 hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-[#5b9bd5] hover:bg-[#4a8ac4]">
                <PlayCircle className="h-5 w-5" />
                Experimente agora — Veja a análise de {firstFreePlayerName}
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="w-full sm:flex-1 gap-2 text-lg py-6">
                Criar conta grátis
              </Button>
            </div>
          </div>
        </section>


        {/* Dashboard Preview Section */}
        <section className="py-20 px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              Veja como funciona na prática
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Dashboard completo com dados reais da NBA para suas análises de prop bets
            </p>
          </div>

          {/* Mock Dashboard Interface — mirrors real NBADashboard terminal style */}
          <div className="max-w-7xl mx-auto">
            <div className="bg-terminal-black rounded-sm p-4 md:p-6 shadow-2xl overflow-hidden border border-terminal-border-subtle">
              {/* Player Header */}
              <div className="terminal-container p-4 mb-3">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-sm bg-terminal-gray border-2 border-terminal-green flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-terminal-green">NJ</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-terminal-green mb-1">Nikola Jokic</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="opacity-70">Denver Nuggets</span>
                      <span className="opacity-50">•</span>
                      <span className="opacity-70">C</span>
                      <span className="opacity-50">•</span>
                      <span className="text-terminal-green">Active</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-terminal-border-subtle">
                      <div>
                        <div className="data-label mb-1">POINTS</div>
                        <div className="text-lg font-bold text-terminal-text">29.1</div>
                      </div>
                      <div>
                        <div className="data-label mb-1">ASSISTS</div>
                        <div className="text-lg font-bold text-terminal-text">10.2</div>
                      </div>
                      <div>
                        <div className="data-label mb-1">REBOUNDS</div>
                        <div className="text-lg font-bold text-terminal-text">12.8</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stat Type Selector — interactive */}
              <div className="terminal-container p-4 mb-3">
                <h3 className="section-title mb-3">SELECT STAT TYPE</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                  {MOCK_STAT_LABELS.map((s) => {
                    const active = selectedStat === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStat(s.id)}
                        className={`terminal-button p-2 text-center transition-all ${
                          active ? 'bg-terminal-blue text-terminal-black border-terminal-blue' : 'hover:border-terminal-blue/50'
                        }`}
                      >
                        <div className="text-xs font-bold">{s.id}</div>
                        {active && <div className="text-[8px] mt-0.5 opacity-80">ACTIVE</div>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-[10px] opacity-50">
                  VIEWING: {MOCK_STAT_LABELS.find(s => s.id === selectedStat)?.full}
                </div>
              </div>

              {/* Stats Header — reactive to selected stat */}
              <div className="terminal-container p-4 mb-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="data-label text-xs mb-1">GRAPH AVG</div>
                    <div className="text-3xl font-bold text-terminal-green">{statData.avg.toFixed(1)}</div>
                    <div className="text-xs opacity-50 mt-1">{MOCK_STAT_LABELS.find(s => s.id === selectedStat)?.full}</div>
                  </div>
                  <div className="text-center">
                    <div className="data-label text-xs mb-1">HIT RATE</div>
                    <div className="text-3xl font-bold text-terminal-green">{statData.hitRate}%</div>
                    <div className="text-xs opacity-50 mt-1">({statData.over}/{statData.total})</div>
                  </div>
                </div>
              </div>

              {/* Chart — reactive to selected stat */}
              <div className="terminal-container p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="section-title">Performance vs Linha</h3>
                  <div className="text-[10px] opacity-50">ÚLTIMOS {statData.total} JOGOS</div>
                </div>

                <div className="hidden sm:block">
                  <div className="h-56 p-4 pb-0 relative">
                    <div className="ml-6 h-[160px] flex items-end gap-1 relative">
                      <div className="absolute inset-x-0 border-t-2 border-dashed border-white/80 z-10" style={{ bottom: `${(statData.line / maxVal) * 100}%` }}></div>
                      <div className="absolute right-1 z-10 bg-terminal-dark-gray px-2 py-0.5 rounded-sm text-[10px] font-bold text-white border border-white/40" style={{ bottom: `${(statData.line / maxVal) * 100}%`, transform: 'translateY(50%)' }}>
                        Linha: {statData.line}
                      </div>
                      {statData.values.map((v, i) => {
                        const h = Math.max((v / maxVal) * 160, 4);
                        return (
                          <div key={i} className="flex-1 flex items-end justify-center px-[2px]">
                            <div
                              className={`w-full max-w-[14px] transition-all duration-300 ${v > statData.line ? 'bg-green-500' : 'bg-red-500'}`}
                              style={{ height: `${h}px`, minHeight: '4px', borderRadius: '1px 1px 0 0' }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="ml-6 flex gap-1 mt-1">
                      {MOCK_GAMES.map((g, i) => (
                        <div key={i} className="flex-1 text-center">
                          <div className="text-[9px] font-semibold text-terminal-green-bright leading-tight">{g.opp}</div>
                          <div className="text-[8px] opacity-40 leading-tight">{g.date}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                      <span className="opacity-70">Over ({statData.over})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                      <span className="opacity-70">Under ({statData.total - statData.over})</span>
                    </div>
                  </div>
                </div>

                <div className="block sm:hidden">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center bg-terminal-dark-gray p-3 rounded-sm border border-terminal-border-subtle">
                      <div className="text-xl font-bold text-green-400">{statData.over}</div>
                      <div className="text-[10px] opacity-60">OVER</div>
                    </div>
                    <div className="text-center bg-terminal-dark-gray p-3 rounded-sm border border-terminal-border-subtle">
                      <div className="text-xl font-bold text-terminal-red">{statData.total - statData.over}</div>
                      <div className="text-[10px] opacity-60">UNDER</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shooting Zones */}
              <div className="terminal-container p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="section-title">SHOOTING ZONES</h3>
                  <div className="text-[10px] opacity-50">Nikola Jokic</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { title: 'Restricted Area', fga: '8.2', fgm: '5.4', pct: '65.9%' },
                    { title: 'Paint (Non-RA)', fga: '3.1', fgm: '1.6', pct: '51.6%' },
                    { title: 'Mid Range', fga: '4.5', fgm: '2.3', pct: '51.1%' },
                    { title: 'Above the Break 3', fga: '2.8', fgm: '1.0', pct: '35.7%' },
                    { title: 'Corner 3', fga: '0.4', fgm: '0.2', pct: '50.0%' },
                    { title: 'Backcourt', fga: '0.1', fgm: '0.0', pct: '0.0%' },
                  ].map((z) => (
                    <div key={z.title} className="p-3 bg-terminal-dark-gray border border-terminal-border-subtle rounded-sm">
                      <div className="text-xs font-bold text-terminal-green mb-2">{z.title}</div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex flex-col">
                          <span className="opacity-60">FGA</span>
                          <span className="font-semibold">{z.fga}</span>
                        </div>
                        <div className="flex flex-col text-terminal-blue">
                          <span className="opacity-60">FGM</span>
                          <span className="font-semibold">{z.fgm}</span>
                        </div>
                        <div className="flex flex-col text-terminal-yellow">
                          <span className="opacity-60">FG%</span>
                          <span className="font-semibold">{z.pct}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Call to Action Below Dashboard */}
            <div className="text-center mt-12">
              <Button 
                size="lg" 
                onClick={() => navigate(dashboardPath)} 
                className="hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-[#5b9bd5] hover:bg-[#4a8ac4]"
              >
                <PlayCircle className="h-5 w-5" />
                Ver análise real agora
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Sem login — experimente o dashboard com dados reais
              </p>
            </div>
          </div>
        </section>

        {/* Problem Statement */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
              Você está perdendo tempo e dinheiro por falta de dados confiáveis
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 mt-12">
              <Card className="bg-destructive/5 border-destructive/20 p-6 rounded-sm">
                <CardContent className="space-y-4">
                  <div className="text-destructive font-semibold text-lg">Sem a Smartbetting</div>
                  <ul className="space-y-3 text-left text-muted-foreground">
                    <li>• Horas coletando stats manualmente</li>
                    <li>• Incerteza sobre quais dados analisar</li>
                    <li>• Dependência de dicas de terceiros</li>
                    <li>• Taxa de acerto estagnada</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-success/5 border-success/20 p-6 rounded-sm">
                <CardContent className="space-y-4">
                  <div className="text-success font-semibold text-lg">Com Smartbetting</div>
                  <ul className="space-y-3 text-left text-muted-foreground">
                    <li>• Análises prontas em segundos</li>
                    <li>• Dados relevantes pré-selecionados</li>
                    <li>• Decisões baseadas em evidências</li>
                    <li>• Potencial para melhorar sua taxa de acerto</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Como funciona nossa vantagem competitiva
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Modelo proprietário treinado com milhares de resultados históricos da NBA, focado especificamente em prop bets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300 rounded-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-sm flex items-center justify-center mb-4 mx-auto">
                  <Database className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">Dados Relevantes</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">Análise automática das odds disponíveis nas principais casas de apostas, de acordo com o Injury Report</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300 rounded-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-sm flex items-center justify-center mb-4 mx-auto">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">IA Especializada</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">Modelo proprietário focado em avaliar oportunidades baseado em informações e não opniões</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300 rounded-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-sm flex items-center justify-center mb-4 mx-auto">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">Transparência Total</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Histórico completo de análises anteriores. Você vê exatamente 
                  como nosso modelo performou no passado.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Value Props for Personas */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-md text-sm font-medium mb-6">
                <Target className="h-4 w-4" />
                Feito para você
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
                Perfeito para o seu <span className="text-[#5b9bd5]">perfil de apostador</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Não importa se você tem 10 minutos ou 10 horas por dia - nossa plataforma se adapta ao seu ritmo
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Busy Bettor Profile */}
              <Card className="group relative overflow-hidden bg-card border-border hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 rounded-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardContent className="relative p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-primary rounded-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Clock className="h-10 w-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                        <Zap className="text-white text-xs font-bold h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">Apostador Ocupado</h3>
                      <p className="text-primary font-medium">Eficiência em primeiro lugar</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Economize 2-3 horas/dia</p>
                        <p className="text-muted-foreground">Análises prontas em 30 segundos</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex -space-x-1">
                            <div className="w-3 h-3 bg-success rounded-full"></div>
                            <div className="w-3 h-3 bg-success/80 rounded-full"></div>
                            <div className="w-3 h-3 bg-success/60 rounded-full"></div>
                          </div>
                          <span className="text-xs text-success font-medium">Tempo poupado: 21h/semana</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Interface simples</p>
                        <p className="text-muted-foreground">Decisões rápidas sem complicação</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                        <Shield className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Dados confiáveis</p>
                        <p className="text-muted-foreground">Sem mais dúvidas sobre qual análise fazer</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-muted/50 rounded-md border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-foreground">Perfeito para você se:</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Tem pouco tempo para análises</li>
                      <li>• Quer resultados rápidos e precisos</li>
                      <li>• Prefere simplicidade à complexidade</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Professional Aspirant Profile */}
              <Card className="group relative overflow-hidden bg-card border-border hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 rounded-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardContent className="relative p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-primary rounded-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <TrendingUp className="h-10 w-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-success rounded-full flex items-center justify-center">
                        <Target className="text-white text-xs font-bold h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">Aspirante a Profissional</h3>
                      <p className="text-success font-medium">Crescimento e volume</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Database className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Volume de análises</p>
                        <p className="text-muted-foreground">Múltiplas oportunidades por dia</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-4 bg-success rounded-full"></div>
                            <div className="w-2 h-6 bg-success/80 rounded-full"></div>
                            <div className="w-2 h-5 bg-success/60 rounded-full"></div>
                            <div className="w-2 h-7 bg-success/40 rounded-full"></div>
                          </div>
                          <span className="text-xs text-success font-medium">15+ análises/dia</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                        <Target className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Independência</p>
                        <p className="text-muted-foreground">Pare de depender de tipsters</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Brain className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Edge competitivo</p>
                        <p className="text-muted-foreground">Dados que outros não têm acesso</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-muted/50 rounded-md border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-success" />
                      <span className="font-semibold text-foreground">Perfeito para você se:</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Quer escalar suas operações</li>
                      <li>• Busca independência de terceiros</li>
                      <li>• Tem tempo para múltiplas análises</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom CTA */}
            <div className="text-center mt-16 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                onClick={() => navigate(dashboardPath)} 
                className="hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-[#5b9bd5] hover:bg-[#4a8ac4] px-8 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <PlayCircle className="h-5 w-5" />
                Ver análise grátis agora
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="gap-2 text-lg py-6 px-8">
                Criar conta grátis
              </Button>
            </div>
          </div>
        </section>


        {/* Trust & Risk Mitigation */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-muted/30 rounded-md p-8 md:p-12">
              <div className="text-center space-y-6">
                <Shield className="h-16 w-16 text-primary mx-auto" />
                <h3 className="text-2xl md:text-3xl font-bold text-foreground">
                  Transparência é nossa prioridade
                </h3>
                <div className="grid md:grid-cols-2 gap-8 text-left">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground">❌ O que NÃO fazemos:</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Prometemos ganhos garantidos</li>
                      <li>• Indicamos apostas específicas</li>
                      <li>• Escondemos nossos resultados passados</li>
                      <li>• Usamos depoimentos falsos</li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground">✅ O que fazemos:</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Fornecemos análise de dados objetiva</li>
                      <li>• Comparamos odds disponíveis</li>
                      <li>• Mostramos histórico completo do modelo</li>
                      <li>• Educamos sobre análise de prop bets</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Pare de perder tempo com análises manuais
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Junte-se aos apostadores que já economizam horas por dia e tomam decisões baseadas em dados confiáveis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" onClick={() => navigate(dashboardPath)} className="hover:opacity-90 gap-2 text-lg px-8 py-6 bg-[#5b9bd5] hover:bg-[#4a8ac4]">
                <PlayCircle className="h-5 w-5" />
                Experimente a análise grátis
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/auth")} className="gap-2 text-lg px-8 py-6">
                Criar conta
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Landing;