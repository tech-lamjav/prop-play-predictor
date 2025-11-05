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
  Edit
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LanguageToggle } from "@/components/LanguageToggle";
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
  
  // URL direta do vídeo no Supabase Storage
  // URL completa: https://lavclmlvvfzkblrstojd.supabase.co/storage/v1/object/public/landing%20-page/WhatsApp%20Video%202025-11-03%20at%2022.02.07.mp4
  const screenshotVideoUrl = 'https://lavclmlvvfzkblrstojd.supabase.co/storage/v1/object/public/landing%20-page/WhatsApp%20Video%202025-11-03%20at%2022.02.07.mp4';

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-6 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <span className="text-lg sm:text-2xl font-bold text-foreground">Smart Betting</span>
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
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Bot className="h-4 w-4" />
              Conheça o Betinho
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 max-w-5xl mx-auto leading-tight">
              Seu assistente de apostas no <span className="bg-gradient-primary bg-clip-text text-green-600">WhatsApp</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Envie suas apostas por mensagem ou foto. 
              <span className="text-foreground font-semibold"> O Betinho organiza tudo automaticamente no seu dashboard.</span>
            </p>

            {/* Social Proof */}
            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>IA avançada</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-success" />
                <span>100% automático</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-success" />
                <span>Via WhatsApp</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")} 
                className="w-full bg-gradient-primary hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-green-600 hover:bg-green-500"
              >
                <MessageCircle className="h-5 w-5" />
                Começar com WhatsApp
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              Como funciona o <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">Betinho</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Três passos simples para organizar todas as suas apostas automaticamente
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Send className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">1. Envie sua aposta</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Mande uma mensagem ou foto da sua aposta para o Betinho no WhatsApp
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">2. IA processa tudo</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Nossa inteligência artificial extrai automaticamente todos os dados da sua aposta e registra na sua conta
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
                  Veja todas as suas apostas organizadas com estatísticas e performance em tempo real
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Recursos do <span className="text-green-600">Betinho</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Tudo que você precisa para organizar suas apostas de forma inteligente
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Análise de Texto</h3>
                </div>
                <p className="text-muted-foreground">
                  Envie apostas em texto simples e o Betinho extrai automaticamente times, odds e valores
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Camera className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Análise de Screenshots</h3>
                </div>
                <p className="text-muted-foreground">
                  Tire uma foto da sua aposta e nossa IA extrai todos os dados
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Estatísticas Automáticas</h3>
                </div>
                <p className="text-muted-foreground">
                  Acompanhe sua performance com gráficos e métricas calculadas automaticamente
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Gestão de Cashout</h3>
                </div>
                <p className="text-muted-foreground">
                  Registre cashouts diretamente pelo WhatsApp e acompanhe lucros/prejuízos
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Filter className="w-6 h-6 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Filtros Inteligentes</h3>
                </div>
                <p className="text-muted-foreground">
                  Organize suas apostas por esporte, status, data e muito mais no dashboard
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Example Video Section */}
        <section className="py-20 px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Exemplo de como usar o <span className="text-green-600">Betinho</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Veja como é fácil enviar suas apostas de diferentes formas
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

        {/* Dashboard Preview Section */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              Veja suas apostas organizadas
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Dashboard completo com todas as apostas registradas via WhatsApp
            </p>
          </div>

          {/* Mock Dashboard Interface - Réplica exata da página Bets */}
          <div className="max-w-7xl mx-auto">
            <div className="bg-background rounded-2xl p-4 md:p-6 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="mb-6 sm:mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">Minhas Apostas</h3>
                    <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                      Acompanhe suas apostas registradas via WhatsApp
                    </p>
                  </div>
                  
                  <Button variant="outline" disabled className="w-full sm:w-auto">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                      <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      disabled
                      className="w-full sm:w-auto"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Limpar Filtros
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="h-10 bg-muted rounded-md border border-border flex items-center px-3 text-sm text-muted-foreground">
                        Todos
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Esporte</Label>
                      <div className="h-10 bg-muted rounded-md border border-border flex items-center px-3 text-sm text-muted-foreground">
                        Todos
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Liga</Label>
                      <div className="h-10 bg-muted rounded-md border border-border flex items-center px-3 text-sm text-muted-foreground">
                        Todas
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Data Inicial</Label>
                      <div className="h-10 bg-muted rounded-md border border-border flex items-center px-3 text-sm text-muted-foreground">
                        --
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Data Final</Label>
                      <div className="h-10 bg-muted rounded-md border border-border flex items-center px-3 text-sm text-muted-foreground">
                        --
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Buscar</Label>
                      <div className="h-10 bg-muted rounded-md border border-border flex items-center px-3 text-sm text-muted-foreground">
                        Buscar apostas...
                      </div>
                    </div>
                  </div>
                  
                  {/* Results count */}
                  <div className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
                    <List className="w-4 h-4" />
                    Mostrando 3 de 3 apostas
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                      <Target className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                      <div className="sm:ml-4">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total de Apostas</p>
                        <p className="text-xl sm:text-2xl font-bold">3</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                      <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                      <div className="sm:ml-4">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Apostado</p>
                        <p className="text-lg sm:text-2xl font-bold">R$ 150,00</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                      <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                      <div className="sm:ml-4">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Retorno Total</p>
                        <p className="text-lg sm:text-2xl font-bold">R$ 292,50</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                      <Target className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                      <div className="sm:ml-4">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Taxa de Acerto</p>
                        <p className="text-xl sm:text-2xl font-bold">66.7%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-2 md:col-span-1">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                      <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                      <div className="sm:ml-4">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Lucro/Prejuízo</p>
                        <p className="text-lg sm:text-2xl font-bold text-green-600">R$ 142,50</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bets List */}
              <div className="space-y-3">
                {/* Bet Card 1 - Ganhou */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-3">
                      {/* Header - Status and Sport */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className="bg-green-500 text-white flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              Ganhou
                            </Badge>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Target className="w-3.5 h-3.5 text-blue-600" />
                              <span>Basquete</span>
                              <span>•</span>
                              <span className="text-xs">NBA</span>
                            </div>
                          </div>
                          <h3 className="font-semibold text-sm sm:text-base">LeBron 25+ pontos</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Lakers vs Warriors
                          </p>
                        </div>
                      </div>

                      {/* Values Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 border-y">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
                          <p className="font-semibold text-sm">R$ 50,00</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Odds</p>
                          <p className="font-semibold text-sm">1.85</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Retorno</p>
                          <p className="font-semibold text-sm text-green-600">R$ 92,50</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Data</p>
                          <p className="text-xs sm:text-sm">15/01/2024</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" disabled className="min-w-[40px]">
                          <Edit className="w-3 h-3" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button size="sm" variant="destructive" disabled className="min-w-[40px]">
                          <X className="w-3 h-3" />
                          <span className="sr-only">Excluir</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bet Card 2 - Pendente */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-3">
                      {/* Header - Status and Sport */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className="bg-yellow-500 text-white flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Pendente
                            </Badge>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Target className="w-3.5 h-3.5 text-blue-600" />
                              <span>Basquete</span>
                              <span>•</span>
                              <span className="text-xs">NBA</span>
                            </div>
                          </div>
                          <h3 className="font-semibold text-sm sm:text-base">Giannis 30+ pontos</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Bucks vs Nets
                          </p>
                        </div>
                      </div>

                      {/* Values Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 border-y">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
                          <p className="font-semibold text-sm">R$ 100,00</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Odds</p>
                          <p className="font-semibold text-sm">2.0</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Retorno</p>
                          <p className="font-semibold text-sm text-green-600">R$ 200,00</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Data</p>
                          <p className="text-xs sm:text-sm">18/01/2024</p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" disabled className="flex-1 min-w-[80px]">
                          <TrendingUp className="w-3 h-3 sm:mr-1" />
                          <span className="hidden xs:inline sm:inline">Ganhou</span>
                        </Button>
                        <Button size="sm" variant="outline" disabled className="flex-1 min-w-[80px]">
                          <TrendingDown className="w-3 h-3 sm:mr-1" />
                          <span className="hidden xs:inline sm:inline">Perdeu</span>
                        </Button>
                        <Button size="sm" variant="outline" disabled className="flex-1 min-w-[90px]">
                          <DollarSign className="w-3 h-3 sm:mr-1" />
                          <span className="hidden xs:inline sm:inline">Cashout</span>
                        </Button>
                        <Button size="sm" variant="outline" disabled className="min-w-[40px]">
                          <Edit className="w-3 h-3" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button size="sm" variant="destructive" disabled className="min-w-[40px]">
                          <X className="w-3 h-3" />
                          <span className="sr-only">Excluir</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bet Card 3 - Cashout */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-3">
                      {/* Header - Status and Sport */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className="bg-blue-500 text-white flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Cashout
                            </Badge>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Target className="w-3.5 h-3.5 text-blue-600" />
                              <span>Basquete</span>
                              <span>•</span>
                              <span className="text-xs">NBA</span>
                            </div>
                          </div>
                          <h3 className="font-semibold text-sm sm:text-base">Curry 5+ cestas de 3</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Warriors vs Celtics
                          </p>
                        </div>
                      </div>

                      {/* Values Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 border-y">
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
                          <p className="font-semibold text-sm">R$ 50,00</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Odds</p>
                          <p className="font-semibold text-sm">2.0</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Cashout</p>
                          <p className="font-semibold text-sm text-green-600">R$ 75,00</p>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Data</p>
                          <p className="text-xs sm:text-sm">20/01/2024</p>
                        </div>
                      </div>

                      {/* Cashout info */}
                      <div className="pt-2 border-t flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="w-3 h-3" />
                          <span>Cashout: R$ 75,00</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>Odds: 1.5</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>20/01/2024</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" disabled className="flex-1">
                          <DollarSign className="w-3 h-3 mr-1" />
                          <span className="text-xs sm:text-sm">Editar Cashout</span>
                        </Button>
                        <Button size="sm" variant="outline" disabled className="min-w-[40px]">
                          <Edit className="w-3 h-3" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button size="sm" variant="destructive" disabled className="min-w-[40px]">
                          <X className="w-3 h-3" />
                          <span className="sr-only">Excluir</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Call to Action Below Dashboard */}
              <div className="text-center mt-8">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")} 
                  className="bg-gradient-primary hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-green-600 hover:bg-green-500"
                >
                  <MessageCircle className="h-5 w-5" />
                  Começar com WhatsApp
                </Button>
                <p className="text-sm text-slate-400 mt-4">
                  Acesso completo ao dashboard e todas as funcionalidades
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Technology Section */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Tecnologia de ponta para suas apostas
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="bg-card border-border">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Brain className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">IA Avançada</h3>
                    </div>
                  </div>
                  <ul className="space-y-3 text-muted-foreground">
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

              <Card className="bg-card border-border">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <Shield className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Privacidade & Segurança</h3>
                      <p className="text-muted-foreground">Seus dados protegidos</p>
                    </div>
                  </div>
                  <ul className="space-y-3 text-muted-foreground">
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
        <section className="py-20 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Comece agora mesmo
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Pronto para organizar suas apostas com o <span className="text-green-600">Betinho</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Cadastre-se gratuitamente e comece a enviar suas apostas via WhatsApp hoje mesmo.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")} 
                className="bg-gradient-primary hover:opacity-90 gap-2 text-lg px-8 py-6 bg-green-600 hover:bg-green-500"
              >
                <MessageCircle className="h-5 w-5" />
                Começar com WhatsApp
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate("/")} 
                className="gap-2 text-lg px-8 py-6"
              >
                <ArrowRight className="h-5 w-5" />
                Ver mais recursos
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-6">
              🚀 Sem instalação • 📱 Funciona no WhatsApp
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Betinho;




