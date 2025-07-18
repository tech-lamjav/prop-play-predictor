import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter, 
  BarChart3, 
  TrendingUp, 
  Target,
  AlertCircle,
  Calendar
} from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

// Mock data for the analysis page
const mockMetrics = {
  winRate: { value: 68.5, change: 2.3, period: "from last week" },
  roi: { value: 12.7, change: 1.5, period: "from last week" },
  avgEdge: { value: 4.2, change: 0.8, period: "from last week" },
  opportunities: { value: 27, change: 5, period: "from yesterday" }
};

const mockPropPerformance = [
  { type: "Points", percentage: 71.2, change: 4.8, positive: true },
  { type: "Rebounds", percentage: 65.9, change: 2.4, positive: true },
  { type: "Assists", percentage: 58.3, change: -1.7, positive: false }
];

const mockRecentPerformance = [
  { date: "Dec 5", player: "LeBron James", prop: "Points", line: 25.5, result: 28, outcome: "WIN" },
  { date: "Dec 5", player: "Stephen Curry", prop: "3PT Made", line: 4.5, result: 6, outcome: "WIN" },
  { date: "Dec 4", player: "Joel Embiid", prop: "Rebounds", line: 11.5, result: 9, outcome: "WIN" },
  { date: "Dec 4", player: "Luka Doncic", prop: "Assists", line: 8.5, result: 7, outcome: "LOSS" }
];

const mockInsights = [
  {
    title: "Points Overs Trending Up",
    description: "Points overs are hitting at a 68% rate over the last week, significantly above season average.",
    badge: "NEW",
    badgeColor: "bg-green-500"
  },
  {
    title: "Pace Factor Impact", 
    description: "Teams playing at top 5 pace are seeing assist props exceed lines by 12% on average.",
    badge: "CRITICAL",
    badgeColor: "bg-orange-500"
  },
  {
    title: "Back-to-Back Games",
    description: "Players on second night of back-to-backs are underperforming rebounding props by 8%.",
    badge: "TREND", 
    badgeColor: "bg-yellow-500"
  }
];

const mockInjuries = [
  { 
    name: "Anthony Davis", 
    team: "Los Angeles Lakers", 
    injury: "Ankle injury - Game time decision",
    status: "Questionable",
    statusColor: "bg-yellow-500"
  },
  {
    name: "Damian Lillard",
    team: "Milwaukee Bucks", 
    injury: "Calf strain - Expected to miss 1-2 weeks",
    status: "Out",
    statusColor: "bg-red-500"
  },
  {
    name: "Devin Booker",
    team: "Phoenix Suns",
    injury: "Back soreness - Expected to play", 
    status: "Probable",
    statusColor: "bg-green-500"
  }
];

const Analysis = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("insights");

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Navigation */}
            <div className="flex items-center space-x-8">
              <div className="text-green-400 text-xl font-bold">SMART BETTING</div>
              <nav className="flex space-x-6">
                <Button 
                  variant="ghost" 
                  className="text-slate-300 hover:text-white"
                  onClick={() => navigate("/dashboard")}
                >
                  Dashboard
                </Button>
                <Button variant="ghost" className="text-slate-300 hover:text-white">
                  Players
                </Button>
                <Button variant="ghost" className="text-slate-300 hover:text-white">
                  Games
                </Button>
                <Button variant="ghost" className="text-green-400 hover:text-green-300">
                  Analysis
                </Button>
              </nav>
            </div>

            {/* Search and Actions */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 w-64"
                />
              </div>
              <LanguageToggle />
              <Button className="bg-green-600 hover:bg-green-700">
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Analysis & Insights</h1>
          <Button variant="outline" className="border-slate-600 text-slate-300">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Sub Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger 
              value="insights" 
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
            >
              Insights
            </TabsTrigger>
            <TabsTrigger value="trends" className="text-slate-400">Trends</TabsTrigger>
            <TabsTrigger value="models" className="text-slate-400">Models</TabsTrigger>
            <TabsTrigger value="history" className="text-slate-400">History</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-8">
            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Win Rate</span>
                    <BarChart3 className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="text-2xl font-bold mb-1">{mockMetrics.winRate.value}%</div>
                  <div className="text-sm text-green-400">
                    +{mockMetrics.winRate.change}% {mockMetrics.winRate.period}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">ROI</span>
                    <Target className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="text-2xl font-bold mb-1">+{mockMetrics.roi.value}%</div>
                  <div className="text-sm text-green-400">
                    +{mockMetrics.roi.change}% {mockMetrics.roi.period}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Avg. Edge</span>
                    <TrendingUp className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="text-2xl font-bold mb-1">{mockMetrics.avgEdge.value}%</div>
                  <div className="text-sm text-green-400">
                    +{mockMetrics.avgEdge.change}% {mockMetrics.avgEdge.period}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Opportunities</span>
                    <BarChart3 className="h-4 w-4 text-green-400" />
                  </div>
                  <div className="text-2xl font-bold mb-1">{mockMetrics.opportunities.value}</div>
                  <div className="text-sm text-green-400">
                    +{mockMetrics.opportunities.change} {mockMetrics.opportunities.period}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - 2/3 width */}
              <div className="lg:col-span-2 space-y-8">
                {/* Performance by Prop Type */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Performance by Prop Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-center justify-center text-slate-400">
                      Chart visualization would appear here
                    </div>
                    
                    {/* Prop Performance Cards */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      {mockPropPerformance.map((prop, index) => (
                        <div key={index} className="bg-slate-700 p-4 rounded-lg">
                          <div className="text-sm text-slate-400 mb-1">{prop.type}</div>
                          <div className="text-xl font-bold text-white mb-1">{prop.percentage}%</div>
                          <div className={`text-sm ${prop.positive ? 'text-green-400' : 'text-red-400'}`}>
                            {prop.positive ? '+' : ''}{prop.change}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Performance Table */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Recent Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-3 text-slate-400">Date</th>
                            <th className="text-left py-3 text-slate-400">Player</th>
                            <th className="text-left py-3 text-slate-400">Prop</th>
                            <th className="text-left py-3 text-slate-400">Line</th>
                            <th className="text-left py-3 text-slate-400">Result</th>
                            <th className="text-left py-3 text-slate-400">Outcome</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockRecentPerformance.map((game, index) => (
                            <tr key={index} className="border-b border-slate-700/50">
                              <td className="py-3 text-slate-300">{game.date}</td>
                              <td className="py-3 text-white">{game.player}</td>
                              <td className="py-3 text-slate-300">{game.prop}</td>
                              <td className="py-3 text-slate-300">{game.line}</td>
                              <td className="py-3 text-white font-semibold">{game.result}</td>
                              <td className="py-3">
                                <Badge 
                                  className={game.outcome === 'WIN' 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-red-600 text-white'
                                  }
                                >
                                  {game.outcome}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button className="w-full mt-6 bg-green-600 hover:bg-green-700">
                      View All Results
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - 1/3 width */}
              <div className="space-y-8">
                {/* Today's Top Insights */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Today's Top Insights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {mockInsights.map((insight, index) => (
                      <div key={index} className="bg-slate-700 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white">{insight.title}</h4>
                          <Badge className={`${insight.badgeColor} text-white text-xs`}>
                            {insight.badge}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-300">{insight.description}</p>
                        <Button variant="link" className="text-green-400 p-0 h-auto mt-2">
                          Learn More →
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Key Injuries */}
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      Key Injuries
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {mockInjuries.map((injury, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-white">{injury.name}</div>
                            <div className="text-sm text-slate-400">{injury.team}</div>
                          </div>
                          <Badge className={`${injury.statusColor} text-white`}>
                            {injury.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-300">{injury.injury}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-green-400 font-bold mb-2">SMART BETTING</div>
              <div className="text-sm text-slate-400">Advanced player props analysis</div>
            </div>
            <div className="flex space-x-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white">About</a>
              <a href="#" className="hover:text-white">Terms</a>
              <a href="#" className="hover:text-white">Privacy</a>
              <a href="#" className="hover:text-white">Contact</a>
            </div>
          </div>
          <div className="text-center text-sm text-slate-500 mt-4">
            © 2023 Smart Betting. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Analysis;