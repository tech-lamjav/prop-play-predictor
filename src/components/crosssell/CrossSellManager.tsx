import React, { Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { useAuth } from '@/hooks/use-auth';
import { useCrossSellFutebol } from '@/hooks/use-crosssell-futebol';
import { FutebolTeaserModal } from './FutebolTeaserModal';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

// O carrossel traz o embla (~47 kB) junto. Ele é a SEGUNDA etapa do cross-sell:
// só chega aqui quem viu o teaser e clicou nele — uma fração pequena, e nunca
// em /futebol, que está na lista bloqueada logo abaixo. Não há razão para todo
// mundo baixar o carrossel na primeira pintura de toda página.
const FutebolPreviewCarousel = lazyWithRetry(() =>
  import('./FutebolPreviewCarousel').then((m) => ({ default: m.FutebolPreviewCarousel })),
);

/** Destino do CTA — LP interna da Plataforma Futebol. */
const FUTEBOL_LP_ROUTE = '/futebol/comecar';

/**
 * Rotas onde NÃO exibimos o cross-sell: conversão fria / captação, pra não
 * competir com os CTAs próprios dessas páginas. Match por prefixo.
 */
const BLOCKED_PREFIXES = [
  '/auth',
  '/nba',
  '/betinho',
  '/bolao/comecar',
  '/futebol', // a própria LP de destino
  '/paywall',
  '/planos',
  '/waitlist',
  '/privacidade',
  '/termos',
];

function isBlocked(pathname: string): boolean {
  if (pathname === '/') return true; // landing do ecossistema
  return BLOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p),
  );
}

type Stage = 'closed' | 'teaser' | 'preview';

/**
 * Orquestra o cross-sell da Plataforma Futebol no nível global do app:
 * teaser → preview (carrossel) → LP. Monta dentro do BrowserRouter.
 */
export const CrossSellManager: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const { user, isLoading } = useAuth();

  // Override de preview: ?crosssell (qualquer valor) força a aparição ignorando
  // login, rota bloqueada, 1x/dia e opt-out. Só pra testar/demonstrar.
  const forced = new URLSearchParams(location.search).has('crosssell');

  // Fluxo normal: só pra usuário logado e fora das rotas bloqueadas.
  const enabled = forced || (!isLoading && !!user && !isBlocked(location.pathname));

  const { isOpen, dismiss } = useCrossSellFutebol({ enabled, force: forced });

  const [stage, setStage] = useState<Stage>('closed');
  // Uma vez baixado, o carrossel FICA montado — mesmo fechado. Desmontá-lo ao
  // fechar cortaria a animação de saída do Dialog, que hoje existe: quem fecha
  // é o `open` falso, e o Radix precisa seguir na árvore para animar a saída.
  const [carrosselBaixado, setCarrosselBaixado] = useState(false);
  // Opt-out escolhido no teaser, aplicado ao fechar em qualquer etapa.
  const [optOut, setOptOut] = useState(false);

  // O gatilho (1x/dia) abre no teaser.
  useEffect(() => {
    if (isOpen) setStage('teaser');
  }, [isOpen]);

  const closeAll = (dontShowAgain: boolean) => {
    dismiss(dontShowAgain); // persiste opt-out + fecha o gate do hook
    setStage('closed');
  };

  const handleTeaserCta = (dontShowAgain: boolean) => {
    setOptOut(dontShowAgain);
    setCarrosselBaixado(true);
    posthog?.capture('crosssell_futebol_preview_open');
    setStage('preview');
  };

  const handlePreviewCta = () => {
    posthog?.capture('crosssell_futebol_cta_click', { at: 'preview', dest: 'lp' });
    closeAll(optOut);
    navigate(FUTEBOL_LP_ROUTE);
  };

  return (
    <>
      <FutebolTeaserModal
        open={stage === 'teaser'}
        onDismiss={closeAll}
        onCta={handleTeaserCta}
      />
      {carrosselBaixado && (
        <Suspense fallback={null}>
          <FutebolPreviewCarousel
            open={stage === 'preview'}
            onClose={() => closeAll(optOut)}
            onCta={handlePreviewCta}
          />
        </Suspense>
      )}
    </>
  );
};
