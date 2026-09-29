import { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, ArrowLeft, MessageCircle, Loader2, Check, BarChart2, Database, FileText, BarChart3 } from "lucide-react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { whatsappDoTime } from "@/config/contato";
import { createClient } from "@/integrations/supabase/client";
import { stripeService } from "@/services/stripe.service";
import { toast } from "@/hooks/use-toast";

const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_BETINHO;

/**
 * Paywall do dashboard de apostas (rota /paywall-dashboard). Tela pública: a
 * copy vem do catálogo `planos` no idioma ativo (#540).
 *
 * ⚠️ A mensagem pré-preenchida do WhatsApp segue em português de propósito:
 * ela é escrita PARA o time de suporte, e texto de WhatsApp está fora do
 * escopo do #532, que é interface.
 */
export default function PaywallDashboard() {
  const { t } = useTranslation(['planos', 'comum']);
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
    if (success && sessionId && user?.id) {
      toast({
        title: t('checkout.pagoTitulo'),
        description: t('checkout.pagoTexto'),
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
              title: t('checkout.ativaTitulo'),
              description: t('checkout.ativaTexto'),
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
        title: t('checkout.canceladoTitulo'),
        description: t('checkout.canceladoTexto'),
        variant: "default",
      });
    }
  }, [success, canceled, sessionId, user?.id, navigate, redirectAfterPremium, t]);

  const handleStripeCheckout = async () => {
    if (authLoading) return;

    if (!user) {
      toast({
        title: t('checkout.loginTitulo'),
        description: t('checkout.loginTexto'),
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
        title: t('checkout.erroTitulo'),
        description: error instanceof Error ? error.message : t('checkout.erroTexto'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWhatsApp = () => {
    const message = "Oi, gostaria de fazer upgrade do meu plano Smartbetting para acessar o Dashboard Premium";
    const whatsappUrl = whatsappDoTime(message);
    window.open(whatsappUrl, '_blank');
  };

  if (subscriptionStatus === 'premium' && !isCheckingStatus) {
    return <Navigate to={redirectAfterPremium} replace />;
  }

  const features = [
    {
      icon: Check,
      iconColor: "text-terminal-green",
      chave: "visao",
    },
    {
      icon: BarChart2,
      iconColor: "text-terminal-green",
      chave: "analise",
    },
    {
      icon: Database,
      iconColor: "text-terminal-green",
      chave: "registro",
    },
    {
      icon: FileText,
      iconColor: "text-terminal-green",
      chave: "decisao",
    },
  ];

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text">
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
              onClick={() => navigate("/bets")}
              className="text-sm sm:text-base px-3 sm:px-4 py-2 bg-muted text-foreground border-border hover:bg-muted/80"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('paywallDashboard.voltar')}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/auth")}
              className="text-sm sm:text-base px-3 sm:px-4 py-2 bg-muted text-foreground border-border hover:bg-muted/80"
            >
              {t('comum:acoes.entrar')}
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-12 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-terminal-text mb-4">
            {t('paywallDashboard.titulo')}
          </h1>
          <p className="text-base text-terminal-text/80 mb-2">
            {t('paywallDashboard.textoUm')}
          </p>
          <p className="text-sm text-terminal-text/60">
            {t('paywallDashboard.textoDois')}
          </p>
          {isCheckingStatus && (
            <div className="mt-4 flex items-center justify-center gap-2 text-terminal-text/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('checkout.verificandoAssinatura')}</span>
            </div>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Left: Locked Dashboard Preview */}
          <div className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg overflow-hidden">
            <div className="p-4">
              <br />
            </div>
            <div className="relative aspect-video overflow-hidden">
              <img
                src="/Dashboard.jpeg"
                alt={t('paywallDashboard.previaAlt')}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                <p className="text-center font-bold text-white px-4 mb-4 text-sm md:text-base">
                  {t('paywallDashboard.previaTexto')}
                </p>
                <Lock className="w-16 h-16 text-white mb-4" strokeWidth={2} />
              </div>
            </div>
            <div className="p-4 flex items-center justify-center gap-2 text-xs text-terminal-text/60">
              <Lock className="w-4 h-4 shrink-0" />
              <span>{t('paywallDashboard.previaRodape')}</span>
            </div>
          </div>

          {/* Right: Premium Features & CTAs */}
          <div className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-6 flex flex-col">
            <h2 className="text-xl font-bold text-terminal-text mb-2">
              {t('paywallDashboard.cartaoTitulo')}
            </h2>
            <p className="text-sm text-terminal-text/70 mb-6">
              {t('paywallDashboard.cartaoChamada')}
            </p>

            <div className="space-y-4 flex-1">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                <div key={feature.chave} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full bg-terminal-gray flex items-center justify-center mt-0.5 ${feature.iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-terminal-text text-base">{t(`paywallDashboard.itens.${feature.chave}.titulo`)}</p>
                    <p className="text-xs text-terminal-text/70">{t(`paywallDashboard.itens.${feature.chave}.texto`)}</p>
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
                    <span>{t('checkout.processando')}</span>
                  </>
                ) : authLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{t('checkout.verificandoAuth')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('paywallDashboard.acao')}</span>
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
                <span>{t('checkout.whatsapp')}</span>
              </Button>

              <p className="text-xs text-terminal-text/50 text-center pt-2">
                {t('paywallDashboard.rodape')}
              </p>

              {!user && (
                <p className="text-xs text-terminal-text/60 text-center">
                  {/* `Trans`, e não concatenação: o link cai NO MEIO da frase,
                      e em outro idioma ele cai em outro lugar. */}
                  <Trans
                    t={t}
                    i18nKey="checkout.loginParaPagar"
                    components={[
                      <button
                        key="login"
                        type="button"
                        onClick={() => navigate('/auth')}
                        className="underline hover:text-terminal-green transition-colors"
                      />,
                    ]}
                  />
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
