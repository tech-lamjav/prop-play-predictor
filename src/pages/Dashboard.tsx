import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  Clock, 
  Calendar,
  Star,
  Zap,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

// Mock data for the dashboard
const mockPlayerData = {
  name: "Luka Dončić",
  team: "Dallas Mavericks",
  position: "PG/SG",
  image: "https://via.placeholder.com/80x80/1e40af/ffffff?text=LD",
  stats: {
    points: 28.4,
    assists: 8.7,
    rebounds: 8.1,
    efficiency: 0.58
  },
  status: "Active",
  lastGame: "2 days ago"
};

const mockRecentGames = [
  { game: "W7", points: 18, date: "2024-01-01", result: "L", bettingLine: 22.5, overLine: false },
  { game: "W10", points: 17, date: "2024-01-03", result: "L", bettingLine: 23.0, overLine: false },
  { game: "W12", points: 26, date: "2024-01-05", result: "W", bettingLine: 22.0, overLine: true },
  { game: "W14", points: 29, date: "2024-01-07", result: "W", bettingLine: 23.5, overLine: true },
  { game: "W16", points: 10, date: "2024-01-09", result: "L", bettingLine: 24.0, overLine: false },
  { game: "W20", points: 19, date: "2024-01-11", result: "L", bettingLine: 22.5, overLine: false },
  { game: "W26", points: 25, date: "2024-01-13", result: "W", bettingLine: 21.5, overLine: true },
  { game: "W27", points: 32, date: "2024-01-15", result: "W", bettingLine: 23.0, overLine: true },
  { game: "W30", points: 30, date: "2024-01-17", result: "W", bettingLine: 22.5, overLine: true },
  { game: "1/2", points: 18, date: "2024-01-19", result: "L", bettingLine: 23.0, overLine: false }
];

const mockUpcomingGames = [
  { opponent: "Miami Heat", date: "2024-01-18", time: "20:00", venue: "Home" },
  { opponent: "Orlando Magic", date: "2024-01-20", time: "19:30", venue: "Away" },
  { opponent: "Atlanta Hawks", date: "2024-01-22", time: "20:00", venue: "Home" }
];

const mockInjuryInsights = [
  { player: "Kyrie Irving", team: "DAL", injury: "Ankle", impact: "High", status: "Questionable" },
  { player: "Tim Hardaway Jr.", team: "DAL", injury: "Knee", impact: "Medium", status: "Probable" }
];

const mockBettingData = {
  average: "28.5",
  offeredLine: "27.5",
  delta: "1.0",
  l5Percentage: 80,
  l10Percentage: 75,
  l30Percentage: 70
};

// Team lineup data
const mockPlayerTeamLineup = [
  { name: "Luka Dončić", position: "PG", status: "Active", avgPoints: 28.4, avgAssists: 8.7 },
  { name: "Kyrie Irving", position: "SG", status: "Questionable", avgPoints: 22.1, avgAssists: 5.2 },
  { name: "Tim Hardaway Jr.", position: "SF", status: "Probable", avgPoints: 16.8, avgAssists: 2.1 },
  { name: "P.J. Washington", position: "PF", status: "Active", avgPoints: 12.3, avgRebounds: 6.8 },
  { name: "Daniel Gafford", position: "C", status: "Active", avgPoints: 10.9, avgRebounds: 8.2 }
];

const mockOpponentLineup = [
  { name: "Jimmy Butler", position: "SF", status: "Active", avgPoints: 21.4, avgAssists: 4.8 },
  { name: "Bam Adebayo", position: "C", status: "Active", avgPoints: 18.7, avgRebounds: 10.2 },
  { name: "Tyler Herro", position: "SG", status: "Active", avgPoints: 20.1, avgAssists: 4.2 },
  { name: "Duncan Robinson", position: "PF", status: "Active", avgPoints: 12.8, avgRebounds: 3.1 },
  { name: "Kyle Lowry", position: "PG", status: "Questionable", avgPoints: 8.9, avgAssists: 3.8 }
];

// Available statistics with their full names and descriptions
const availableStats = [
  { id: "pts", name: "PTS", fullName: "Pontos", description: "Total points scored" },
  { id: "ast", name: "AST", fullName: "Assistências", description: "Total assists" },
  { id: "reb", name: "REB", fullName: "Rebotes", description: "Total rebounds" },
  { id: "pra", name: "PRA", fullName: "Pts+Reb+Ast", description: "Points + Rebounds + Assists" },
  { id: "pa", name: "PA", fullName: "Pts+Ast", description: "Points + Assists" },
  { id: "pr", name: "PR", fullName: "Pts+Reb", description: "Points + Rebounds" },
  { id: "3pts", name: "3PTS", fullName: "3 Pontos", description: "Three-pointers made" },
  { id: "blk", name: "BLK", fullName: "Bloqueios", description: "Total blocks" },
  { id: "tov", name: "TOV", fullName: "Perdas", description: "Total turnovers" },
  { id: "f", name: "F", fullName: "Faltas", description: "Total fouls" },
  { id: "pota", name: "POTA", fullName: "Pts+Ast", description: "Points + Assists" },
  { id: "potr", name: "POTR", fullName: "Pts+Reb", description: "Points + Rebounds" }
];

// Mock data for selected stats
const mockStatsData = {
  pts: { "2024": 28.4, "2025": 29.1, "L5": 30.2, "L10": 29.8, "L15": 29.5, "L30": 28.9, "1Q": 7.2, "2Q": 6.8, "3Q": 7.5, "4Q": 6.9 },
  ast: { "2024": 8.7, "2025": 9.2, "L5": 9.8, "L10": 9.5, "L15": 9.1, "L30": 8.8, "1Q": 2.1, "2Q": 2.3, "3Q": 2.4, "4Q": 1.9 },
  reb: { "2024": 8.1, "2025": 8.5, "L5": 8.9, "L10": 8.7, "L15": 8.3, "L30": 8.0, "1Q": 2.0, "2Q": 2.1, "3Q": 2.2, "4Q": 1.8 },
  pra: { "2024": 45.2, "2025": 46.8, "L5": 48.9, "L10": 48.0, "L15": 46.9, "L30": 45.7, "1Q": 11.3, "2Q": 11.2, "3Q": 12.1, "4Q": 10.6 }
};

export default function Dashboard() {
  // State for selected statistics
  const [selectedStats, setSelectedStats] = useState<string[]>(["pts"]);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Toggle stat selection
  const toggleStat = (statId: string) => {
    setSelectedStats(prev => 
      prev.includes(statId) 
        ? prev.filter(id => id !== statId)
        : [...prev, statId]
    );
  };

  // Select all stats
  const selectAllStats = () => {
    setSelectedStats(availableStats.map(stat => stat.id));
  };

  // Clear all selections
  const clearAllStats = () => {
    setSelectedStats([]);
  };

  // Analyze selected stats
  const analyzeSelectedStats = () => {
    if (selectedStats.length > 0) {
      setShowAnalysis(true);
      // In a real app, this would trigger API calls for the selected stats
    }
  };

  // Get mock data for selected stats
  const getSelectedStatsData = () => {
    return selectedStats.map(statId => {
      const stat = availableStats.find(s => s.id === statId);
      const data = mockStatsData[statId as keyof typeof mockStatsData];
      return {
        stat: stat?.name || statId.toUpperCase(),
        fullName: stat?.fullName || "",
        data: data || { "2024": 0, "2025": 0, "L5": 0, "L10": 0, "L15": 0, "L30": 0, "1Q": 0, "2Q": 0, "3Q": 0, "4Q": 0 }
      };
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Prop Play Predictor</h1>
              <p className="text-slate-400 text-sm">Análise Inteligente de Prop Bets</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="bg-green-600 text-white">
              <CheckCircle className="w-3 h-3 mr-1" />
              Conectado
            </Badge>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Hoje
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar - Teams and Lineups */}
        <aside className="w-80 bg-slate-800 border-r border-slate-700 p-4">
          {/* Player's Team */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-white flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              {mockPlayerData.team}
            </h3>
            <div className="space-y-2">
              {mockPlayerTeamLineup.map((player, index) => (
                <div key={index} className="bg-slate-700 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white font-semibold text-sm">{player.name}</span>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        player.status === "Active" ? "bg-green-600" : 
                        player.status === "Questionable" ? "bg-yellow-600" : "bg-red-600"
                      }`}
                    >
                      {player.status}
                    </Badge>
                  </div>
                  <div className="text-slate-300 text-xs mb-2">{player.position}</div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>PTS: {player.avgPoints}</span>
                    {player.avgAssists && <span>AST: {player.avgAssists}</span>}
                    {player.avgRebounds && <span>REB: {player.avgRebounds}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Next Opponent */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-white flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              Próximo Oponente: Miami Heat
            </h3>
            <div className="space-y-2">
              {mockOpponentLineup.map((player, index) => (
                <div key={index} className="bg-slate-700 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white font-semibold text-sm">{player.name}</span>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        player.status === "Active" ? "bg-green-600" : 
                        player.status === "Questionable" ? "bg-yellow-600" : "bg-red-600"
                      }`}
                    >
                      {player.status}
                    </Badge>
                  </div>
                  <div className="text-slate-300 text-xs mb-2">{player.position}</div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>PTS: {player.avgPoints}</span>
                    {player.avgAssists && <span>AST: {player.avgAssists}</span>}
                    {player.avgRebounds && <span>REB: {player.avgRebounds}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-slate-700 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Estatísticas Rápidas</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-300">Próximo jogo:</span>
                <span className="text-white">18 Jan, 20:00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Local:</span>
                <span className="text-white">🏠 Home</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Último confronto:</span>
                <span className="text-green-400">W 112-98</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Player Profile Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="bg-slate-800 border-slate-700 lg:col-span-2">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <img 
                    src={mockPlayerData.image} 
                    alt={mockPlayerData.name}
                    className="w-20 h-20 rounded-full border-2 border-blue-500"
                  />
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white">{mockPlayerData.name}</h2>
                    <p className="text-slate-300">{mockPlayerData.team} • {mockPlayerData.position}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <Badge variant="secondary" className="bg-green-600 text-white">
                        {mockPlayerData.status}
                      </Badge>
                      <span className="text-slate-400 text-sm">Último jogo: {mockPlayerData.lastGame}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-400">{mockPlayerData.stats.points}</div>
                    <div className="text-slate-400">PPG</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Estatísticas Rápidas</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Assistências:</span>
                    <span className="text-white font-semibold">{mockPlayerData.stats.assists}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Rebotes:</span>
                    <span className="text-white font-semibold">{mockPlayerData.stats.rebounds}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Eficiência:</span>
                    <span className="text-white font-semibold">{mockPlayerData.stats.efficiency}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistics Filter Selection */}
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-lg">Selecionar Estatísticas</CardTitle>
              <p className="text-slate-300 text-xs">
                {selectedStats.length > 0 
                  ? `${selectedStats.length} estatística(s) selecionada(s)` 
                  : "Escolha as estatísticas para análise"
                }
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                {availableStats.map((stat) => {
                  const isSelected = selectedStats.includes(stat.id);
                  return (
                    <div
                      key={stat.id}
                      onClick={() => toggleStat(stat.id)}
                      className={`bg-slate-700 rounded-md p-2 border-2 cursor-pointer hover:bg-slate-600 transition-colors ${
                        isSelected 
                          ? 'border-green-500 bg-green-500/20' 
                          : 'border-slate-600'
                      }`}
                      title={`${stat.fullName}: ${stat.description}`}
                    >
                      <div className="text-center">
                        <div className={`text-sm font-bold ${
                          isSelected ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {stat.name}
                        </div>
                        <div className={`text-xs ${
                          isSelected ? 'text-green-400' : 'text-slate-400'
                        }`}>
                          {isSelected ? 'Ativo' : 'Inativo'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-green-400 border-green-400 hover:bg-green-400 hover:text-slate-900 text-xs"
                  onClick={selectAllStats}
                >
                  Selecionar Todos
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-slate-400 border-slate-400 hover:bg-slate-400 hover:text-slate-900 text-xs"
                  onClick={clearAllStats}
                >
                  Limpar
                </Button>
                <Button 
                  size="sm" 
                  className={`text-xs ${
                    selectedStats.length > 0 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-slate-600 cursor-not-allowed'
                  }`}
                  onClick={analyzeSelectedStats}
                  disabled={selectedStats.length === 0}
                >
                  Analisar ({selectedStats.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Analysis Results - Only show when stats are selected and analyzed */}
          {showAnalysis && selectedStats.length > 0 && (
            <Card className="bg-slate-800 border-slate-700 mb-6">
              <CardHeader>
                <CardTitle className="text-white">Análise das Estatísticas Selecionadas</CardTitle>
                <p className="text-slate-300 text-sm">
                  Resultados para: {selectedStats.map(id => availableStats.find(s => s.id === id)?.name).join(", ")}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getSelectedStatsData().map((statData) => (
                    <div key={statData.stat} className="bg-slate-700 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-white mb-2">{statData.stat}</h4>
                      <p className="text-slate-300 text-sm mb-3">{statData.fullName}</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">L5:</span>
                          <span className="text-white">{statData.data["L5"]}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">L10:</span>
                          <span className="text-white">{statData.data["L10"]}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-400">L30:</span>
                          <span className="text-white">{statData.data["L30"]}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Resumo da Análise</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Média (com base no filtro):</span>
                    <span className="text-white font-semibold">{mockBettingData.average}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Linha ofertada:</span>
                    <span className="text-white font-semibold">{mockBettingData.offeredLine}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Delta:</span>
                    <span className="text-green-400 font-semibold">+{mockBettingData.delta}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Percentuais</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-300">L5:</span>
                    <span className="text-green-400 font-semibold">{mockBettingData.l5Percentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">L10:</span>
                    <span className="text-green-400 font-semibold">{mockBettingData.l10Percentage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">L30:</span>
                    <span className="text-green-400 font-semibold">{mockBettingData.l30Percentage}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart */}
            <div className="lg:col-span-2">
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Performance vs Linha de Aposta</CardTitle>
                  <p className="text-slate-300 text-sm">
                    Comparação entre performance real e linha oferecida pelo bookmaker
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mockRecentGames}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis dataKey="game" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" domain={[0, 35]} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #475569',
                            borderRadius: '8px'
                          }}
                          formatter={(value, name, props) => [
                            `${value} pontos`,
                            `Linha: ${props.payload.bettingLine}`
                          ]}
                          labelFormatter={(label) => `Jogo ${label}`}
                        />
                        {/* Reference line for betting line */}
                        <ReferenceLine 
                          y={22.5} 
                          stroke="#ffffff" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                          label={{ 
                            value: "Linha: 22.5", 
                            position: "insideTopRight",
                            fill: "#ffffff",
                            fontSize: 12
                          }}
                        />
                        <Bar dataKey="points">
                          {mockRecentGames.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`}
                              fill={entry.overLine ? "#10b981" : "#ef4444"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Chart Legend */}
                  <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-slate-300">Acima da Linha</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-slate-300">Abaixo da Linha</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border border-white border-dashed rounded"></div>
                      <span className="text-slate-300">Linha do Bookmaker</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Efficiency Chart */}
            <div>
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Eficiência por Quarto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "1Q", value: 7.2, fill: "#3b82f6" },
                            { name: "2Q", value: 6.8, fill: "#10b981" },
                            { name: "3Q", value: 7.5, fill: "#f59e0b" },
                            { name: "4Q", value: 6.9, fill: "#ef4444" }
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          dataKey="value"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #475569',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-80 bg-slate-800 border-l border-slate-700 p-4">
          {/* Upcoming Games */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">PRÓXIMOS JOGOS</h3>
            <div className="space-y-3">
              {mockUpcomingGames.map((game, index) => (
                <div key={index} className="bg-slate-700 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold">{game.opponent}</span>
                    <Badge variant="secondary" className="text-xs">
                      {game.venue === "Home" ? "🏠" : "✈️"}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm text-slate-300">
                    <span>{game.date}</span>
                    <span>{game.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Injury + Impact */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">INJURY + IMPACTO</h3>
            <div className="space-y-3">
              {mockInjuryInsights.map((injury, index) => (
                <div key={index} className="bg-slate-700 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-semibold">{injury.player}</span>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        injury.impact === "High" ? "bg-red-600" : "bg-yellow-600"
                      }`}
                    >
                      {injury.impact}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-300 mb-1">{injury.team}</div>
                  <div className="text-sm text-slate-400">{injury.injury}</div>
                  <div className="flex items-center mt-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 mr-1" />
                    <span className="text-xs text-yellow-400">{injury.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}