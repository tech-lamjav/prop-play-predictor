import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle, ArrowRight, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const LandingEcossistema = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const products = [
    {
      id: "nba",
      title: "Plataforma NBA",
      subtitle: "Análise de Prop Bets",
      description: "Oportunidades diárias, reports com insights e dashboards completos para suas prop bets NBA.",
      color: "bg-[#5b9bd5]",
      features: ["Oportunidades diárias selecionadas", "Report diário com insights", "Análise 360°", "Injury report"],
      cta: "Explorar NBA",
      route: "/nba",
      available: true,
      screenshot: "/screenshot-nba.png",
    },
    {
      id: "betinho",
      title: "Betinho",
      subtitle: "Gestão de apostas descomplicada",
      description: "Registre suas apostas com um print do bilhete e tenha um dashboard completo de performance com insights.",
      color: "bg-emerald-500",
      features: ["Registro por foto do bilhete", "Dashboard de performance", "Insights sobre seus resultados", "Disponível no Telegram"],
      cta: "Conhecer Betinho",
      route: "/betinho",
      available: true,
      screenshot: "/screenshot-betinho.png",
    },
    {
      id: "futebol",
      title: "Plataforma Futebol",
      subtitle: "Em breve",
      description: "Análises de dados para apostas em futebol com cobertura de ligas brasileiras e europeias.",
      color: "bg-amber-500",
      features: ["Brasileirão e Copa do Brasil", "Premier League e La Liga", "Análises pré-jogo", "Odds comparadas"],
      cta: "Entrar na lista de espera",
      route: "/waitlist",
      available: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Helmet>
        <title>Smart Betting — Análises, Gestão e Ferramentas para Apostadores</title>
        <meta name="description" content="Análise de prop bets NBA, gestão de banca e ferramentas para apostadores que querem decidir com dados. Controle suas apostas e acompanhe seus resultados." />
      </Helmet>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-6 sm:px-6">
          <div className="flex items-center">
            <img src="/logo.png" alt="Smart Betting" className="h-10" />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              onClick={() => navigate(user ? "/onboarding" : "/auth")}
              className="text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              {user ? "Acessar" : "Entrar"}
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
        {/* Hero */}
        <section className="relative py-20 overflow-hidden">
          <div className="relative text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 max-w-5xl mx-auto leading-tight">
              Tudo que o apostador precisa,{" "}
              <span className="bg-gradient-primary bg-clip-text text-[#5b9bd5]">menos a casa</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
              Dados, análises e ferramentas para quem quer apostar com{" "}
              <span className="text-foreground font-semibold">inteligência, não com sorte.</span>
            </p>

            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span>Sem promessas de ganho</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-success" />
                <span>Baseado em dados, não palpites</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-success" />
                <span>Transparência total</span>
              </div>
            </div>

            <div className="flex justify-center items-center max-w-md mx-auto">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="hover:opacity-90 gap-2 text-lg py-6 px-10 text-slate-50 bg-[#5b9bd5] hover:bg-[#4a8ac4]"
              >
                Começar grátis
              </Button>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="py-20 px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Nosso ecossistema
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Ferramentas que trabalham juntas para te dar vantagem em cada etapa da sua jornada como apostador
            </p>
          </div>

          <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            {products.map((product) => {
              return (
                <Card
                  key={product.id}
                  className={`group relative overflow-hidden bg-card border-border hover:shadow-2xl transition-all duration-300 rounded-sm ${!product.available ? 'opacity-80' : ''}`}
                >
                  <CardContent className={`p-8 flex flex-col ${product.screenshot ? 'md:flex-row' : ''} gap-8`}>
                    {product.screenshot && (
                      <div className="md:w-1/2 rounded-sm overflow-hidden border border-border flex-shrink-0">
                        <img
                          src={product.screenshot}
                          alt={`${product.title} — preview`}
                          className="w-full h-auto"
                        />
                      </div>
                    )}

                    <div className={`${product.screenshot ? 'md:w-1/2' : 'w-full'} space-y-5`}>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{product.title}</h3>
                        <p className={`text-sm font-medium ${!product.available ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {product.subtitle}
                        </p>
                      </div>

                      <p className="text-muted-foreground leading-relaxed">
                        {product.description}
                      </p>

                      <ul className="space-y-2">
                        {product.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <Button
                        onClick={() => navigate(product.route)}
                        variant={product.available ? "default" : "outline"}
                        className={`w-full gap-2 ${product.available ? `${product.color} hover:opacity-90 text-white` : 'border-amber-500/50 text-amber-500 hover:bg-amber-500/10'}`}
                      >
                        {product.cta}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Why Smart Betting */}
        <section className="py-20 px-6 bg-muted/30">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Por que a Smart Betting existe
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              No mercado de apostas, todo mundo só mostra os acertos. A gente mostra tudo.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            <div className="text-center space-y-3 p-6">
              <CheckCircle className="h-10 w-10 text-success mx-auto" />
              <h4 className="font-semibold text-foreground text-lg">Histórico aberto</h4>
              <p className="text-sm text-muted-foreground">Todas as oportunidades publicadas ficam disponíveis — acertos e erros</p>
            </div>
            <div className="text-center space-y-3 p-6">
              <CheckCircle className="h-10 w-10 text-success mx-auto" />
              <h4 className="font-semibold text-foreground text-lg">Dados verificáveis</h4>
              <p className="text-sm text-muted-foreground">Você vê de onde vem cada análise e pode conferir os números</p>
            </div>
            <div className="text-center space-y-3 p-6">
              <CheckCircle className="h-10 w-10 text-success mx-auto" />
              <h4 className="font-semibold text-foreground text-lg">Sem promessas de ganho</h4>
              <p className="text-sm text-muted-foreground">A gente entrega ferramentas e dados — a decisão é sempre sua</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-destructive/5 border-destructive/20 p-6 rounded-sm">
              <CardContent className="space-y-4 p-0">
                <div className="text-destructive font-semibold text-lg">O que você encontra por aí</div>
                <ul className="space-y-3 text-muted-foreground">
                  <li>• Tipsters que vendem "entradas garantidas"</li>
                  <li>• Grupos de sinais sem transparência</li>
                  <li>• Promessas de lucro fácil</li>
                  <li>• Dependência de opiniões de terceiros</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-success/5 border-success/20 p-6 rounded-sm">
              <CardContent className="space-y-4 p-0">
                <div className="text-success font-semibold text-lg">O que a Smart Betting oferece</div>
                <ul className="space-y-3 text-muted-foreground">
                  <li>• Dados e análises para você decidir</li>
                  <li>• Histórico aberto de todas as análises</li>
                  <li>• Ferramentas para sua independência</li>
                  <li>• Transparência como princípio, não marketing</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Pronto para apostar com inteligência?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Junte-se aos apostadores que já economizam horas por dia e tomam decisões baseadas em dados confiáveis.
            </p>
            <div className="flex justify-center items-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="hover:opacity-90 gap-2 text-lg px-10 py-6 bg-[#5b9bd5] hover:bg-[#4a8ac4]"
              >
                Criar conta grátis
              </Button>
            </div>
          </div>
        </section>
      </div>

    </div>
  );
};

export default LandingEcossistema;
