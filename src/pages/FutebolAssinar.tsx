import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Lock } from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Button } from '@/components/ui/button';
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

const INCLUI = [
  'O pick de valor de cada oportunidade, com o porquê do lado',
  'Score de Confiabilidade de 0 a 100 em todos os jogos',
  'Brasil, América do Sul e Europa — as principais competições',
  'Alertas no Telegram quando as oportunidades do dia saem',
  'Betinho ilimitado pra registrar suas apostas',
];

export default function FutebolAssinar() {
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
    toast({ title: 'Pagamento recebido!', description: 'Confirmando sua assinatura...' });

    const verificar = async (tentativa: number) => {
      if (cancelado) return;
      try {
        const r = await stripeService.verifySession(sessionId);
        if (r.verified) {
          setAssinouAgora(true);
          await refetchAccess();
          toast({ title: 'Assinatura ativa!', description: 'Bom proveito. Te levando pras oportunidades...' });
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
  }, [success, sessionId, user?.id, navigate, refetchAccess]);

  useEffect(() => {
    if (canceled) {
      toast({
        title: 'Pagamento cancelado',
        description: 'Nada foi cobrado. Quando quiser, é só voltar aqui.',
      });
    }
  }, [canceled]);

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
        title: 'Assinatura indisponível',
        description: 'Não conseguimos abrir o pagamento agora. Fala com a gente que resolvemos.',
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
        title: 'Erro ao abrir o pagamento',
        description: error instanceof Error ? error.message : 'Tente de novo em instantes.',
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
  const diasRestantes = access?.days_left ?? 0;

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
              {expirou ? 'Seu teste grátis acabou.' : 'Assinar o Futebol'}
            </h1>
            <p className="text-[15px] text-ink-2">
              {expirou
                ? 'A análise continua livre pra você. Só o pick de valor de cada oportunidade é que fica com assinante.'
                : noTeste
                  ? `Você ainda tem ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'} de teste. Assinando agora, não perde o acesso quando acabar.`
                  : 'O pick de valor de cada jogo, com o porquê do lado.'}
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-lg font-bold opacity-60">R$</span>
              <span className="text-[42px] font-extrabold leading-none tracking-tight tabular-nums">39,90</span>
              <span className="text-[15px] text-ink-2">/mês</span>
            </div>
            <p className="text-[13px] text-ink-2 mb-6">Cancela quando quiser, direto no app.</p>

            <ul className="space-y-3 mb-7">
              {INCLUI.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-forest shrink-0 mt-0.5" />
                  <span className="text-[14px] text-ink-2">{item}</span>
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
                  <span>{isLoading ? 'Abrindo o pagamento...' : 'Verificando...'}</span>
                </>
              ) : (
                <span>{user ? 'Assinar o Futebol' : 'Criar conta e assinar'}</span>
              )}
            </Button>

            <p className="text-[12px] text-ink-3 text-center mt-4">
              Pagamento no Stripe. A gente não guarda os dados do seu cartão.
            </p>
          </div>

          <p className="text-[13px] text-ink-2 text-center mt-8">
            Não é recomendação de aposta, e não existe promessa de lucro. A gente mostra onde a odd
            paga mais do que o risco — quem bate o martelo é você.
          </p>
        </div>
      </div>
    </div>
  );
}
