import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  MessageCircle, 
  Bot, 
  Smartphone, 
  CheckCircle, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  Shield, 
  Target, 
  Database, 
  Zap, 
  PlayCircle, 
  ArrowRight, 
  Timer, 
  Brain,
  Camera,
  FileText,
  QrCode,
  Send,
  DollarSign,
  Filter,
  List,
  Eye,
  Lock,
  Sparkles,
  RefreshCw,
  X,
  Calendar,
  Edit,
  Search,
  Settings
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BankrollEvolutionChart } from "@/components/bets/BankrollEvolutionChart";
import { config } from "@/config/environment";

// Helper function to get Supabase Storage public URL
const getVideoUrl = (videoPath: string, bucketName: string = 'landing-page') => {
  const supabaseUrl = config.supabase.url;
  if (!supabaseUrl) return '';
  
  // Remove trailing slash if present
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  
  // Encode only the video path, bucket name should be used as-is (Supabase handles encoding)
  // Note: If bucket has spaces, use "landing page" (with space) instead of "landing-page"
  const encodedPath = encodeURIComponent(videoPath);
  
  return `${baseUrl}/storage/v1/object/public/${bucketName}/${encodedPath}`;
};

const Betinho = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Helper to navigate to auth preserving ref parameter
  const navigateToAuth = () => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      navigate(`/auth?ref=${refParam}`);
    } else {
      navigate('/auth');
    }
  };
  
  // URL direta do vídeo no Supabase Storage
  // URL completa: https://lavclmlvvfzkblrstojd.supabase.co/storage/v1/object/public/landing%20-page/WhatsApp%20Video%202025-11-03%20at%2022.02.07.mp4
  const screenshotVideoUrl = 'https://lavclmlvvfzkblrstojd.supabase.co/storage/v1/object/public/landing%20-page/WhatsApp%20Video%202026-01-22%20at%2016.05.33.mp4';

  type MockBetStatus = 'pending' | 'won' | 'lost' | 'cashout';
  // Mock data para a prévia do dashboard
  const mockBets: Array<{
    id: string;
    bet_date: string;
    bet_description: string;
    match_description?: string;
    sport: string;
    league?: string | null;
    stake_amount: number;
    odds: number;
    potential_return: number;
    cashout_amount?: number;
    status: MockBetStatus;
    tags: string[];
  }> = [
    {
      id: '1',
      bet_date: '02/02/2025',
      bet_description: 'LeBron 25+ pontos',
      match_description: 'Lakers vs Warriors',
      sport: 'Basquete',
      league: 'NBA',
      stake_amount: 150,
      odds: 1.85,
      potential_return: 277.5,
      status: 'won',
      tags: ['NBA', 'Player Props']
    },
    {
      id: '2',
      bet_date: '01/02/2025',
      bet_description: 'Corinthians ML',
      match_description: 'Corinthians vs Santos',
      sport: 'Futebol',
      league: 'Brasileirão',
      stake_amount: 100,
      odds: 2.1,
      potential_return: 210,
      status: 'pending',
      tags: ['BR', 'Moneyline']
    },
    {
      id: '3',
      bet_date: '30/01/2025',
      bet_description: 'Curry 5+ bolas de 3',
      match_description: 'Warriors vs Celtics',
      sport: 'Basquete',
      league: 'NBA',
      stake_amount: 150,
      odds: 1.7,
      potential_return: 255,
      cashout_amount: 255,
      status: 'cashout',
      tags: ['NBA', 'Curry']
    },
    {
      id: '4',
      bet_date: '28/01/2025',
      bet_description: 'Under 2.5 gols',
      match_description: 'Juventus vs Milan',
      sport: 'Futebol',
      league: 'Serie A',
      stake_amount: 80,
      odds: 2.3,
      potential_return: 184,
      status: 'lost',
      tags: ['ITA', 'Under']
    }
  ];

  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      pending: 'PENDENTE',
      won: 'GANHOU',
      lost: 'PERDEU',
      void: 'ANULADA',
      cashout: 'CASHOUT'
    };
    return map[status] || status.toUpperCase();
  };

  const formatMoney = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text overflow-x-hidden">
      {/* Navigation - alinhado ao visual do dashboard (cinza/azul) */}
      <nav className="sticky top-0 z-50 bg-terminal-black/80 backdrop-blur-lg border-b border-terminal-border text-terminal-text">
        <div className="container mx-auto flex items-center justify-between px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-terminal-blue/20 border border-terminal-border rounded-lg flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-terminal-blue" />
            </div>
            <span className="text-lg sm:text-2xl font-bold text-terminal-text">Smart Betting</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageToggle />
            <Button 
              variant="outline" 
              onClick={() => navigate("/como-usar")} 
              className="text-sm sm:text-base px-3 sm:px-4 py-2 border-terminal-border bg-transparent text-terminal-text hover:border-terminal-blue hover:text-terminal-blue"
            >
              Como usar
            </Button>
            <Button 
              variant="outline" 
              onClick={navigateToAuth} 
              className="text-sm sm:text-base px-3 sm:px-4 py-2 border-terminal-border bg-transparent text-terminal-text hover:border-terminal-blue hover:text-terminal-blue"
            >
              Entrar
            </Button>
            <Button 
              onClick={navigateToAuth} 
              className="bg-[#3B82F6] text-white hover:bg-[#2F6AD4] text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              Começar Grátis
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6">
        {/* Hero Section - Telegram first */}
        <section className="relative py-16 md:py-20 overflow-hidden">
          <div className="relative text-center max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-terminal-blue/10 text-terminal-blue px-4 py-2 rounded-full text-sm font-medium mb-6 border border-terminal-border">
              <Bot className="h-4 w-4" />
              Assistente de apostas no Telegram
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-terminal-text mb-6 leading-tight">
              Seu assistente de apostas no <span className="text-terminal-blue">Telegram</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-terminal-text/80 mb-8 leading-relaxed">
              Envie texto ou print pelo bot e veja tudo organizado no dashboard.
              <span className="text-terminal-text font-semibold"> IA processa e registra para você.</span>
            </p>

            {/* Social Proof */}
            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-terminal-text/70">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-terminal-green" />
                <span>IA para texto e print</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-terminal-blue" />
                <span>Sincroniza com seu dashboard</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-terminal-blue" />
                <span>Fluxo 100% no Telegram</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-lg mx-auto">
              <Button 
                size="lg" 
                onClick={navigateToAuth} 
                className="w-full bg-[#3B82F6] hover:bg-[#2F6AD4] gap-2 text-lg py-5 text-white"
              >
                <MessageCircle className="h-5 w-5" />
                Começar grátis
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={navigateToAuth}
                className="w-full bg-transparent border-terminal-border text-terminal-text hover:border-terminal-blue hover:text-terminal-blue py-5"
              >
                Ver dashboard
              </Button>
            </div>
          </div>
        </section>

        {/* Dashboard Preview Section (mock) */}
        <section className="py-12 px-3 sm:px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-terminal-text mb-3">
              Veja o dashboard em ação
            </h2>
            <p className="text-lg text-terminal-text/80 max-w-3xl mx-auto">
              Aqui está um exemplo de como você consegue acompanhar a sua performance de forma fácil.
            </p>
          </div>

          <div className="bg-terminal-dark-gray rounded-2xl p-4 md:p-6 shadow-2xl overflow-hidden border border-terminal-border">
            {/* Stats Grid - mock data */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: "TOTAL APOSTAS", value: "4", icon: <Target className="w-5 h-5 text-terminal-blue" /> },
                { label: "TAXA DE ACERTO", value: "66.7%", icon: <TrendingUp className="w-5 h-5 text-terminal-green" /> },
                { label: "LUCRO", value: "R$ 152,50", icon: <DollarSign className="w-5 h-5 text-terminal-green" />, color: "text-terminal-green" },
                { label: "ROI", value: "31.8%", icon: <TrendingUp className="w-5 h-5 text-terminal-blue" />, color: "text-terminal-blue" },
                { label: "TOTAL APOSTADO", value: "R$ 480,00", icon: <DollarSign className="w-5 h-5 text-terminal-text" /> },
                { label: "RETORNO TOTAL", value: "R$ 632,50", icon: <TrendingUp className="w-5 h-5 text-terminal-green" />, color: "text-terminal-green" },
                { label: "MÉDIA APOSTA", value: "R$ 120,00", icon: <DollarSign className="w-5 h-5 text-terminal-text" /> },
                { label: "MÉDIA ODDS", value: "1.99", icon: <Target className="w-5 h-5 text-terminal-blue" />, color: "text-terminal-blue" },
              ].map((item, idx) => (
                <div key={idx} className="terminal-container p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-terminal-text/60">{item.label}</p>
                    <p className={`text-lg font-bold ${item.color || "text-terminal-text"}`}>{item.value}</p>
                  </div>
                  <div className="p-2 rounded bg-terminal-black border border-terminal-border">
                    {item.icon}
                  </div>
                </div>
              ))}
            </div>

            {/* Mock graph using real BankrollEvolutionChart */}
            <BankrollEvolutionChart
              bets={mockBets as any}
              initialBankroll={480}
              onUpdateBankroll={async () => true}
            />

            {/* Bets Table - mock data with pendentes */}
            <div className="terminal-container p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="section-title text-terminal-text">APOSTAS RECENTES (mock)</h3>
                <span className="text-[10px] opacity-50">MOSTRANDO 4 APOSTAS</span>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-terminal-border-subtle">
                      <th className="text-left py-2 px-2 data-label">DATA</th>
                      <th className="text-left py-2 px-2 data-label">DESCRIÇÃO</th>
                      <th className="text-left py-2 px-2 data-label">TAGS</th>
                      <th className="text-left py-2 px-2 data-label">ESPORTE</th>
                      <th className="text-right py-2 px-2 data-label">VALOR</th>
                      <th className="text-right py-2 px-2 data-label">ODDS</th>
                      <th className="text-right py-2 px-2 data-label">RETORNO</th>
                      <th className="text-center py-2 px-2 data-label">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockBets.map((bet) => (
                      <tr 
                        key={bet.id}
                        className="border-b border-terminal-border-subtle hover:bg-terminal-light-gray transition-colors"
                      >
                        <td className="py-2 px-2 opacity-70">
                          {bet.bet_date}
                        </td>
                        <td className="py-2 px-2 font-medium">
                          <div>{bet.bet_description}</div>
                          {bet.match_description && (
                            <div className="text-[10px] opacity-50">{bet.match_description}</div>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {bet.tags.map((tag) => (
                              <span key={tag} className="px-2 py-0.5 text-[10px] rounded bg-terminal-blue/15 text-terminal-blue border border-terminal-border">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-2 opacity-70">
                          {bet.sport} {bet.league && `• ${bet.league}`}
                        </td>
                        <td className="text-right py-2 px-2">
                          {formatMoney(bet.stake_amount)}
                        </td>
                        <td className="text-right py-2 px-2 text-terminal-blue">
                          {bet.odds.toFixed(2)}
                        </td>
                        <td className={`text-right py-2 px-2 ${
                          bet.status === "won" ? "text-terminal-green" : 
                          bet.status === "lost" ? "text-terminal-red" : 
                          bet.status === "cashout" ? "text-terminal-blue" :
                          "text-terminal-yellow"
                        }`}>
                          {bet.status === "cashout" && bet.cashout_amount
                            ? formatMoney(bet.cashout_amount)
                            : formatMoney(bet.potential_return)
                          }
                        </td>
                        <td className="text-center py-2 px-2">
                          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold ${
                            bet.status === "won" ? "text-terminal-green bg-terminal-green/10" :
                            bet.status === "lost" ? "text-terminal-red bg-terminal-red/10" :
                            bet.status === "pending" ? "text-terminal-yellow bg-terminal-yellow/10" :
                            bet.status === "cashout" ? "text-terminal-blue bg-terminal-blue/10" :
                            "text-terminal-text bg-terminal-text/10"
                          }`}>
                            {translateStatus(bet.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view */}
              <div className="md:hidden space-y-4">
                {mockBets.map((bet) => (
                  <div 
                    key={bet.id} 
                    className="bg-terminal-black border border-terminal-border-subtle p-4 rounded-md space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs opacity-50">
                        {bet.bet_date}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                        bet.status === "won" ? "text-terminal-green bg-terminal-green/10" :
                        bet.status === "lost" ? "text-terminal-red bg-terminal-red/10" :
                        bet.status === "pending" ? "text-terminal-yellow bg-terminal-yellow/10" :
                        bet.status === "cashout" ? "text-terminal-blue bg-terminal-blue/10" :
                        "text-terminal-text bg-terminal-text/10"
                      }`}>
                        {translateStatus(bet.status)}
                      </span>
                    </div>

                    <div>
                      <div className="font-medium text-sm text-terminal-text">{bet.bet_description}</div>
                      {bet.match_description && (
                        <div className="text-xs opacity-60 mt-0.5">{bet.match_description}</div>
                      )}
                      <div className="text-xs text-terminal-blue mt-1 uppercase tracking-wider">
                        {bet.sport} {bet.league && `• ${bet.league}`}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {bet.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 text-[10px] rounded bg-terminal-blue/15 text-terminal-blue border border-terminal-border">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-terminal-border-subtle bg-terminal-dark-gray/30 -mx-4 px-4">
                      <div className="text-center">
                        <div className="text-[10px] opacity-50 uppercase mb-0.5">Valor</div>
                        <div className="text-sm">{formatMoney(bet.stake_amount)}</div>
                      </div>
                      <div className="text-center border-l border-terminal-border-subtle">
                        <div className="text-[10px] opacity-50 uppercase mb-0.5">Odds</div>
                        <div className="text-sm text-terminal-blue">{bet.odds.toFixed(2)}</div>
                      </div>
                      <div className="text-center border-l border-terminal-border-subtle">
                        <div className="text-[10px] opacity-50 uppercase mb-0.5">Retorno</div>
                        <div className={`text-sm ${
                          bet.status === "won" ? "text-terminal-green" : 
                          bet.status === "lost" ? "text-terminal-red" : 
                          bet.status === "cashout" ? "text-terminal-blue" :
                          "text-terminal-yellow"
                        }`}>
                          {bet.status === "cashout" && bet.cashout_amount 
                            ? formatMoney(bet.cashout_amount)
                            : formatMoney(bet.potential_return)
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section - Telegram */}
        <section className="py-16 px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              Como funciona no <span className="text-terminal-blue">Telegram</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Três passos simples: sincronize, envie, veja no dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Send className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">1. Sincronize pelo Telegram</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Abra o bot, toque em enviar seu número e conecte sua conta.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">2. Envie texto ou print</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  1 mensagem = 1 aposta. Texto ou imagem, a IA extrai odds, valor e jogo.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">3. Acompanhe no dashboard</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Confirmação rápida e todas as apostas no seu painel, com stats e filtros.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features Section - estilo dashboard */}
        <section className="py-16 px-6 bg-terminal-black">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-terminal-text mb-4">
              Recursos do <span className="text-terminal-blue">Betinho</span>
            </h2>
            <p className="text-xl text-terminal-text/80 max-w-3xl mx-auto">
              Tudo o que você usa no dashboard, agora alimentado pelo bot no Telegram.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="bg-terminal-dark-gray border border-terminal-border hover:border-terminal-blue/60 transition-all duration-300">
              <CardContent className="p-6 text-terminal-text">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-terminal-blue/15 rounded-lg flex items-center justify-center border border-terminal-border">
                    <Camera className="w-6 h-6 text-terminal-blue" />
                  </div>
                  <h3 className="text-lg font-semibold text-terminal-text">OCR de prints</h3>
                </div>
                <p className="text-terminal-text/80">
                  Envie um print. A IA extrai odds, valor e jogo e registra a aposta.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-terminal-dark-gray border border-terminal-border hover:border-terminal-blue/60 transition-all duration-300">
              <CardContent className="p-6 text-terminal-text">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-terminal-blue/15 rounded-lg flex items-center justify-center border border-terminal-border">
                    <FileText className="w-6 h-6 text-terminal-blue" />
                  </div>
                  <h3 className="text-lg font-semibold text-terminal-text">Texto no Telegram</h3>
                </div>
                <p className="text-terminal-text/80">
                  Mande em texto. O bot entende múltiplas linhas, odds e stakes.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-terminal-dark-gray border border-terminal-border hover:border-terminal-blue/60 transition-all duration-300">
              <CardContent className="p-6 text-terminal-text">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-terminal-blue/15 rounded-lg flex items-center justify-center border border-terminal-border">
                    <TrendingUp className="w-6 h-6 text-terminal-blue" />
                  </div>
                  <h3 className="text-lg font-semibold text-terminal-text">Odds combinadas</h3>
                </div>
                <p className="text-terminal-text/80">
                  Calcula odds múltiplas automaticamente quando precisar validar o combinado.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-terminal-dark-gray border border-terminal-border hover:border-terminal-blue/60 transition-all duration-300">
              <CardContent className="p-6 text-terminal-text">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-terminal-blue/15 rounded-lg flex items-center justify-center border border-terminal-border">
                    <DollarSign className="w-6 h-6 text-terminal-blue" />
                  </div>
                  <h3 className="text-lg font-semibold text-terminal-text">Cashout e status</h3>
                </div>
                <p className="text-terminal-text/80">
                  Registre cashout, ganhou ou perdeu pelo bot e veja refletir no painel.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-terminal-dark-gray border border-terminal-border hover:border-terminal-blue/60 transition-all duration-300">
              <CardContent className="p-6 text-terminal-text">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-terminal-blue/15 rounded-lg flex items-center justify-center border border-terminal-border">
                    <Filter className="w-6 h-6 text-terminal-blue" />
                  </div>
                  <h3 className="text-lg font-semibold text-terminal-text">Tags e filtros</h3>
                </div>
                <p className="text-terminal-text/80">
                  Organize por esporte, status, data e tags com o mesmo visual do dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Example Video Section */}
        <section className="py-16 px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Veja o Betinho no <span className="text-terminal-blue">Telegram</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Como enviar texto ou print e receber confirmação rápida.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            {screenshotVideoUrl ? (
              <div className="flex items-center justify-center">
                <video
                  className="max-w-full max-h-[60vh] rounded-lg object-contain shadow-2xl"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src={screenshotVideoUrl} type="video/mp4" />
                  Seu navegador não suporta o elemento de vídeo.
                </video>
              </div>
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                <Camera className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>
        </section>

        {/* Dashboard Preview Section (duplicada escondida) */}
        <section className="hidden">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-terminal-text mb-6">
              Veja suas apostas organizadas
            </h2>
            <p className="text-xl text-terminal-text/80 max-w-3xl mx-auto">
              Visual idêntico ao dashboard, com dados mockados vindos do bot Telegram.
            </p>
          </div>

          {/* Mock Dashboard Interface - seguindo a página Bets */}
          <div className="max-w-7xl mx-auto">
            <div className="bg-terminal-dark-gray rounded-2xl p-4 md:p-6 shadow-2xl overflow-hidden border border-terminal-border">
              {/* Header */}
              <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-terminal-text">Minhas Apostas</h3>
                  <p className="text-sm sm:text-base text-terminal-text/70 mt-1 sm:mt-2">
                    Acompanhe as apostas registradas pelo bot do Telegram.
                    </p>
                  </div>
                <Button variant="outline" disabled className="w-full sm:w-auto border-terminal-border text-terminal-text bg-terminal-black">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar
                  </Button>
              </div>

              {/* Stats Grid - mock data */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "TOTAL APOSTAS", value: "3", icon: <Target className="w-5 h-5 text-terminal-blue" /> },
                  { label: "TAXA DE ACERTO", value: "66.7%", icon: <TrendingUp className="w-5 h-5 text-terminal-green" />, trend: "up" },
                  { label: "LUCRO", value: "R$ 142,50", icon: <DollarSign className="w-5 h-5 text-terminal-green" />, color: "text-terminal-green" },
                  { label: "ROI", value: "35.6%", icon: <TrendingUp className="w-5 h-5 text-terminal-blue" />, color: "text-terminal-blue" },
                  { label: "TOTAL APOSTADO", value: "R$ 400,00", icon: <DollarSign className="w-5 h-5 text-terminal-text" /> },
                  { label: "RETORNO TOTAL", value: "R$ 542,50", icon: <TrendingUp className="w-5 h-5 text-terminal-green" />, color: "text-terminal-green" },
                  { label: "MÉDIA APOSTA", value: "R$ 133,33", icon: <DollarSign className="w-5 h-5 text-terminal-text" /> },
                  { label: "MÉDIA ODDS", value: "1.98", icon: <Target className="w-5 h-5 text-terminal-blue" />, color: "text-terminal-blue" },
                ].map((item, idx) => (
                  <div key={idx} className="terminal-container p-4 flex items-center justify-between">
                        <div>
                      <p className="text-[11px] font-semibold tracking-wide text-terminal-text/60">{item.label}</p>
                      <p className={`text-lg font-bold ${item.color || "text-terminal-text"}`}>{item.value}</p>
                        </div>
                    <div className="p-2 rounded bg-terminal-black border border-terminal-border">
                      {item.icon}
                        </div>
                        </div>
                ))}
                      </div>

              {/* Filters mock - desabilitados */}
              <div className="terminal-container p-4 mb-4 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 w-full">
                  <div className="relative col-span-2 md:w-auto md:min-w-[220px]">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-terminal-text opacity-50" />
                    <input 
                      type="text" 
                      placeholder="BUSCAR APOSTAS..." 
                      className="terminal-input w-full pl-8 pr-3 py-2 text-xs rounded-sm"
                      disabled
                      value=""
                      readOnly
                    />
                      </div>
                  
                  <select 
                    className="terminal-input px-3 py-2 text-xs rounded-sm w-full md:w-auto md:min-w-[140px]"
                    disabled
                    value="all"
                  >
                    <option value="all">TODOS STATUS</option>
                    <option value="pending">PENDENTE</option>
                    <option value="won">GANHOU</option>
                    <option value="lost">PERDEU</option>
                    <option value="cashout">CASHOUT</option>
                  </select>

                  <select 
                    className="terminal-input px-3 py-2 text-xs rounded-sm w-full md:w-auto md:min-w-[140px]"
                    disabled
                    value="all"
                  >
                    <option value="all">TODOS ESPORTES</option>
                    <option value="basquete">BASQUETE</option>
                    <option value="futebol">FUTEBOL</option>
                  </select>

                  <input 
                    type="date"
                    className="terminal-input px-3 py-2 text-xs rounded-sm w-full md:w-auto"
                    disabled
                    value=""
                    readOnly
                    placeholder="DATA INICIAL"
                  />

                  <input 
                    type="date"
                    className="terminal-input px-3 py-2 text-xs rounded-sm w-full md:w-auto"
                    disabled
                    value=""
                    readOnly
                    placeholder="DATA FINAL"
                  />
                        </div>

                <div className="flex gap-2">
                  <button 
                    disabled
                    className="terminal-button px-4 py-2 text-sm flex items-center gap-2 border-terminal-border bg-transparent"
                  >
                    <Settings className="w-4 h-4" />
                    Unidades
                  </button>
                  <button 
                    disabled
                    className="terminal-button px-4 py-2 text-sm flex items-center gap-2 border-terminal-border bg-transparent"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                  </button>
                        </div>
                      </div>

              {/* Bets Table - mock data */}
              <div className="terminal-container p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="section-title text-terminal-text">APOSTAS RECENTES</h3>
                  <span className="text-[10px] opacity-50">MOSTRANDO 3 APOSTAS</span>
                      </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-terminal-border-subtle">
                        <th className="text-left py-2 px-2 data-label">DATA</th>
                        <th className="text-left py-2 px-2 data-label">DESCRIÇÃO</th>
                        <th className="text-left py-2 px-2 data-label">TAGS</th>
                        <th className="text-left py-2 px-2 data-label">ESPORTE</th>
                        <th className="text-right py-2 px-2 data-label">VALOR</th>
                        <th className="text-right py-2 px-2 data-label">ODDS</th>
                        <th className="text-right py-2 px-2 data-label">RETORNO</th>
                        <th className="text-center py-2 px-2 data-label">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockBets.map((bet) => (
                        <tr 
                          key={bet.id}
                          className="border-b border-terminal-border-subtle hover:bg-terminal-light-gray transition-colors"
                        >
                          <td className="py-2 px-2 opacity-70">
                            {bet.bet_date}
                          </td>
                          <td className="py-2 px-2 font-medium">
                            <div>{bet.bet_description}</div>
                            {bet.match_description && (
                              <div className="text-[10px] opacity-50">{bet.match_description}</div>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-1">
                              {bet.tags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 text-[10px] rounded bg-terminal-blue/15 text-terminal-blue border border-terminal-border">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-2 opacity-70">
                            {bet.sport} {bet.league && `• ${bet.league}`}
                          </td>
                          <td className="text-right py-2 px-2">
                            {formatMoney(bet.stake_amount)}
                          </td>
                          <td className="text-right py-2 px-2 text-terminal-blue">
                            {bet.odds.toFixed(2)}
                          </td>
                          <td className={`text-right py-2 px-2 ${
                            bet.status === "won" ? "text-terminal-green" : 
                            bet.status === "lost" ? "text-terminal-red" : 
                            bet.status === "cashout" ? "text-terminal-blue" :
                            "opacity-70"
                          }`}>
                            {bet.status === "cashout" && bet.cashout_amount
                              ? formatMoney(bet.cashout_amount)
                              : formatMoney(bet.potential_return)
                            }
                          </td>
                          <td className="text-center py-2 px-2">
                            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold ${
                              bet.status === "won" ? "text-terminal-green bg-terminal-green/10" :
                              bet.status === "lost" ? "text-terminal-red bg-terminal-red/10" :
                              bet.status === "pending" ? "text-terminal-yellow bg-terminal-yellow/10" :
                              bet.status === "cashout" ? "text-terminal-blue bg-terminal-blue/10" :
                              "text-terminal-text bg-terminal-text/10"
                            }`}>
                              {translateStatus(bet.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                      </div>

                {/* Mobile Stacked View */}
                <div className="md:hidden space-y-4">
                  {mockBets.map((bet) => (
                    <div 
                      key={bet.id} 
                      className="bg-terminal-black border border-terminal-border-subtle p-4 rounded-md space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs opacity-50">
                          {bet.bet_date}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                          bet.status === "won" ? "text-terminal-green bg-terminal-green/10" :
                          bet.status === "lost" ? "text-terminal-red bg-terminal-red/10" :
                          bet.status === "pending" ? "text-terminal-yellow bg-terminal-yellow/10" :
                          bet.status === "cashout" ? "text-terminal-blue bg-terminal-blue/10" :
                          "text-terminal-text bg-terminal-text/10"
                        }`}>
                          {translateStatus(bet.status)}
                        </span>
                        </div>
                        
                        <div>
                        <div className="font-medium text-sm text-terminal-text">{bet.bet_description}</div>
                        {bet.match_description && (
                          <div className="text-xs opacity-60 mt-0.5">{bet.match_description}</div>
                        )}
                        <div className="text-xs text-terminal-blue mt-1 uppercase tracking-wider">
                          {bet.sport} {bet.league && `• ${bet.league}`}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {bet.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 text-[10px] rounded bg-terminal-blue/15 text-terminal-blue border border-terminal-border">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-terminal-border-subtle bg-terminal-dark-gray/30 -mx-4 px-4">
                        <div className="text-center">
                          <div className="text-[10px] opacity-50 uppercase mb-0.5">Valor</div>
                          <div className="text-sm">{formatMoney(bet.stake_amount)}</div>
                        </div>
                        <div className="text-center border-l border-terminal-border-subtle">
                          <div className="text-[10px] opacity-50 uppercase mb-0.5">Odds</div>
                          <div className="text-sm text-terminal-blue">{bet.odds.toFixed(2)}</div>
                        </div>
                        <div className="text-center border-l border-terminal-border-subtle">
                          <div className="text-[10px] opacity-50 uppercase mb-0.5">Retorno</div>
                          <div className={`text-sm ${
                            bet.status === "won" ? "text-terminal-green" : 
                            bet.status === "lost" ? "text-terminal-red" : 
                            bet.status === "cashout" ? "text-terminal-blue" :
                            "opacity-70"
                          }`}>
                            {bet.status === "cashout" && bet.cashout_amount 
                              ? formatMoney(bet.cashout_amount)
                              : formatMoney(bet.potential_return)
                            }
                        </div>
                      </div>
                      </div>
                    </div>
                  ))}
              </div>

                {/* CTA below mock */}
              <div className="text-center mt-8">
                <Button 
                  size="lg" 
                  onClick={navigateToAuth} 
                    className="bg-terminal-blue hover:bg-terminal-blue/80 gap-2 text-lg px-8 py-6 text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                    Começar grátis
                </Button>
                  <p className="text-sm text-terminal-text/60 mt-4">
                    Acesso completo ao dashboard e todas as funcionalidades.
                </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Technology Section */}
        <section className="py-16 px-6 bg-terminal-black/90">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-terminal-text mb-4">
                Tecnologia de ponta para suas apostas
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-terminal-dark-gray border border-terminal-border">
                <CardContent className="p-8 text-terminal-text">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-terminal-blue/15 rounded-lg flex items-center justify-center border border-terminal-border">
                      <Brain className="w-6 h-6 text-terminal-blue" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-terminal-text">IA Avançada</h3>
                    </div>
                  </div>
                  <ul className="space-y-3 text-terminal-text/80">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Análise precisa de imagens de apostas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Extração inteligente de dados</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-terminal-dark-gray border border-terminal-border">
                <CardContent className="p-8 text-terminal-text">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-terminal-blue/15 rounded-lg flex items-center justify-center border border-terminal-border">
                      <Shield className="w-6 h-6 text-terminal-blue" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-terminal-text">Privacidade & Segurança</h3>
                      <p className="text-terminal-text/80">Seus dados protegidos</p>
                    </div>
                  </div>
                  <ul className="space-y-3 text-terminal-text/80">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Dados criptografados e seguros</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Sem spam - apenas confirmações</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Controle total sobre suas apostas</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 px-6 text-center bg-terminal-black">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Comece agora mesmo
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Pronto para organizar suas apostas com o <span className="text-terminal-blue">Betinho</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Cadastre-se gratuitamente e comece a enviar suas apostas pelo Telegram hoje mesmo.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                onClick={navigateToAuth} 
                className="bg-[#3B82F6] hover:bg-[#2F6AD4] gap-2 text-lg px-8 py-6 text-white"
              >
                <MessageCircle className="h-5 w-5" />
                Começar grátis
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate("/como-usar")} 
                className="gap-2 text-lg px-8 py-6 border-terminal-border text-terminal-text hover:border-terminal-blue hover:text-terminal-blue bg-transparent"
              >
                <ArrowRight className="h-5 w-5" />
                Ver mais recursos
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-6">
              🚀 Sem instalação • 🤖 Funciona no Telegram
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Betinho;




