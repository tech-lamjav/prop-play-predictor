import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Star, BarChart3, LogOut, User as UserIcon, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { usePlayers, useGames, usePropBets, useInjuryReports, useDataSync } from "@/hooks/use-sports-data";
import type { PlayerFilters, GameFilters, PropFilters } from "@/types/sports";

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Data hooks
  const { data: playersData, isLoading: playersLoading, error: playersError } = usePlayers({
    search: searchTerm || undefined,
    sport: selectedSport === "all" ? undefined : selectedSport as any,
    position: selectedPosition === "all" ? undefined : selectedPosition,
  });

  const { data: gamesData, isLoading: gamesLoading } = useGames();
  const { data: propsData, isLoading: propsLoading } = usePropBets();
  const { data: injuriesData, isLoading: injuriesLoading } = useInjuryReports();
  const { syncData, isSyncing, lastSync } = useDataSync();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
      } else {
        navigate("/auth");
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const toggleWatchlist = (playerId: string) => {
    setWatchlist(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleRefresh = () => {
    syncData();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const players = playersData?.data?.data || [];
  const games = gamesData?.data?.data || [];
  const props = propsData?.data?.data || [];
  const injuries = injuriesData?.data || [];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground mt-2">Analyze player performance and betting lines</p>
            {lastSync && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {lastSync.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Refresh'}
            </Button>
            <LanguageToggle />
            <Button variant="ghost" size="sm" className="gap-2">
              <UserIcon className="h-4 w-4" />
              {user?.email}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Players</p>
                  <p className="text-2xl font-bold">{players.length}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Games</p>
                  <p className="text-2xl font-bold">{games.filter(g => g.status === 'live' || g.status === 'scheduled').length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Props</p>
                  <p className="text-2xl font-bold">{props.filter(p => p.isActive).length}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Injuries</p>
                  <p className="text-2xl font-bold">{injuries.length}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={t("dashboard.search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              {t("dashboard.filters")}
            </Button>

            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t("dashboard.sport")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                <SelectItem value="NBA">NBA</SelectItem>
                <SelectItem value="NFL">NFL</SelectItem>
                <SelectItem value="MLB">MLB</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t("dashboard.position")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="PG">Point Guard</SelectItem>
                <SelectItem value="SG">Shooting Guard</SelectItem>
                <SelectItem value="SF">Small Forward</SelectItem>
                <SelectItem value="PF">Power Forward</SelectItem>
                <SelectItem value="C">Center</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading State */}
        {playersLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading players...</p>
          </div>
        )}

        {/* Error State */}
        {playersError && (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Data</h3>
              <p className="text-muted-foreground mb-4">
                {playersError.message || 'Failed to load player data. Please try refreshing.'}
              </p>
              <Button onClick={handleRefresh} variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Players Grid */}
        {!playersLoading && !playersError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {players.map((player) => (
              <Card key={player.id} className="bg-card border-border hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-lg font-bold text-primary">
                          {player.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{player.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {player.team} • {player.position}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">{player.sport}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Check if player has injury */}
                  {injuries.find(i => i.playerId === player.id) && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Injury Alert</span>
                      </div>
                      <p className="text-xs text-yellow-600 mt-1">
                        {injuries.find(i => i.playerId === player.id)?.injury}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() => navigate("/analysis")}
                      variant="outline"
                      size="sm"
                      className="gap-1 flex-1"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Analysis
                    </Button>
                    <Button
                      variant={watchlist.includes(player.id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleWatchlist(player.id)}
                      className="gap-1 flex-1"
                    >
                      <Star className={`h-4 w-4 ${watchlist.includes(player.id) ? "fill-current" : ""}`} />
                      {watchlist.includes(player.id) ? "Remove" : "Watchlist"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!playersLoading && !playersError && players.length === 0 && (
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-12 text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Players Found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search terms or filters to find players.
              </p>
              <Button onClick={() => { setSearchTerm(''); setSelectedSport('all'); setSelectedPosition('all'); }}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;