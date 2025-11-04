import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Zap, BarChart3, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Paywall() {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    // Dummy button - placeholder for future payment integration
    console.log("Upgrade button clicked - payment integration coming soon");
    // You can add toast notification here if needed
  };

  return (
    <div className="min-h-screen bg-background">
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
            <Button 
              variant="outline" 
              onClick={() => navigate("/auth")} 
              className="text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              Entrar
            </Button>
            <Button 
              onClick={() => navigate("/bets")} 
              className="bg-gradient-primary hover:opacity-90 text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              Dashboard
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6 py-20">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-primary mb-6">
              <Lock className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Limite Diário Atingido
            </h1>
            <p className="text-xl text-muted-foreground">
              Você atingiu o limite de <span className="font-semibold text-foreground">10 apostas grátis</span> por dia.
            </p>
          </div>

          {/* Main Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Continue Apostando</CardTitle>
              <CardDescription>
                Faça upgrade para continuar registrando suas apostas sem limites
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Features */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mt-0.5">
                      <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Apostas Ilimitadas</p>
                      <p className="text-sm text-muted-foreground">
                        Registre quantas apostas quiser, sem limites diários
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mt-0.5">
                      <BarChart3 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Dashboard Completo</p>
                      <p className="text-sm text-muted-foreground">
                        Acesse todas as funcionalidades do dashboard premium
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mt-0.5">
                      <ArrowRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Prioridade no Suporte</p>
                      <p className="text-sm text-muted-foreground">
                        Receba suporte prioritário para todas suas dúvidas
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-6 border-t">
                  <Button 
                    onClick={handleUpgrade}
                    className="w-full bg-gradient-primary hover:opacity-90 text-lg py-6 gap-2"
                    size="lg"
                  >
                    <span>Fazer Upgrade</span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Integração de pagamento em breve
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                O limite diário é resetado automaticamente à meia-noite (horário GMT-3).
                Você pode continuar usando o plano gratuito com 10 apostas por dia ou fazer upgrade para apostas ilimitadas.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

