import { useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, BarChart3, ArrowRight, MessageCircle, CheckCircle, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { whatsappDoTime } from "@/config/contato";
import { createClient } from "@/integrations/supabase/client";
import { stripeService } from "@/services/stripe.service";
import { toast } from "@/hooks/use-toast";
import { SeletorDeIdiomaCompacto } from '@/components/SeletorDeIdioma';

// Price ID do Stripe para a Plataforma de Análises
const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_PLATFORM; // Configure no .env.local

/**
 * Paywall da plataforma de análise (rota /paywall-platform). Tela pública: a
 * copy vem do catálogo `planos` no idioma ativo (#540).
 *
 * ⚠️ A mensagem pré-preenchida do WhatsApp segue em português de propósito:
 * ela é escrita PARA o time de suporte, e texto de WhatsApp está fora do
 * escopo do #532, que é interface.
 */
export default function PaywallPlatform() {
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

  // Verificar status de assinatura do usuário
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.id) return;

      setIsCheckingStatus(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('analytics_subscription_status')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching subscription status:', error);
        } else {
          const status = (data as any)?.analytics_subscription_status;
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
            setTimeout(() => navigate('/home-nba'), 1000);
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
  }, [success, canceled, sessionId, user?.id, navigate, t]);

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
        throw new Error('Price ID não configurado. Verifique a variável de ambiente VITE_STRIPE_PRICE_ID_PLATFORM.');
      }
      const { url } = await stripeService.createCheckoutSession(STRIPE_PRICE_ID, 'analytics');
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
    // Open WhatsApp with pre-filled message for upgrade (Plataforma de Análise)
    const message = t('checkout.whatsappUpgradePlataforma');
    const whatsappUrl = whatsappDoTime(message);

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
              <span className="text-lg sm:text-2xl font-bold text-foreground">Smartbetting</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
            <SeletorDeIdiomaCompacto tom="claro" />
            <Button
              onClick={() => navigate("/bets")}
              className="bg-gradient-primary hover:opacity-90 text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              {t('paywallPlataforma.dashboard')}
            </Button>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 sm:px-6 py-20">
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <CardTitle className="text-2xl">{t('paywallPlataforma.jaPremium.titulo')}</CardTitle>
                </div>
                <CardDescription>
                  {t('paywallPlataforma.jaPremium.texto')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate("/bets")}
                  className="w-full bg-gradient-primary hover:opacity-90"
                  size="lg"
                >
                  {t('paywallPlataforma.jaPremium.acao')}
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
            <span className="text-lg sm:text-2xl font-bold text-foreground">Smartbetting</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Sem usuário não há menu da conta, e é lá que o idioma mora.
                Esta tela tem cabeçalho próprio, então precisa do seu. */}
            <SeletorDeIdiomaCompacto tom="claro" />
            <Button
              variant="outline"
              onClick={() => navigate("/auth")}
              className="text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              {t('comum:acoes.entrar')}
            </Button>
            <Button
              onClick={() => navigate("/bets")}
              className="bg-gradient-primary hover:opacity-90 text-sm sm:text-base px-3 sm:px-4 py-2"
            >
              {t('paywallPlataforma.dashboard')}
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
              {t('paywallPlataforma.titulo')}
            </h1>
            <p className="text-xl text-muted-foreground">
              {t('paywallPlataforma.chamada')}
            </p>
            {isCheckingStatus && (
              <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">{t('checkout.verificandoAssinatura')}</span>
              </div>
            )}
          </div>

          {/* Main Card */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">{t('paywallPlataforma.cartaoTitulo')}</CardTitle>
              <CardDescription>
                {t('paywallPlataforma.cartaoChamada')}
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
                      <p className="font-semibold text-foreground">{t('paywallPlataforma.itens.analises.titulo')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('paywallPlataforma.itens.analises.texto')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mt-0.5">
                      <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{t('paywallPlataforma.itens.insights.titulo')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('paywallPlataforma.itens.insights.texto')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mt-0.5">
                      <ArrowRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{t('paywallPlataforma.itens.suporte.titulo')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('paywallPlataforma.itens.suporte.texto')}
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
                        <span>{t('paywallPlataforma.acao')}</span>
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
                    <span>{t('checkout.whatsappContato')}</span>
                  </Button>

                  {!user && (
                    <p className="text-sm text-muted-foreground text-center">
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
                            className="p-0 h-auto text-primary"
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
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                {t('paywallPlataforma.rodape')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
