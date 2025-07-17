import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  TrendingUp, 
  Search, 
  Star, 
  BarChart3, 
  TrendingDown, 
  User as UserIcon,
  Calendar,
  Target,
  Filter,
  LogOut
} from "lucide-react";
import type { User, Session } from "@supabase/supabase-js";

// Mock data for demonstration
const mockPlayers = [
  {
    id: "1",
    name: "LeBron James",
    team: "LAL",
    position: "SF",
    image: "/placeholder.svg",
    stats: {
      points: 25.3,
      rebounds: 7.3,
      assists: 7.3,
      threePointers: 2.1
    },
    trends: {
      points: "up",
      rebounds: "down",
      assists: "up",
      threePointers: "neutral"
    },
    lines: {
      points: { over: 24.5, under: 24.5, odds: "-110" },
      rebounds: { over: 7.5, under: 7.5, odds: "-110" },
      assists: { over: 7.5, under: 7.5, odds: "-110" }
    }
  },
  {
    id: "2",
    name: "Stephen Curry",
    team: "GSW",
    position: "PG",
    image: "/placeholder.svg",
    stats: {
      points: 29.5,
      rebounds: 4.5,
      assists: 6.2,
      threePointers: 4.8
    },
    trends: {
      points: "up",
      rebounds: "neutral",
      assists: "down",
      threePointers: "up"
    },
    lines: {
      points: { over: 28.5, under: 28.5, odds: "-115" },
      rebounds: { over: 4.5, under: 4.5, odds: "-105" },
      assists: { over: 6.5, under: 6.5, odds: "-110" }
    }
  }
];

const mockGames = [
  {
    id: "1",
    homeTeam: "LAL",
    awayTeam: "GSW",
    date: "2024-01-20",
    time: "8:00 PM ET",
    status: "upcoming"
  },
  {
    id: "2",
    homeTeam: "BOS",
    awayTeam: "MIA",
    date: "2024-01-20",
    time: "7:30 PM ET",
    status: "live"
  }
];

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_OUT' || !session?.user) {
          navigate('/');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleWatchlist = (playerId: string) => {
    setWatchlist(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-success" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-muted" />;
    }
  };

  const filteredPlayers = mockPlayers.filter(player => 
    player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.team.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">PropEdge</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2">
                <UserIcon className="w-4 h-4" />
                <span className="text-sm">{user.email}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user.user_metadata?.full_name || user.email?.split('@')[0]}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening in player props today
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Players Tracked</p>
                  <p className="text-2xl font-bold">{watchlist.length}</p>
                </div>
                <Star className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Games Today</p>
                  <p className="text-2xl font-bold">{mockGames.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold">78%</p>
                </div>
                <Target className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ROI</p>
                  <p className="text-2xl font-bold text-success">+12.4%</p>
                </div>
                <BarChart3 className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="players" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          </TabsList>

          <TabsContent value="players" className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search players or teams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredPlayers.map((player) => (
                <Card key={player.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <UserIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{player.name}</CardTitle>
                          <CardDescription>{player.team} • {player.position}</CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleWatchlist(player.id)}
                        className={watchlist.includes(player.id) ? "bg-primary text-primary-foreground" : ""}
                      >
                        <Star className={`w-4 h-4 ${watchlist.includes(player.id) ? "fill-current" : ""}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Points</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{player.stats.points}</span>
                            {getTrendIcon(player.trends.points)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Rebounds</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{player.stats.rebounds}</span>
                            {getTrendIcon(player.trends.rebounds)}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Assists</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{player.stats.assists}</span>
                            {getTrendIcon(player.trends.assists)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">3PM</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{player.stats.threePointers}</span>
                            {getTrendIcon(player.trends.threePointers)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="text-sm font-medium mb-2">Betting Lines</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Points O/U {player.lines.points.over}</span>
                          <Badge variant="outline">{player.lines.points.odds}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Rebounds O/U {player.lines.rebounds.over}</span>
                          <Badge variant="outline">{player.lines.rebounds.odds}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="games" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mockGames.map((game) => (
                <Card key={game.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {game.awayTeam} @ {game.homeTeam}
                      </CardTitle>
                      <Badge variant={game.status === 'live' ? 'destructive' : 'outline'}>
                        {game.status === 'live' ? 'LIVE' : 'Upcoming'}
                      </Badge>
                    </div>
                    <CardDescription>
                      {game.date} • {game.time}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full">
                      View Props
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-6">
            {watchlist.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No players in watchlist</h3>
                  <p className="text-muted-foreground">
                    Add players to your watchlist to track their performance and betting lines.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredPlayers
                  .filter(player => watchlist.includes(player.id))
                  .map((player) => (
                    <Card key={player.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                              <UserIcon className="w-6 h-6" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{player.name}</CardTitle>
                              <CardDescription>{player.team} • {player.position}</CardDescription>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleWatchlist(player.id)}
                          >
                            <Star className="w-4 h-4 fill-current" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          Recent performance and line movement will be displayed here.
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;