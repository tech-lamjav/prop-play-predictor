import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, Target, Star } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

// Mock data for the analysis page
const mockPlayerData = {
  id: "1",
  name: "LeBron James",
  team: "Lakers",
  position: "SF",
  jersey: 23,
  avatar: "/placeholder.svg"
};

const mockSeasonStats = {
  gamesPlayed: 58,
  points: 25.2,
  rebounds: 7.1,
  assists: 7.9,
  steals: 1.3,
  blocks: 0.5
};

const mockBettingLines = [
  { type: "Points", line: 24.5, overOdds: -110, underOdds: -110, hitRate: 65 },
  { type: "Rebounds", line: 7.5, overOdds: -115, underOdds: -105, hitRate: 58 },
  { type: "Assists", line: 7.5, overOdds: -105, underOdds: -115, hitRate: 72 },
];

const mockRecentGames = [
  { date: "2024-01-15", opponent: "Warriors", home: true, points: 28, rebounds: 8, assists: 9, result: "W" },
  { date: "2024-01-12", opponent: "Celtics", home: false, points: 22, rebounds: 6, assists: 11, result: "L" },
  { date: "2024-01-10", opponent: "Nuggets", home: true, points: 31, rebounds: 9, assists: 7, result: "W" },
  { date: "2024-01-08", opponent: "Suns", home: false, points: 19, rebounds: 5, assists: 8, result: "L" },
  { date: "2024-01-05", opponent: "Mavs", home: true, points: 27, rebounds: 7, assists: 6, result: "W" },
];

const Analysis = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isWatchlisted, setIsWatchlisted] = useState(false);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-foreground">{t("analysis.title")}</h1>
          </div>
          <LanguageToggle />
        </div>

        {/* Player Header */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">LJ</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{mockPlayerData.name}</h2>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{mockPlayerData.team}</span>
                    <span>#{mockPlayerData.jersey}</span>
                    <span>{mockPlayerData.position}</span>
                  </div>
                </div>
              </div>
              <Button
                variant={isWatchlisted ? "default" : "outline"}
                onClick={() => setIsWatchlisted(!isWatchlisted)}
                className="gap-2"
              >
                <Star className={`h-4 w-4 ${isWatchlisted ? "fill-current" : ""}`} />
                {isWatchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="overview">{t("analysis.overview")}</TabsTrigger>
            <TabsTrigger value="trends">{t("analysis.trends")}</TabsTrigger>
            <TabsTrigger value="betting">{t("analysis.betting_lines")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Season Stats */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">{t("analysis.season_stats")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("dashboard.points")}</span>
                    <span className="font-semibold text-foreground">{mockSeasonStats.points}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("dashboard.rebounds")}</span>
                    <span className="font-semibold text-foreground">{mockSeasonStats.rebounds}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("dashboard.assists")}</span>
                    <span className="font-semibold text-foreground">{mockSeasonStats.assists}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Steals</span>
                    <span className="font-semibold text-foreground">{mockSeasonStats.steals}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Blocks</span>
                    <span className="font-semibold text-foreground">{mockSeasonStats.blocks}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Betting Performance */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Betting Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mockBettingLines.map((line) => (
                    <div key={line.type} className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">{line.type}</span>
                        <span className="font-semibold text-foreground">{line.line} {t("analysis.vs_line")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={line.hitRate >= 60 ? "default" : "secondary"}
                          className="gap-1"
                        >
                          {line.hitRate >= 60 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {line.hitRate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Games Played</span>
                    <span className="font-semibold text-foreground">{mockSeasonStats.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("analysis.avg_performance")}</span>
                    <Badge variant="default" className="gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Above Average
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Home vs Away</span>
                    <span className="font-semibold text-foreground">60% / 40%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">{t("analysis.recent_games")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockRecentGames.map((game, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant={game.result === "W" ? "default" : "destructive"}>
                          {game.result}
                        </Badge>
                        <div>
                          <span className="font-semibold text-foreground">
                            {t("analysis.opponent", { team: game.opponent })}
                          </span>
                          <div className="text-sm text-muted-foreground">
                            {game.date} • {game.home ? t("analysis.home") : t("analysis.away")}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-foreground">{game.points}</div>
                          <div className="text-muted-foreground">PTS</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-foreground">{game.rebounds}</div>
                          <div className="text-muted-foreground">REB</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-foreground">{game.assists}</div>
                          <div className="text-muted-foreground">AST</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="betting" className="space-y-6">
            <div className="grid gap-6">
              {mockBettingLines.map((line) => (
                <Card key={line.type} className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      {line.type} - {line.line}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-500">{line.overOdds}</div>
                        <div className="text-sm text-muted-foreground">{t("analysis.over")}</div>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-red-500">{line.underOdds}</div>
                        <div className="text-sm text-muted-foreground">{t("analysis.under")}</div>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{line.hitRate}%</div>
                        <div className="text-sm text-muted-foreground">{t("analysis.hit_rate")}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analysis;