import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Star, BarChart3, LogOut, User as UserIcon } from "lucide-react";
import { LanguageToggle } from "@/components/LanguageToggle";

// Mock data for demonstration
const mockPlayers = [
  {
    id: "1",
    name: "LeBron James",
    team: "Lakers",
    position: "SF",
    sport: "NBA",
    stats: { points: 25.2, rebounds: 7.1, assists: 7.9 },
    nextGame: { opponent: "Warriors", date: "Jan 20", time: "8:00 PM" }
  },
  {
    id: "2", 
    name: "Stephen Curry",
    team: "Warriors",
    position: "PG",
    sport: "NBA",
    stats: { points: 29.5, rebounds: 4.5, assists: 6.2 },
    nextGame: { opponent: "Lakers", date: "Jan 20", time: "8:00 PM" }
  },
  {
    id: "3",
    name: "Giannis Antetokounmpo",
    team: "Bucks", 
    position: "PF",
    sport: "NBA",
    stats: { points: 31.1, rebounds: 11.2, assists: 5.7 },
    nextGame: { opponent: "Celtics", date: "Jan 21", time: "7:30 PM" }
  }
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedPosition, setSelectedPosition] = useState("all");
  const [watchlist, setWatchlist] = useState<string[]>([]);

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

  const filteredPlayers = mockPlayers.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.team.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSport = selectedSport === "all" || player.sport.toLowerCase() === selectedSport;
    const matchesPosition = selectedPosition === "all" || player.position.toLowerCase() === selectedPosition;
    
    return matchesSearch && matchesSport && matchesPosition;
  });

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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground mt-2">Analyze player performance and betting lines</p>
          </div>
          <div className="flex items-center gap-4">
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
                <SelectItem value="nba">NBA</SelectItem>
                <SelectItem value="nfl">NFL</SelectItem>
                <SelectItem value="mlb">MLB</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t("dashboard.position")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                <SelectItem value="pg">Point Guard</SelectItem>
                <SelectItem value="sg">Shooting Guard</SelectItem>
                <SelectItem value="sf">Small Forward</SelectItem>
                <SelectItem value="pf">Power Forward</SelectItem>
                <SelectItem value="c">Center</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map((player) => (
            <Card key={player.id} className="bg-card border-border hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{player.name.split(' ').map(n => n[0]).join('')}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{player.name}</h3>
                      <p className="text-sm text-muted-foreground">{player.team} • {player.position}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{player.sport}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-foreground">{player.stats.points}</div>
                    <div className="text-muted-foreground">{t("dashboard.points")}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-foreground">{player.stats.rebounds}</div>
                    <div className="text-muted-foreground">{t("dashboard.rebounds")}</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-foreground">{player.stats.assists}</div>
                    <div className="text-muted-foreground">{t("dashboard.assists")}</div>
                  </div>
                </div>

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
      </div>
    </div>
  );
};

export default Dashboard;