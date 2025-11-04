import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle, 
  Bot, 
  Smartphone, 
  CheckCircle, 
  BarChart3, 
  TrendingUp, 
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
  Mic,
  FileText,
  QrCode,
  Send,
  DollarSign,
  Filter,
  List,
  Eye,
  Lock,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LanguageToggle } from "@/components/LanguageToggle";

const Betinho = () => {
  const navigate = useNavigate();

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
              Envie suas apostas por mensagem, áudio ou foto. 
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
                  Mande uma mensagem, áudio ou foto da sua aposta para o Betinho no WhatsApp
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
                  Nossa inteligência artificial extrai automaticamente todos os dados da sua aposta
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
                  Tire uma foto da sua aposta e nossa IA com GPT-4 Vision extrai todos os dados
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Mic className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Mensagens de Voz</h3>
                </div>
                <p className="text-muted-foreground">
                  Grave um áudio descrevendo sua aposta e o Whisper converte em texto automaticamente
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

        {/* Example Messages Section */}
        <section className="py-20 px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Exemplos de como usar o <span className="text-green-600">Betinho</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Veja como é fácil enviar suas apostas de diferentes formas
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {/* Text Message Example */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Mensagem de Texto</CardTitle>
                    <p className="text-slate-300 text-sm">Envie apostas em formato simples</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-700 rounded-lg p-4 mb-4">
                  <p className="text-white font-mono text-sm">
                    "Lakers vs Warriors - LeBron 25+ pontos - Odd 1.85 - R$ 50"
                  </p>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Betinho extrai: Times, aposta, odds, valor e data automaticamente</span>
                </div>
              </CardContent>
            </Card>

            {/* Screenshot Example */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Screenshot da Aposta</CardTitle>
                    <p className="text-slate-300 text-sm">Tire uma foto da sua aposta no site</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-700 rounded-lg p-4 mb-4 flex items-center justify-center">
                  <div className="w-32 h-20 bg-slate-600 rounded flex items-center justify-center">
                    <Camera className="w-8 h-8 text-slate-400" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>IA analisa a imagem e extrai todos os dados da aposta</span>
                </div>
              </CardContent>
            </Card>

            {/* Voice Message Example */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Mensagem de Voz</CardTitle>
                    <p className="text-slate-300 text-sm">Grave um áudio descrevendo sua aposta</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-700 rounded-lg p-4 mb-4">
                  <p className="text-white font-mono text-sm">
                    "Oi Betinho, apostei 100 reais no Bucks contra o Nets, Giannis vai fazer mais de 30 pontos, odd 2.0"
                  </p>
                </div>
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Whisper converte áudio em texto e Betinho processa a aposta</span>
                </div>
              </CardContent>
            </Card>
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

          {/* Mock Dashboard Interface */}
          <div className="max-w-7xl mx-auto">
            <div className="bg-slate-800 rounded-2xl p-4 md:p-6 shadow-2xl overflow-hidden">
              {/* Dashboard Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Minhas Apostas - Betinho</h3>
                    <p className="text-slate-400 text-sm">Apostas registradas via WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-green-600 text-white">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Conectado
                  </Badge>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4 text-center">
                    <Target className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">12</p>
                    <p className="text-slate-300 text-sm">Total de Apostas</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4 text-center">
                    <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">R$ 1.200</p>
                    <p className="text-slate-300 text-sm">Total Apostado</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">R$ 1.450</p>
                    <p className="text-slate-300 text-sm">Retorno Total</p>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4 text-center">
                    <Target className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">67%</p>
                    <p className="text-slate-300 text-sm">Taxa de Acerto</p>
                  </CardContent>
                </Card>
              </div>

              {/* Bet Cards Preview */}
              <div className="space-y-3">
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-green-500 text-white">Ganhou</Badge>
                          <span className="text-sm text-slate-300">NBA • Lakers vs Warriors</span>
                        </div>
                        <h4 className="font-semibold text-white">LeBron 25+ pontos</h4>
                        <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                          <div>
                            <p className="text-slate-400">Valor</p>
                            <p className="text-white font-semibold">R$ 50</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Odds</p>
                            <p className="text-white font-semibold">1.85</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Retorno</p>
                            <p className="text-green-400 font-semibold">R$ 92.50</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-yellow-500 text-white">Pendente</Badge>
                          <span className="text-sm text-slate-300">NBA • Bucks vs Nets</span>
                        </div>
                        <h4 className="font-semibold text-white">Giannis 30+ pontos</h4>
                        <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                          <div>
                            <p className="text-slate-400">Valor</p>
                            <p className="text-white font-semibold">R$ 100</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Odds</p>
                            <p className="text-white font-semibold">2.0</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Retorno</p>
                            <p className="text-green-400 font-semibold">R$ 200</p>
                          </div>
                        </div>
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
              <p className="text-xl text-muted-foreground">
                Powered by OpenAI GPT-4 Vision e Whisper para máxima precisão
              </p>
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
                      <p className="text-muted-foreground">GPT-4 Vision + Whisper</p>
                    </div>
                  </div>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Análise precisa de imagens de apostas</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Transcrição automática de áudios</span>
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
        <section className="py-20 px-6 text-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 rounded-3xl">
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
              ✨ Gratuito para sempre • 🚀 Sem instalação • 📱 Funciona no WhatsApp
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Betinho;




