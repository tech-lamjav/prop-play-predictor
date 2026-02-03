import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Zap, BarChart3, ArrowRight, MessageCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/integrations/supabase/client";
import { stripeService } from "@/services/stripe.service";
import { toast } from "@/hooks/use-toast";

// Price ID do Stripe - substitua pelo seu Price ID real
// Você pode obter isso no Stripe Dashboard → Products → Seu Produto → Price ID
const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_BETINHO; // Configure no .env.local

export default function Paywall() {
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
  const from = searchParams.get('from');

  const ALLOWED_REDIRECT_PATHS = ['/betting-dashboard'];
  const redirectAfterPremium = from && ALLOWED_REDIRECT_PATHS.includes(from) ? from : '/bets';

  // Verificar status de assinatura do usuário (Betinho)
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.id) return;

      setIsCheckingStatus(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('betinho_subscription_status')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching Betinho subscription status:', error);
        } else {
          // Type assertion necessário porque betinho_subscription_status pode não estar nos tipos gerados
          const status = (data as any)?.betinho_subscription_status;
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
            .select('betinho_subscription_status')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
              if (data) {
                const status = (data as any)?.betinho_subscription_status;
                setSubscriptionStatus(status === 'premium' ? 'premium' : 'free');
                if (status === 'premium') {
                  navigate(redirectAfterPremium);
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
      if (!STRIPE_PRICE_ID) {
        throw new Error('Price ID não configurado. Verifique a variável de ambiente VITE_STRIPE_PRICE_ID_BETINHO.');
      }
      
      console.log('Creating checkout session with Price ID:', STRIPE_PRICE_ID);
      const { url } = await stripeService.createCheckoutSession(STRIPE_PRICE_ID, 'betinho');
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

  // Se o usuário já é premium, redirecionar direto para o destino
  if (subscriptionStatus === 'premium' && !isCheckingStatus) {
    return <Navigate to={redirectAfterPremium} replace />;
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
              onClick={() => navigate(redirectAfterPremium)} 
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
              Você atingiu seu limite diário de apostas.
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
                O limite diário é resetado automaticamente à meia-noite (horário GMT-3).
                Você pode continuar usando o plano gratuito ou fazer upgrade para apostas ilimitadas.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

