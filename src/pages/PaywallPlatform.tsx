import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Zap, BarChart3, ArrowRight, MessageCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/integrations/supabase/client";
import { stripeService } from "@/services/stripe.service";
import { toast } from "@/hooks/use-toast";

// Price ID do Stripe - substitua pelo seu Price ID real
// Você pode obter isso no Stripe Dashboard → Products → Seu Produto → Price ID
const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_PLATFORM; // Configure no .env.local

export default function PaywallPlatform() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();
  
  const [subscriptionStatus, setSubscriptionStatus] = useState<'free' | 'premium' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const sessionId = searchParams.get('session_id');

  // Verificar status de assinatura do usuário
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.id) return;

      setIsCheckingStatus(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('subscription_platform_status')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching subscription status:', error);
        } else {
          // Type assertion necessário porque subscription_platform_status pode não estar nos tipos gerados
          const status = (data as any)?.subscription_platform_status;
          setSubscriptionStatus(status === 'premium' ? 'premium' : 'free');
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkSubscriptionStatus();
  }, [user?.id, supabase]);

  // Tratamento de retorno do Stripe Checkout
  useEffect(() => {
    if (success && sessionId) {
      toast({
        title: "Pagamento realizado com sucesso!",
        description: "Sua assinatura premium foi ativada. Recarregue a página para ver as mudanças.",
        variant: "default",
      });
      
      // Recarregar status após alguns segundos (dar tempo para o webhook processar)
      setTimeout(() => {
        if (user?.id) {
          supabase
            .from('users')
            .select('subscription_platform_status')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
              if (data) {
                const status = (data as any)?.subscription_platform_status;
                setSubscriptionStatus(status === 'premium' ? 'premium' : 'free');
                if (status === 'premium') {
                  navigate('/nba-players');
                }
              }
            });
        }
      }, 3000);
    }

    if (canceled) {
      toast({
        title: "Pagamento cancelado",
        description: "Você cancelou o processo de pagamento. Tente novamente quando estiver pronto.",
        variant: "default",
      });
    }
  }, [success, canceled, sessionId, user?.id, supabase, navigate]);

  const handleStripeCheckout = async () => {
    // Se ainda está carregando a autenticação, aguarde
    if (authLoading) {
      return;
    }

    // Se não está logado, redireciona para login
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Por favor, faça login para continuar com o pagamento.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    setIsLoading(true);
    try {
      //console.log('STRIPE_PRICE_ID', STRIPE_PRICE_ID);
      const { url } = await stripeService.createCheckoutSession(STRIPE_PRICE_ID, 'platform');
      await stripeService.redirectToCheckout(url);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Erro ao processar pagamento",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao iniciar o checkout. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    // Open WhatsApp with pre-filled message for upgrade
    const message = "Oi, gostaria de fazer upgrade do meu plano Smartbetting";
    const whatsappUrl = `https://wa.me/554391482828?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp with pre-filled message
    window.open(whatsappUrl, '_blank');
  };

  // Se o usuário já é premium, mostrar mensagem diferente
  if (subscriptionStatus === 'premium' && !isCheckingStatus) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto flex items-center justify-between px-4 py-6 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <span className="text-lg sm:text-2xl font-bold text-foreground">Smart Betting</span>
            </div>
            <Button 
              onClick={() => navigate("/bets")} 
              className="bg-gradient-primary hover:opacity-90 text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              Dashboard
            </Button>
          </div>
        </nav>

        <div className="container mx-auto px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <CardTitle className="text-2xl">Você já é Premium!</CardTitle>
                </div>
                <CardDescription>
                  Sua assinatura está ativa. Aproveite todos os benefícios do plano premium.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => navigate("/bets")}
                  className="w-full bg-gradient-primary hover:opacity-90"
                  size="lg"
                >
                  Ir para Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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
              <BarChart3 className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Acesso à Plataforma Premium
            </h1>
            <p className="text-xl text-muted-foreground">
              Desbloqueie análises avançadas e insights exclusivos para melhorar suas estratégias
            </p>
            {isCheckingStatus && (
              <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Verificando status da assinatura...</span>
              </div>
            )}
          </div>

          {/* Main Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Desbloqueie Análises Avançadas</CardTitle>
              <CardDescription>
                Assine o plano premium e tenha acesso completo à plataforma de análise
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Features */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mt-0.5">
                      <BarChart3 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Análises Detalhadas</p>
                      <p className="text-sm text-muted-foreground">
                        Acesse análises profundas e estatísticas avançadas de jogadores e times
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mt-0.5">
                      <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Insights Exclusivos</p>
                      <p className="text-sm text-muted-foreground">
                        Receba insights e recomendações personalizadas baseadas em dados
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

                {/* CTA Buttons */}
                <div className="pt-6 border-t space-y-3">
                  {/* Botão Stripe Checkout (Principal) */}
                  <Button 
                    onClick={handleStripeCheckout}
                    disabled={isLoading || authLoading}
                    className="w-full bg-gradient-primary hover:opacity-90 text-lg py-6 gap-2 disabled:opacity-50"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Processando...</span>
                      </>
                    ) : authLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Verificando autenticação...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5" />
                        <span>Assinar Premium Agora</span>
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </Button>

                  {/* Botão WhatsApp (Alternativa) */}
                  <Button 
                    onClick={handleUpgrade}
                    variant="outline"
                    className="w-full text-lg py-6 gap-2"
                    size="lg"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span>Ou entre em contato via WhatsApp</span>
                  </Button>

                  {!user && (
                    <p className="text-sm text-muted-foreground text-center">
                      <Button
                        variant="link"
                        onClick={() => navigate('/auth')}
                        className="p-0 h-auto text-primary"
                      >
                        Faça login
                      </Button>
                      {" "}para continuar com o pagamento
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                Com o plano premium, você tem acesso completo a todas as funcionalidades da plataforma de análise.
                Cancele quando quiser, sem compromisso.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

