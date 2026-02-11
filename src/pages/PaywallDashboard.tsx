import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, MessageCircle, Loader2, Check, BarChart2, Database, FileText } from "lucide-react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/integrations/supabase/client";
import { stripeService } from "@/services/stripe.service";
import { toast } from "@/hooks/use-toast";

const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_BETINHO;

export default function PaywallDashboard() {
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

  useEffect(() => {
    if (success && sessionId) {
      toast({
        title: "Pagamento realizado com sucesso!",
        description: "Sua assinatura premium foi ativada. Recarregue a página para ver as mudanças.",
        variant: "default",
      });

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
  }, [success, canceled, sessionId, user?.id, supabase, navigate, redirectAfterPremium]);

  const handleStripeCheckout = async () => {
    if (authLoading) return;

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

  const handleWhatsApp = () => {
    const message = "Oi, gostaria de fazer upgrade do meu plano Smartbetting para acessar o Dashboard Premium";
    const whatsappUrl = `https://wa.me/554391482828?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (subscriptionStatus === 'premium' && !isCheckingStatus) {
    return <Navigate to={redirectAfterPremium} replace />;
  }

  const features = [
    {
      icon: Check,
      iconColor: "text-terminal-green",
      title: "Visão completa dos resultados",
      description: "Lucro, prejuízo, ROI e evolução da banca em tempo real.",
    },
    {
      icon: BarChart2,
      iconColor: "text-terminal-blue",
      title: "Análise por esporte, liga e mercado",
      description: "Entenda exatamente onde você ganha e onde perde dinheiro.",
    },
    {
      icon: Database,
      iconColor: "text-terminal-text",
      title: "Registro ilimitado de apostas",
      description: "Registre quantas apostas quiser, sem limites diários.",
    },
    {
      icon: FileText,
      iconColor: "text-terminal-blue",
      title: "Decisões baseadas em dados",
      description: "Ajuste sua estratégia com base em números, não em feeling.",
    },
  ];

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text">
      {/* Header */}
      <div className="container mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-12 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-terminal-text mb-4">
            Você está a um passo da gestão completa
          </h1>
          <p className="text-base text-terminal-text/80 mb-2">
            O dashboard mostra exatamente onde você está ganhando e onde está perdendo dinheiro.
          </p>
          <p className="text-sm text-terminal-text/60">
            No plano gratuito, essa visão fica bloqueada.
          </p>
          {isCheckingStatus && (
            <div className="mt-4 flex items-center justify-center gap-2 text-terminal-text/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Verificando status da assinatura...</span>
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Left: Locked Dashboard Preview */}
          <div className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg overflow-hidden">
            <div className="p-4">
              <p className="text-sm text-terminal-text">
                Esse dashboard mostra exatamente onde você ganha e onde perde dinheiro.
              </p>
            </div>
            <div className="relative aspect-video overflow-hidden">
              <img
                src="/Dashboard.jpeg"
                alt="Dashboard Premium - preview bloqueado"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <p className="text-center font-bold text-white px-4 mb-4 text-sm md:text-base">
                  Identifique padrões, erros recorrentes e oportunidades de ajuste.
                </p>
                <Lock className="w-16 h-16 text-white mb-4" strokeWidth={2} />
              </div>
            </div>
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-terminal-text/60">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Dados completos disponíveis apenas no plano Premium</span>
            </div>
          </div>

          {/* Right: Premium Features & CTAs */}
          <div className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-6 flex flex-col">
            <h2 className="text-xl font-bold text-terminal-text mb-2">
              Desbloqueie o Dashboard Premium
            </h2>
            <p className="text-sm text-terminal-text/70 mb-6">
              Apostar sem análise é jogar no escuro.
            </p>

            <div className="space-y-4 flex-1">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                <div key={feature.title} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-terminal-gray flex items-center justify-center mt-0.5 ${feature.iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-terminal-text text-sm">{feature.title}</p>
                    <p className="text-xs text-terminal-text/70">{feature.description}</p>
                  </div>
                </div>
                );
              })}
            </div>

            <div className="pt-6 space-y-3">
              <Button
                onClick={handleStripeCheckout}
                disabled={isLoading || authLoading}
                variant="outline"
                className="w-full py-6 gap-2 border-terminal-border hover:bg-terminal-gray text-terminal-text disabled:opacity-50 text-base"
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
                    <span>Acessar o Dashboard Agora</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>

              <Button
                onClick={handleWhatsApp}
                variant="outline"
                className="w-full py-6 gap-2 border-terminal-border hover:bg-terminal-gray text-terminal-text text-base"
                size="lg"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Ou fale com a gente pelo WhatsApp</span>
              </Button>

              <p className="text-xs text-terminal-text/50 text-center pt-2">
                Pagamento via Pix ou dúvidas rápidas.
              </p>

              {!user && (
                <p className="text-xs text-terminal-text/60 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/auth')}
                    className="underline hover:text-terminal-green transition-colors"
                  >
                    Faça login
                  </button>
                  {" "}para continuar com o pagamento
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
