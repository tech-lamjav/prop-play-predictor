import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Zap, BarChart3, ArrowRight, ArrowLeft, MessageCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/integrations/supabase/client";
import { stripeService } from "@/services/stripe.service";
import { toast } from "@/hooks/use-toast";
import AnalyticsNav from "@/components/AnalyticsNav";

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
    if (success && sessionId && user?.id) {
      toast({
        title: "Pagamento realizado!",
        description: "Verificando sua assinatura...",
        variant: "default",
      });

      let cancelled = false;

      const verify = async (attempt: number) => {
        if (cancelled) return;
        try {
          const result = await stripeService.verifySession(sessionId);
          if (result.verified) {
            setSubscriptionStatus('premium');
            toast({
              title: "Assinatura ativada!",
              description: "Seu plano premium está ativo. Redirecionando...",
              variant: "default",
            });
            setTimeout(() => navigate(redirectAfterPremium), 1000);
            return;
          }
        } catch (err) {
          console.error('Error verifying session:', err);
        }

        if (!cancelled && attempt < 5) {
          setTimeout(() => verify(attempt + 1), 2000);
        }
      };

      verify(0);

      return () => { cancelled = true; };
    }

    if (canceled) {
      toast({
        title: "Pagamento cancelado",
        description: "Você cancelou o processo de pagamento. Tente novamente quando estiver pronto.",
        variant: "default",
      });
    }
  }, [success, canceled, sessionId, user?.id, navigate]);

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
    // Open WhatsApp with pre-filled message for upgrade (Betinho)
    const message = "Oi, gostaria de fazer upgrade do meu plano Betinho (registro de apostas)";
    const whatsappUrl = `https://wa.me/5511952136845?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp with pre-filled message
    window.open(whatsappUrl, '_blank');
  };

  // Se o usuário já é premium, redirecionar direto para o destino
  if (subscriptionStatus === 'premium' && !isCheckingStatus) {
    return <Navigate to={redirectAfterPremium} replace />;
  }

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink flex flex-col">
      <AnalyticsNav variant="rebrand" showBack />

      <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 flex-1">
        {/* Header */}
        <div className="text-center mb-12 max-w-4xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-forest mb-6">
            <Lock className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-4">
            Você chegou ao limite do plano gratuito!
          </h1>
          <p className="text-base text-ink-2">
            O plano gratuito é ideal para começar. 
            <br />
            Para continuar registrando apostas e acompanhar seus resultados, faça upgrade para o plano premium.
          </p>
          {isCheckingStatus && (
            <div className="mt-4 flex items-center justify-center gap-2 text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Verificando status da assinatura...</span>
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Main Card */}
          <Card className="mb-8 bg-white border border-line">
            <CardHeader>
              <CardTitle className="text-2xl text-ink">Desbloqueie o Plano Premium</CardTitle>
              <CardDescription className="text-ink-2">
                Apostar mais exige mais controle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Features */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-forest/10 flex items-center justify-center mt-0.5">
                      <Zap className="h-4 w-4 text-forest" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">Registro ilimitado de apostas</p>
                      <p className="text-sm text-ink-2">
                        Registre quantas apostas quiser, sem limites diários
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-forest/10 flex items-center justify-center mt-0.5">
                      <BarChart3 className="h-4 w-4 text-forest" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">Dashboard Completo de gestão de apostas</p>
                      <p className="text-sm text-ink-2">
                        Visualize lucro, prejuízo, ROI e evolução da sua banca em um só lugar
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-forest/10 flex items-center justify-center mt-0.5">
                      <ArrowRight className="h-4 w-4 text-forest" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">Histórico e organização</p>
                      <p className="text-sm text-ink-2">
                        Tenha todas as apostas organizadas para analisar padrões e decisões
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="pt-6 border-t border-line space-y-3">
                  {/* Botão Stripe Checkout (Principal) */}
                  <Button
                    onClick={handleStripeCheckout}
                    disabled={isLoading || authLoading}
                    className="w-full py-6 gap-2 disabled:opacity-50 text-lg bg-forest hover:bg-forest-soft text-white"
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
                        <span>Desbloquear Plano Premium</span>
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </Button>

                  {/* Botão WhatsApp (Alternativa) */}
                  <Button
                      onClick={handleUpgrade}
                      variant="outline"
                      className="w-full py-6 gap-2 bg-white border-line text-ink hover:bg-canvas-2"
                      size="lg"
                    >
                      <MessageCircle className="h-5 w-5" />
                      <span className="text-sm sm:text-lg text-center">
                        Ou fale com a gente pelo WhatsApp
                      </span>
                    </Button>

                  {!user && (
                    <p className="text-sm text-ink-2 text-center">
                      <Button
                        variant="link"
                        onClick={() => navigate('/auth')}
                        className="p-0 h-auto text-forest"
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
          <Card className="bg-canvas-2 border border-line">
            <CardContent className="pt-6">
              <p className="text-sm text-ink-2 text-center">
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

