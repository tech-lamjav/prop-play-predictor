import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Clock, Shield, Target, Database, Zap, CheckCircle, PlayCircle, ArrowRight, Timer, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "@/components/LanguageToggle";
const Landing = () => {
  const navigate = useNavigate();
  const {
    t
  } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto flex items-center justify-between p-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-foreground">Smart Betting</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Button onClick={() => navigate("/waitlist")} className="bg-gradient-primary hover:opacity-90">
              Entrar na lista de espera
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto">
        {/* Hero Section */}
        <section className="relative py-20 px-6 overflow-hidden">
          
          <div className="relative text-center">
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 max-w-5xl mx-auto leading-tight">
              Pare de <span className="bg-gradient-primary bg-clip-text text-green-600">apostar no escuro</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Análises de dados em tempo real para suas prop bets na NBA. 
              <span className="text-foreground font-semibold"> Baseado em evidências, não em palpites.</span>
            </p>

            {/* Social Proof */}
            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Sem promessas de ganho</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-success" />
                <span>Dados históricos transparentes</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
              <Button size="lg" onClick={() => navigate("/waitlist")} className="w-full bg-gradient-primary hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-green-600 hover:bg-green-500">
                <Timer className="h-5 w-5" />
                Entrar na lista de espera
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              7 dias grátis • Cancele quando quiser
            </p>
          </div>
        </section>


        {/* Dashboard Preview Section */}
        <section className="py-20 px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
              Veja como funciona na prática
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Dashboard completo com dados reais da NBA para suas análises de prop bets
            </p>
          </div>

          {/* Mock Dashboard Interface */}
          <div className="max-w-7xl mx-auto">
            <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden">
              {/* Dashboard Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Smart Betting Dashboard</h3>
                    <p className="text-slate-400 text-sm">Análise em tempo real</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-green-600 text-white">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Conectado
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                {/* Player Profile Card */}
                <div className="lg:col-span-1">
                  <Card className="bg-slate-700 border-slate-600 h-full">
                    <CardContent className="p-3 h-full flex flex-col justify-center">
                      <div className="text-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-2">
                          <span className="text-white font-bold text-xs">LD</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1">Luka Dončić</h4>
                        <p className="text-slate-300 text-xs mb-1">Dallas Mavericks • PG/SG</p>
                        <Badge className="bg-green-600 text-white text-xs px-2 py-1">Ativo</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* PPG Card */}
                <div className="lg:col-span-1">
                  <Card className="bg-slate-700 border-slate-600 h-full">
                    <CardContent className="p-3 h-full flex flex-col justify-center">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="w-4 h-4 text-blue-400 mr-1" />
                          <p className="text-slate-300 text-xs font-medium">Pontos</p>
                        </div>
                        <p className="text-white font-bold text-3xl mb-1">28.4</p>
                        <p className="text-blue-400 text-xs">+1.2 vs média</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Assists Card */}
                <div className="lg:col-span-1">
                  <Card className="bg-slate-700 border-slate-600 h-full">
                    <CardContent className="p-3 h-full flex flex-col justify-center">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                          <p className="text-slate-300 text-xs font-medium">Assistências</p>
                        </div>
                        <p className="text-white font-bold text-3xl mb-1">8.7</p>
                        <p className="text-green-400 text-xs">+0.3 vs média</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Rebounds Card */}
                <div className="lg:col-span-1">
                  <Card className="bg-slate-700 border-slate-600 h-full">
                    <CardContent className="p-3 h-full flex flex-col justify-center">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="w-4 h-4 text-green-400 mr-1" />
                          <p className="text-slate-300 text-xs font-medium">Rebotes</p>
                        </div>
                        <p className="text-white font-bold text-3xl mb-1">8.1</p>
                        <p className="text-green-400 text-xs">+0.5 vs média</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Performance Chart Preview */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card className="bg-slate-700 border-slate-600">
                    <CardHeader>
                      <CardTitle className="text-white">Performance vs Linha de Aposta - Últimos 15 Jogos</CardTitle>
                      <p className="text-slate-300 text-sm">Pontos reais vs linha oferecida pelo bookmaker</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 bg-slate-800 rounded-lg p-4 relative">
                        {/* Y-Axis Labels */}
                        <div className="absolute left-2 top-4 bottom-4 flex flex-col justify-between text-xs text-slate-400">
                          <span>35</span>
                          <span>30</span>
                          <span>25</span>
                          <span>20</span>
                          <span>15</span>
                          <span>10</span>
                        </div>
                        
                        {/* Chart Area */}
                        <div className="ml-8 h-full flex items-end space-x-1 relative">
                          {/* Reference Line */}
                          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-white opacity-60 border-dashed"></div>
                          <div className="absolute top-1/2 right-2 text-white text-xs bg-slate-700 px-2 py-1 rounded">
                            Linha: 22.5
                          </div>
                          
                          {/* Mock Chart Bars - 15 games with more realistic data */}
                          {[18, 17, 26, 29, 10, 19, 25, 32, 30, 18, 24, 27, 31, 16, 28].map((height, index) => {
                            const barHeight = Math.max((height / 35) * 200, 16); // Increased base height
                            return (
                              <div key={index} className="flex flex-col items-center flex-1">
                                <div
                                  className={`w-4 rounded-t transition-all duration-300 hover:opacity-80 ${
                                    height > 22.5 ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                                  style={{ 
                                    height: `${barHeight}px`,
                                    minHeight: '16px'
                                  }}
                                  title={`Jogo ${index + 1}: ${height} pontos`}
                                />
                                <div className="text-xs text-slate-400 mt-1 transform -rotate-45 origin-left whitespace-nowrap">
                                  {index + 1}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* X-Axis Label */}
                        <div className="text-center text-xs text-slate-400 mt-2">
                          Jogos (Últimos 15)
                        </div>
                      </div>
                      
                      {/* Chart Legend */}
                      <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-green-500 rounded"></div>
                          <span className="text-slate-300">Acima da Linha (10 jogos)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-red-500 rounded"></div>
                          <span className="text-slate-300">Abaixo da Linha (5 jogos)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Injury Report - Vertical Orientation */}
                <div>
                  <Card className="bg-gradient-to-b from-red-900/20 to-orange-900/20 border-red-500/30">
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-white text-lg">Injury Report</CardTitle>
                          <p className="text-slate-300 text-xs">Nosso diferencial competitivo</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Player Status */}
                        <div>
                          <h4 className="text-white font-semibold text-sm mb-3">Status do Jogador</h4>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-white font-medium text-sm">Luka Dončić</span>
                              </div>
                              <Badge className="bg-green-600 text-white text-xs">Ativo</Badge>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-800 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <span className="text-white font-medium text-sm">Kyrie Irving</span>
                              </div>
                              <Badge className="bg-yellow-600 text-white text-xs">Questionable</Badge>
                            </div>
                          </div>
                        </div>

                        {/* Opponent Impact */}
                        <div>
                          <h4 className="text-white font-semibold text-sm mb-3">Impacto no Oponente</h4>
                          <div className="space-y-2">
                            <div className="p-2 bg-slate-800 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white font-medium text-sm">Miami Heat</span>
                                <Badge className="bg-red-600 text-white text-xs">Alto Impacto</Badge>
                              </div>
                              <p className="text-slate-300 text-xs">
                                Jimmy Butler lesionado - Defesa vulnerável
                              </p>
                            </div>
                            <div className="p-2 bg-slate-800 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white font-medium text-sm">Bam Adebayo</span>
                                <Badge className="bg-yellow-600 text-white text-xs">Médio Impacto</Badge>
                              </div>
                              <p className="text-slate-300 text-xs">
                                Probable - Pode afetar rebotes
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>


              {/* Bottom Features Row */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Brain className="w-8 h-8 text-blue-400" />
                      <div>
                        <h4 className="text-white font-semibold">IA Avançada</h4>
                        <p className="text-slate-300 text-sm">Análise preditiva</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Database className="w-8 h-8 text-green-400" />
                      <div>
                        <h4 className="text-white font-semibold">Dados Históricos</h4>
                        <p className="text-slate-300 text-sm">5+ anos de dados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-700 border-slate-600">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Zap className="w-8 h-8 text-yellow-400" />
                      <div>
                        <h4 className="text-white font-semibold">Tempo Real</h4>
                        <p className="text-slate-300 text-sm">Updates instantâneos</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Call to Action Below Dashboard */}
            <div className="text-center mt-12">
              <Button 
                size="lg" 
                onClick={() => navigate("/waitlist")} 
                className="bg-gradient-primary hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-green-600 hover:bg-green-500"
              >
                <PlayCircle className="h-5 w-5" />
                Entrar na lista de espera
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Acesso completo a todas as funcionalidades
              </p>
            </div>
          </div>
        </section>

        {/* Problem Statement */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
              Você está perdendo tempo e dinheiro por falta de dados confiáveis
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8 mt-12">
              <Card className="bg-destructive/5 border-destructive/20 p-6">
                <CardContent className="space-y-4">
                  <div className="text-destructive font-semibold text-lg">Sem a Smart Betting</div>
                  <ul className="space-y-3 text-left text-muted-foreground">
                    <li>• Horas coletando stats manualmente</li>
                    <li>• Incerteza sobre quais dados analisar</li>
                    <li>• Dependência de dicas de terceiros</li>
                    <li>• Win rate estagnada</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-success/5 border-success/20 p-6">
                <CardContent className="space-y-4">
                  <div className="text-success font-semibold text-lg">Com Smart Betting</div>
                  <ul className="space-y-3 text-left text-muted-foreground">
                    <li>• Análises prontas em segundos</li>
                    <li>• Dados relevantes pré-selecionados</li>
                    <li>• Decisões baseadas em evidências</li>
                    <li>• Potencial para melhorar seu win rate</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Como funciona nossa vantagem competitiva
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Modelo proprietário treinado com milhares de resultados históricos da NBA, focado especificamente em prop bets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Database className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">Dados em Tempo Real</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">Análise automática das odds disponíveis nas principais casas de apostas, em tempo de real de acorodo com o Injury Report</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">IA Especializada</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">Modelo proprietário focado em avaliar oportunidades baseado em informações e não opniões</p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-center text-foreground">Transparência Total</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground">
                  Histórico completo de análises anteriores. Você vê exatamente 
                  como nosso modelo performou no passado.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Value Props for Personas */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Target className="h-4 w-4" />
                Feito para você
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
                Perfeito para o seu <span className="bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">perfil de apostador</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Não importa se você tem 10 minutos ou 10 horas por dia - nossa plataforma se adapta ao seu ritmo
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Busy Bettor Profile */}
              <Card className="group relative overflow-hidden bg-card border-border hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardContent className="relative p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Clock className="h-10 w-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                        <Zap className="text-white text-xs font-bold h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">Apostador Ocupado</h3>
                      <p className="text-primary font-medium">Eficiência em primeiro lugar</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Economize 2-3 horas/dia</p>
                        <p className="text-muted-foreground">Análises prontas em 30 segundos</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex -space-x-1">
                            <div className="w-3 h-3 bg-success rounded-full"></div>
                            <div className="w-3 h-3 bg-success/80 rounded-full"></div>
                            <div className="w-3 h-3 bg-success/60 rounded-full"></div>
                          </div>
                          <span className="text-xs text-success font-medium">Tempo poupado: 21h/semana</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Interface simples</p>
                        <p className="text-muted-foreground">Decisões rápidas sem complicação</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                        <Shield className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Dados confiáveis</p>
                        <p className="text-muted-foreground">Sem mais dúvidas sobre qual análise fazer</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-foreground">Perfeito para você se:</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Tem pouco tempo para análises</li>
                      <li>• Quer resultados rápidos e precisos</li>
                      <li>• Prefere simplicidade à complexidade</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Professional Aspirant Profile */}
              <Card className="group relative overflow-hidden bg-card border-border hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <CardContent className="relative p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <TrendingUp className="h-10 w-10 text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-success rounded-full flex items-center justify-center">
                        <Target className="text-white text-xs font-bold h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground">Aspirante a Profissional</h3>
                      <p className="text-success font-medium">Crescimento e volume</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Database className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Volume de análises</p>
                        <p className="text-muted-foreground">Múltiplas oportunidades por dia</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-4 bg-success rounded-full"></div>
                            <div className="w-2 h-6 bg-success/80 rounded-full"></div>
                            <div className="w-2 h-5 bg-success/60 rounded-full"></div>
                            <div className="w-2 h-7 bg-success/40 rounded-full"></div>
                          </div>
                          <span className="text-xs text-success font-medium">15+ análises/dia</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                        <Target className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Independência</p>
                        <p className="text-muted-foreground">Pare de depender de tipsters</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Brain className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">Edge competitivo</p>
                        <p className="text-muted-foreground">Dados que outros não têm acesso</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-success" />
                      <span className="font-semibold text-foreground">Perfeito para você se:</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Quer escalar suas operações</li>
                      <li>• Busca independência de terceiros</li>
                      <li>• Tem tempo para múltiplas análises</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bottom CTA */}
            <div className="text-center mt-16">
              <Button 
                size="lg" 
                onClick={() => navigate("/waitlist")} 
                className="bg-gradient-primary hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-green-600 hover:bg-green-500 px-8 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Timer className="h-5 w-5" />
                Entrar na lista de espera
              </Button>
            </div>
          </div>
        </section>


        {/* Trust & Risk Mitigation */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-muted/30 rounded-3xl p-8 md:p-12">
              <div className="text-center space-y-6">
                <Shield className="h-16 w-16 text-primary mx-auto" />
                <h3 className="text-2xl md:text-3xl font-bold text-foreground">
                  Transparência é nossa prioridade
                </h3>
                <div className="grid md:grid-cols-2 gap-8 text-left">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground">❌ O que NÃO fazemos:</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Prometemos ganhos garantidos</li>
                      <li>• Indicamos apostas específicas</li>
                      <li>• Escondemos nossos resultados passados</li>
                      <li>• Usamos depoimentos falsos</li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground">✅ O que fazemos:</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• Fornecemos análise de dados objetiva</li>
                      <li>• Comparamos odds em tempo real</li>
                      <li>• Mostramos histórico completo do modelo</li>
                      <li>• Educamos sobre análise de prop bets</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Pare de perder tempo com análises manuais
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Junte-se aos apostadores que já economizam horas por dia e tomam decisões baseadas em dados confiáveis.
            </p>
            <div className="space-y-4">
              <Button size="lg" onClick={() => navigate("/waitlist")} className="bg-gradient-primary hover:opacity-90 gap-2 text-lg px-8 py-6 bg-green-600 hover:bg-green-500">
                <Timer className="h-5 w-5" />
                Entrar na lista de espera
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Landing;