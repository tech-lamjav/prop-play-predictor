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
  return <div className="min-h-screen bg-background">
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
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-gradient-primary hover:opacity-90">
              Começar Grátis
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto">
        {/* Hero Section */}
        <section className="relative py-20 px-6 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 rounded-3xl" />
          <div className="relative text-center">
            <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary border-primary/20">
              <Zap className="h-3 w-3 mr-1" />
              Teste Grátis • Sem Cartão de Crédito
            </Badge>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 max-w-5xl mx-auto leading-tight">
              Pare de <span className="bg-gradient-primary bg-clip-text text-green-600">Apostar no Escuro</span>
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
              <Button size="lg" onClick={() => navigate("/auth")} className="w-full bg-gradient-primary hover:opacity-90 gap-2 text-lg py-6 text-slate-50 bg-green-600 hover:bg-green-500">
                <Timer className="h-5 w-5" />
                Começar Teste Grátis
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              7 dias grátis • Cancele quando quiser
            </p>
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
                  <div className="text-destructive font-semibold text-lg">😤 Situação Atual</div>
                  <ul className="space-y-3 text-left text-muted-foreground">
                    <li>• Horas coletando stats manualmente</li>
                    <li>• Incerteza sobre quais dados analisar</li>
                    <li>• Dependência de dicas de terceiros</li>
                    <li>• Win rate estagnado em ~45%</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-success/5 border-success/20 p-6">
                <CardContent className="space-y-4">
                  <div className="text-success font-semibold text-lg">✅ Com Smart Betting</div>
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
                <p className="text-muted-foreground">
                  Análise automática das odds disponíveis nas principais casas de apostas, 
                  atualizada em tempo real durante os jogos.
                </p>
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
                <p className="text-muted-foreground">
                  Modelo proprietário focado exclusivamente em prop bets da NBA, 
                  não em apostas de resultado final.
                </p>
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
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Perfeito para o seu perfil de apostador
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              {/* João Profile */}
              <Card className="bg-primary/5 border-primary/20 p-8">
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
                      <Clock className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Apostador Ocupado</h3>
                      <p className="text-muted-foreground">Como João, 28 anos, analista</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Economize 2-3 horas/dia</p>
                        <p className="text-sm text-muted-foreground">Análises prontas em 30 segundos</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Interface simples</p>
                        <p className="text-sm text-muted-foreground">Decisões rápidas sem complicação</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Dados confiáveis</p>
                        <p className="text-sm text-muted-foreground">Sem mais dúvidas sobre qual análise fazer</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Carlos Profile */}
              <Card className="bg-accent/5 border-accent/20 p-8">
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
                      <TrendingUp className="h-8 w-8 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Aspirante a Profissional</h3>
                      <p className="text-muted-foreground">Como Carlos, 22 anos, buscando consistência</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Volume de análises</p>
                        <p className="text-sm text-muted-foreground">Múltiplas oportunidades por dia</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Independência</p>
                        <p className="text-sm text-muted-foreground">Pare de depender de tipsters</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-semibold text-foreground">Edge competitivo</p>
                        <p className="text-sm text-muted-foreground">Dados que outros não têm acesso</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Comece grátis, pague apenas se funcionar
            </h2>
            <p className="text-xl text-muted-foreground">
              Teste por 7 dias sem compromisso
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-primary opacity-5" />
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                
              </div>
              
              <CardHeader className="text-center pt-8">
                <div className="space-y-2">
                  <div className="text-5xl font-bold text-foreground">R$ 0</div>
                  <div className="text-muted-foreground">primeiros 7 dias</div>
                  <div className="text-sm text-muted-foreground">depois R$ 97/mês</div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="text-foreground">Análises ilimitadas de prop bets</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="text-foreground">Comparação de odds em tempo real</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="text-foreground">Histórico transparente do modelo</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="text-foreground">Interface otimizada para decisões rápidas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <span className="text-foreground">Suporte via WhatsApp</span>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="text-sm font-semibold text-foreground">🛡️ Garantia de transparência:</div>
                  <div className="text-sm text-muted-foreground">
                    Não prometemos ganhos. Somos uma ferramenta de análise de dados e comparação de odds.
                  </div>
                </div>

                <Button size="lg" className="w-full bg-gradient-primary hover:opacity-90 text-lg py-6" onClick={() => navigate("/auth")}>
                  <Timer className="h-5 w-5 mr-2" />
                  Começar Teste Grátis de 7 Dias
                </Button>
                
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">
                    ✅ Sem cartão de crédito • ✅ Cancele quando quiser
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Após o período de teste: R$ 97/mês, cancele a qualquer momento
                  </p>
                </div>
              </CardContent>
            </Card>
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
              <Button size="lg" onClick={() => navigate("/auth")} className="bg-gradient-primary hover:opacity-90 gap-2 text-lg px-8 py-6">
                <Timer className="h-5 w-5" />
                Começar Teste Grátis Agora
              </Button>
              <p className="text-sm text-muted-foreground">
                🚀 Configuração em menos de 2 minutos
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>;
};
export default Landing;