import { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Zap, BarChart3, ArrowRight, MessageCircle, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { whatsappDoTime } from "@/config/contato";
import { createClient } from "@/integrations/supabase/client";
import { stripeService } from "@/services/stripe.service";
import { toast } from "@/hooks/use-toast";
import AnalyticsNav from "@/components/AnalyticsNav";

// Price ID do Stripe - substitua pelo seu Price ID real
// Você pode obter isso no Stripe Dashboard → Products → Seu Produto → Price ID
const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_BETINHO; // Configure no .env.local

/**
 * Paywall do Betinho (rota /paywall). Tela pública: a copy vem do catálogo
 * `planos` no idioma ativo (#540).
 *
 * ⚠️ A mensagem pré-preenchida do WhatsApp segue em português de propósito:
 * ela é escrita PARA o time de suporte, e texto de WhatsApp está fora do
 * escopo do #532, que é interface.
 */
export default function Paywall() {
  const { t } = useTranslation('planos');
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
    // Se ainda está carregando a autenticação, aguarde
    if (authLoading) {
      return;
    }

    // Se não está logado, redireciona para login
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

      console.log('Creating checkout session with Price ID:', STRIPE_PRICE_ID);
      const { url } = await stripeService.createCheckoutSession(STRIPE_PRICE_ID, 'betinho');
      await stripeService.redirectToCheckout(url);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: t('checkout.erroTitulo'),
        description: t('checkout.erroTexto'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    // Open WhatsApp with pre-filled message for upgrade (Betinho)
    const message = t('checkout.whatsappUpgradeBetinho');
    const whatsappUrl = whatsappDoTime(message);

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
            {t('paywall.titulo')}
          </h1>
          <p className="text-base text-ink-2">
            {t('paywall.textoUm')}
            <br />
            {t('paywall.textoDois')}
          </p>
          {isCheckingStatus && (
            <div className="mt-4 flex items-center justify-center gap-2 text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('checkout.verificandoAssinatura')}</span>
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Main Card */}
          <Card className="mb-8 bg-white border border-line">
            <CardHeader>
              <CardTitle className="text-2xl text-ink">{t('paywall.cartaoTitulo')}</CardTitle>
              <CardDescription className="text-ink-2">
                {t('paywall.cartaoChamada')}
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
                      <p className="font-semibold text-ink">{t('paywall.itens.registro.titulo')}</p>
                      <p className="text-sm text-ink-2">
                        {t('paywall.itens.registro.texto')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-forest/10 flex items-center justify-center mt-0.5">
                      <BarChart3 className="h-4 w-4 text-forest" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{t('paywall.itens.dashboard.titulo')}</p>
                      <p className="text-sm text-ink-2">
                        {t('paywall.itens.dashboard.texto')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-forest/10 flex items-center justify-center mt-0.5">
                      <ArrowRight className="h-4 w-4 text-forest" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{t('paywall.itens.historico.titulo')}</p>
                      <p className="text-sm text-ink-2">
                        {t('paywall.itens.historico.texto')}
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
                        <span>{t('checkout.processando')}</span>
                      </>
                    ) : authLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>{t('checkout.verificandoAuth')}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5" />
                        <span>{t('paywall.acao')}</span>
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </Button>

                  {/* Botão WhatsApp (Alternativa) */}
                  <Button
                      onClick={handleUpgrade}
                      variant="outline"
                      className="w-full py-6 gap-2 bg-white border-line text-ink hover:bg-canvas-2 hover:text-ink"
                      size="lg"
                    >
                      <MessageCircle className="h-5 w-5" />
                      <span className="text-sm sm:text-lg text-center">
                        {t('checkout.whatsapp')}
                      </span>
                    </Button>

                  {!user && (
                    <p className="text-sm text-ink-2 text-center">
                      {/* `Trans`, e não concatenação: o link cai NO MEIO da frase,
                          e em outro idioma ele cai em outro lugar. */}
                      <Trans
                        t={t}
                        i18nKey="checkout.loginParaPagar"
                        components={[
                          <Button
                            key="login"
                            variant="link"
                            onClick={() => navigate('/auth')}
                            className="p-0 h-auto text-forest"
                          />,
                        ]}
                      />
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
                {t('paywall.rodape')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
