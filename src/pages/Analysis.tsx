import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, TrendingDown, Target, Star, Info, BarChart3 } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

// Mock data matching the wireframe
const mockPlayerData = {
  id: "1",
  name: "Pascal Siakam",
  team: "Raptors",
  position: "PF",
  jersey: 43,
  avatar: "/placeholder.svg"
};

const mockPropData = {
  consensusLine: 19.5,
  projection: 19.2,
  coverProbability: 53.3,
  expectedValue: 2.1,
  betRating: "B+",
  seasonRecord: { over: 52, under: 49 },
  recentPerformance: [
    { date: "5/11/25", opponent: "CLE", points: 22, over: true },
    { date: "5/13/25", opponent: "@CLE", points: 21, over: true },
    { date: "5/21/25", opponent: "@NYK", points: 18, over: false },
    { date: "5/23/25", opponent: "@NYK", points: 39, over: true },
    { date: "5/25/25", opponent: "NYK", points: 17, over: false },
    { date: "5/27/25", opponent: "NYK", points: 30, over: true },
    { date: "5/29/25", opponent: "@NYK", points: 15, over: false },
    { date: "5/31/25", opponent: "NYK", points: 31, over: true },
    { date: "6/5/25", opponent: "@OKC", points: 19, over: false },
    { date: "6/8/25", opponent: "@OKC", points: 16, over: false },
    { date: "6/11/25", opponent: "OKC", points: 20, over: true },
    { date: "6/13/25", opponent: "OKC", points: 19, over: false },
    { date: "6/16/25", opponent: "@OKC", points: 27, over: true },
    { date: "6/19/25", opponent: "OKC", points: 16, over: false },
    { date: "6/22/25", opponent: "@OKC", points: 16, over: false }
  ]
};

const Analysis = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState("L15");

  const maxValue = Math.max(...mockPropData.recentPerformance.map(game => game.points));
  const lineValue = mockPropData.consensusLine;

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-2 text-gray-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{mockPlayerData.name} Points Prop</h1>
              <p className="text-gray-500">{mockPlayerData.team} • {mockPlayerData.position}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>

        {/* Prop Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-gray-500 mb-1">CONSENSUS LINE</div>
              <div className="text-2xl font-bold text-gray-900">{mockPropData.consensusLine} points</div>
              <div className="text-sm text-gray-500">(O/U)</div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-gray-500 mb-1 flex items-center justify-center gap-1">
                PROJECTION <Info className="h-3 w-3" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{mockPropData.projection} points</div>
              <div className="text-sm text-gray-500">(under)</div>
              <div className="mt-1">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">🔒</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-gray-500 mb-1 flex items-center justify-center gap-1">
                COVER PROBABILITY <Info className="h-3 w-3" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{mockPropData.coverProbability}%</div>
              <div className="mt-1">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">🔒</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-gray-500 mb-1 flex items-center justify-center gap-1">
                EXPECTED VALUE <Info className="h-3 w-3" />
              </div>
              <div className="text-2xl font-bold text-gray-900">+{mockPropData.expectedValue}%</div>
              <div className="mt-1">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">🔒</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-200">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-gray-500 mb-1 flex items-center justify-center gap-1">
                BET RATING <Info className="h-3 w-3" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{mockPropData.betRating}</div>
              <div className="text-sm text-gray-500">SEASON PROP RECORD</div>
              <div className="text-sm font-medium text-gray-900">
                {mockPropData.seasonRecord.over}-{mockPropData.seasonRecord.under} (Over - Under)
              </div>
              <div className="mt-1">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">🔒</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-3">
            <Card className="bg-white border border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                      Prop Analysis <Info className="h-4 w-4 text-gray-400" />
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      The Over hit 8/15 in the last 15 games at a line of 19.5
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {["L5", "L10", "L15", "H2H", "2024", "2023"].map((timeframe) => (
                      <Button
                        key={timeframe}
                        variant={selectedTimeframe === timeframe ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTimeframe(timeframe)}
                        className={selectedTimeframe === timeframe ? "bg-gray-900 text-white" : "text-gray-600"}
                      >
                        {timeframe}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Chart */}
                <div className="h-64 mb-6">
                  <div className="flex items-end justify-center h-full gap-1 px-4">
                    {mockPropData.recentPerformance.map((game, index) => (
                      <div key={index} className="flex flex-col items-center flex-1 max-w-[40px]">
                        <div
                          className={`w-full rounded-t ${
                            game.over ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{
                            height: `${(game.points / maxValue) * 200}px`,
                            minHeight: '20px'
                          }}
                        />
                        <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-center whitespace-nowrap">
                          {game.opponent}
                        </div>
                        <div className="text-xs text-gray-500">
                          {game.date.split('/').slice(0, 2).join('/')}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Consensus Line */}
                  <div className="relative mt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Consensus Line: <span className="font-semibold">{lineValue}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Over Win %: <span className="font-semibold">8/15 (53.3%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 h-1 rounded mt-2">
                      <div className="bg-gray-800 h-1 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-white border border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center justify-between">
                  Filters
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    ⬆ Upgrade
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <span className="text-sm font-medium text-gray-700">Location</span>
                    <span className="text-gray-400">›</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <span className="text-sm font-medium text-gray-700">Team Odds</span>
                    <span className="text-gray-400">›</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <span className="text-sm font-medium text-gray-700">Blowouts</span>
                    <span className="text-gray-400">›</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <span className="text-sm font-medium text-gray-700">Minutes Played</span>
                    <span className="text-gray-400">›</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <span className="text-sm font-medium text-gray-700">Without Players</span>
                    <span className="text-gray-400">›</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <span className="text-sm font-medium text-gray-700">With Players</span>
                    <span className="text-gray-400">›</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;