import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Lock, MessageCircle } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { restanteDoTeste } from '@/components/futebol/tempo-de-teste';
import { Button } from '@/components/ui/button';
import { whatsappDoTime } from '@/config/contato';
import { useAuth } from '@/hooks/use-auth';
import { useFutebolAccess } from '@/hooks/use-futebol-data';
import { stripeService } from '@/services/stripe.service';
import { toast } from '@/hooks/use-toast';
import { Seo } from '@/components/Seo';

// ============================================================
// FutebolAssinar — checkout do módulo de Futebol.
//
// Antes esta rota era um Navigate pra /planos, que não tem gateway plugado: o
// botão de assinar é no-op pra quem está logado. Quem terminava o teste de 7
// dias batia num beco — e o Betinho/WhatsApp mandavam o mesmo caminho.
//
// O produto do futebol grava `futebol_subscription_status` (productType
// 'futebol'), que é o campo que o `get_futebol_access` lê. Os outros dois
// produtos (Betinho, analytics/NBA) seguem apartados, cada um no seu campo.
// ============================================================

const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID_FUTEBOL as string | undefined;

/** O que a assinatura inclui, por CHAVE — o texto sai do catálogo (#538). */
const INCLUI = [
  'assinar.inclui.pickDeValor',
  'assinar.inclui.score',
  'assinar.inclui.competicoes',
  'assinar.inclui.alertas',
  'assinar.inclui.betinho',
] as const;

export default function FutebolAssinar() {
  const { t } = useTranslation('futebol');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { data: access, refetch: refetchAccess } = useFutebolAccess();

  const [isLoading, setIsLoading] = useState(false);
  const [assinouAgora, setAssinouAgora] = useState(false);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const sessionId = searchParams.get('session_id');

  // Volta do Stripe: confirma o pagamento e libera. O webhook também grava, mas
  // ele pode chegar depois do redirect — por isso a verificação aqui, com
  // retry: quem acabou de pagar não pode ver "assine" na volta.
  useEffect(() => {
    if (!success || !sessionId || !user?.id) return;

    let cancelado = false;
    toast({ title: t('assinar.toast.recebidoTitulo'), description: t('assinar.toast.recebidoTexto') });

    const verificar = async (tentativa: number) => {
      if (cancelado) return;
      try {
        const r = await stripeService.verifySession(sessionId);
        if (r.verified) {
          setAssinouAgora(true);
          await refetchAccess();
          toast({ title: t('assinar.toast.ativaTitulo'), description: t('assinar.toast.ativaTexto') });
          setTimeout(() => navigate('/futebol/oportunidades'), 1200);
          return;
        }
      } catch (err) {
        console.error('Erro ao verificar sessão:', err);
      }
      if (!cancelado && tentativa < 5) setTimeout(() => verificar(tentativa + 1), 2000);
    };

    verificar(0);
    return () => { cancelado = true; };
  }, [success, sessionId, user?.id, navigate, refetchAccess, t]);

  useEffect(() => {
    if (canceled) {
      toast({
        title: t('assinar.toast.canceladoTitulo'),
        description: t('assinar.toast.canceladoTexto'),
      });
    }
  }, [canceled, t]);

  // A mensagem já vem escrita, como no resto do app: diz de onde a pessoa veio,
  // senão a conversa começa com um "oi" solto e o time gasta uma rodada só para
  // descobrir o assunto. O número vive em `config/contato` — nunca literal aqui.
  const falarNoWhatsApp = () => {
    window.open(whatsappDoTime(t('assinar.whatsappMensagem')), '_blank');
  };

  const assinar = async () => {
    if (authLoading) return;

    if (!user) {
      // Volta pra cá depois do login, em vez de largar o usuário no /inicio.
      navigate('/auth', { state: { from: { pathname: '/futebol/assinar' } } });
      return;
    }

    if (!STRIPE_PRICE_ID) {
      // Falha de configuração: dizer isso em vez de fingir que o clique funcionou.
      console.error('VITE_STRIPE_PRICE_ID_FUTEBOL não configurado');
      toast({
        title: t('assinar.toast.indisponivelTitulo'),
        description: t('assinar.toast.indisponivelTexto'),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { url } = await stripeService.createCheckoutSession(STRIPE_PRICE_ID, 'futebol');
      await stripeService.redirectToCheckout(url);
    } catch (error) {
      console.error('Erro ao criar checkout:', error);
      toast({
        title: t('assinar.toast.erroTitulo'),
        description: error instanceof Error ? error.message : t('assinar.toast.erroTexto'),
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  // Já assinante: não faz sentido ver a tela de venda.
  if (access?.state === 'subscribed' && !assinouAgora) {
    return <Navigate to="/futebol/oportunidades" replace />;
  }

  const expirou = access?.state === 'expired';
  const noTeste = access?.state === 'trial';
  // As PARTES do tempo restante, não a frase pronta: a frase se monta no idioma
  // ativo, e a decisão de contar em dias ou em horas continua num lugar só.
  const restante = restanteDoTeste(access);

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink flex flex-col">
      <Seo route="/futebol/comecar" />
      <AnalyticsNav variant="rebrand" showBack />

      <div className="container mx-auto px-4 sm:px-6 py-14 sm:py-20 flex-1">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forest mb-5">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              {expirou ? t('assinar.tituloExpirou') : t('assinar.titulo')}
            </h1>
            <p className="text-[15px] text-ink-2">
              {expirou
                ? t('assinar.subtituloExpirou')
                : noTeste && restante
                  ? t('assinar.subtituloTeste', {
                      tempo:
                        restante.unidade === 'menosDeUmaHora'
                          ? t('teste.restanteMenosDeUmaHora')
                          : restante.unidade === 'dias'
                            ? t('teste.restanteDias', { count: restante.quantidade })
                            : t('teste.restanteHoras', { count: restante.quantidade }),
                    })
                  : t('assinar.subtituloPadrao')}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-lg font-bold opacity-60">R$</span>
              <span className="text-[42px] font-extrabold leading-none tracking-tight tabular-nums">39,90</span>
              <span className="text-[15px] text-ink-2">{t('assinar.preco.porMes')}</span>
            </div>
            <p className="text-[13px] text-ink-2 mb-6">{t('assinar.preco.cancela')}</p>

            <ul className="space-y-3 mb-7">
              {INCLUI.map((chave) => (
                <li key={chave} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-forest shrink-0 mt-0.5" />
                  <span className="text-[14px] text-ink-2">{t(chave)}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={assinar}
              disabled={isLoading || authLoading}
              size="lg"
              className="w-full py-6 text-base gap-2 bg-forest hover:bg-forest-soft text-white disabled:opacity-50"
            >
              {isLoading || authLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{isLoading ? t('assinar.botao.abrindo') : t('assinar.botao.verificando')}</span>
                </>
              ) : (
                <span>{user ? t('assinar.botao.assinar') : t('assinar.botao.criarConta')}</span>
              )}
            </Button>

            <Button
              onClick={falarNoWhatsApp}
              variant="outline"
              size="lg"
              className="w-full py-6 mt-3 gap-2 bg-white border-line text-ink hover:bg-canvas-2 hover:text-ink"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm sm:text-base text-center">{t('assinar.whatsapp')}</span>
            </Button>

            <p className="text-[12px] text-ink-3 text-center mt-4">
              {t('assinar.stripe')}
            </p>
          </div>

          <p className="text-[13px] text-ink-2 text-center mt-8">
            {t('assinar.rodape')}
          </p>
        </div>
      </div>
    </div>
  );
}
