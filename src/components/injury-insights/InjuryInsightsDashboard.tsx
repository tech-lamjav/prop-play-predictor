import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, TrendingUp, Target, Users, RefreshCw } from "lucide-react";
import { InjuryInsightsCard } from "./InjuryInsightsCard";
import { 
  useInjuryInsights, 
  useInjuryInsightsStats, 
  useHighImpactInjuries,
  useRecentInjuryInsights 
} from "@/hooks/use-injury-insights";
import type { InjuryInsight } from "@/types/sports";

interface InjuryInsightsDashboardProps {
  onAnalyze?: (insight: InjuryInsight) => void;
  onAddToWatchlist?: (insight: InjuryInsight) => void;
}

export const InjuryInsightsDashboard = ({ 
  onAnalyze, 
  onAddToWatchlist 
}: InjuryInsightsDashboardProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedImpact, setSelectedImpact] = useState<string>("all");

  // Data hooks
  const { data: insightsData, isLoading, error, refetch } = useInjuryInsights();
  const { stats } = useInjuryInsightsStats();
  const { data: highImpactData } = useHighImpactInjuries();
  const { data: recentData } = useRecentInjuryInsights();

  const insights = insightsData?.data || [];
  const highImpactInsights = highImpactData?.data || [];
  const recentInsights = recentData?.data || [];

  // Filter insights based on selected criteria
  const filteredInsights = insights.filter(insight => {
    const matchesSearch = searchTerm === "" || 
      insight.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insight.injuredPlayer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insight.nextPlayer.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTeam = selectedTeam === "all" || insight.teamName === selectedTeam;
    const matchesCategory = selectedCategory === "all" || insight.category === selectedCategory;
    const matchesImpact = selectedImpact === "all" || insight.impact === selectedImpact;

    return matchesSearch && matchesTeam && matchesCategory && matchesImpact;
  });

  // Get unique teams and categories for filters
  const teams = [...new Set(insights.map(insight => insight.teamName))].sort();
  const categories = [...new Set(insights.map(insight => insight.category))].sort();

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive/20">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Injury Insights</h3>
          <p className="text-muted-foreground mb-4">
            {error.message || 'Failed to load injury insights data. Please try refreshing.'}
          </p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Injuries</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Impact</p>
                <p className="text-2xl font-bold">{stats?.impactDistribution?.high || 0}</p>
              </div>
              <Badge className="bg-red-500 text-white">HIGH</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Teams Affected</p>
                <p className="text-2xl font-bold">{Object.keys(stats?.byTeam || {}).length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{Object.keys(stats?.byCategory || {}).length}</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Filters</span>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                placeholder="Search injuries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedImpact} onValueChange={setSelectedImpact}>
              <SelectTrigger>
                <SelectValue placeholder="All Impact Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Impact Levels</SelectItem>
                <SelectItem value="high">High Impact</SelectItem>
                <SelectItem value="medium">Medium Impact</SelectItem>
                <SelectItem value="low">Low Impact</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Injuries ({filteredInsights.length})</TabsTrigger>
          <TabsTrigger value="high-impact">High Impact ({highImpactInsights.length})</TabsTrigger>
          <TabsTrigger value="recent">Recent ({recentInsights.length})</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading injury insights...</p>
            </div>
          ) : filteredInsights.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Injuries Found</h3>
                <p className="text-muted-foreground">Try adjusting your filters or search terms.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredInsights.map((insight) => (
                <InjuryInsightsCard
                  key={insight.id}
                  insight={insight}
                  onAnalyze={onAnalyze}
                  onAddToWatchlist={onAddToWatchlist}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="high-impact" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {highImpactInsights.map((insight) => (
              <InjuryInsightsCard
                key={insight.id}
                insight={insight}
                onAnalyze={onAnalyze}
                onAddToWatchlist={onAddToWatchlist}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentInsights.map((insight) => (
              <InjuryInsightsCard
                key={insight.id}
                insight={insight}
                onAnalyze={onAnalyze}
                onAddToWatchlist={onAddToWatchlist}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Teams */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Teams by Injuries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.topTeams.map(([team, count]) => (
                      <div key={team} className="flex justify-between items-center">
                        <span className="text-sm">{team}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Categories */}
              <Card>
                <CardHeader>
                  <CardTitle>Injuries by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.topCategories.map(([category, count]) => (
                      <div key={category} className="flex justify-between items-center">
                        <span className="text-sm">{category.toUpperCase()}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Impact Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Impact Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">High Impact</span>
                      <Badge className="bg-red-500 text-white">{stats.impactDistribution.high}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Medium Impact</span>
                      <Badge className="bg-yellow-500 text-white">{stats.impactDistribution.medium}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Low Impact</span>
                      <Badge className="bg-green-500 text-white">{stats.impactDistribution.low}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};





















