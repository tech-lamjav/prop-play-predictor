import { useMemo, useRef } from 'react';
import { Joyride, EVENTS, STATUS, type Step, type EventData } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { usePostHog } from '@posthog/react';
import OnboardingTooltip from './OnboardingTooltip';
import type { PassoDoTour } from './tours';

export type PropsDoTour = {
  /** Identificador do tour (vai nos eventos de PostHog e na persistência). */
  tourId: string;
  /** Os passos com o texto por CHAVE — ver `tours.tsx`. Aqui é que viram frase. */
  steps: PassoDoTour[];
  run: boolean;
  /** Chamado uma vez quando o tour termina (concluído ou pulado). */
  onFinish: () => void;
};

// O react-joyride de verdade. Vive num arquivo separado porque é ele que
// carrega a biblioteca (~120 kB com as dependências), e quem faz a ponte é o
// OnboardingTour ao lado — que só baixa isto quando o tour vai mesmo rodar.
// Não importe este arquivo direto: importe o OnboardingTour.
//
// Wrapper do react-joyride com o tooltip do design system e os eventos de
// PostHog. Mantém o modo não-controlado (o Joyride cuida do avanço); só
// observamos os eventos pra medir adesão e persistir a conclusão.
export default function OnboardingTourJoyride({ tourId, steps, run, onFinish }: PropsDoTour) {
  const posthog = usePostHog();
  const endedRef = useRef(false);
  // A FRONTEIRA DA TRADUÇÃO do tour (#532). Os passos chegam com chave porque são
  // dado montado fora de componente (ver `tours.tsx`); é aqui, que é componente e
  // tem o tradutor, que a chave vira frase. O `t` troca de identidade quando o
  // idioma muda, então os passos são remontados e o balão aberto já fala a língua
  // nova, sem recarregar a página.
  const { t, ready } = useTranslation('tour');

  const passos = useMemo<Step[]>(
    () =>
      steps.map(({ tituloChave, conteudoChave, ...resto }) => ({
        ...resto,
        ...(tituloChave ? { title: t(tituloChave) } : {}),
        content: t(conteudoChave),
      })),
    [steps, t],
  );

  const handleEvent = (data: EventData) => {
    const { type, status, index, step } = data;

    if (type === EVENTS.TOUR_START) {
      endedRef.current = false;
      posthog?.capture('onboarding_tour_started', { tour: tourId, steps: steps.length });
      return;
    }

    if (type === EVENTS.TOOLTIP) {
      posthog?.capture('onboarding_tour_step_viewed', {
        tour: tourId,
        index,
        step_id: step?.id ?? String(index),
      });
      return;
    }

    const finished = status === STATUS.FINISHED;
    const skipped = status === STATUS.SKIPPED;
    if ((finished || skipped) && !endedRef.current) {
      endedRef.current = true;
      posthog?.capture(finished ? 'onboarding_tour_completed' : 'onboarding_tour_skipped', {
        tour: tourId,
        index,
      });
      onFinish();
    }
  };

  return (
    <Joyride
      steps={passos}
      // ⚠️ Espera o catálogo do tour chegar. O carregamento do texto é sob demanda
      // e sem Suspense, então começar antes mostraria o CÓDIGO DA CHAVE no lugar
      // da frase no primeiro quadro — e o tour roda uma vez na vida do usuário.
      run={run && ready}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      tooltipComponent={OnboardingTooltip}
      locale={{
        back: t('tooltip.voltar'),
        close: t('tooltip.fechar'),
        last: t('tooltip.entendi'),
        next: t('tooltip.proximo'),
        skip: t('tooltip.pular'),
      }}
      options={{
        arrowColor: '#ffffff',
        overlayColor: 'rgba(10, 31, 24, 0.55)',
        spotlightRadius: 16,
        spotlightPadding: 6,
        // Compensa a nav sticky de DUAS faixas do rebrand (desktop 60+46≈106px,
        // mobile 52+42≈94px) pra o alvo não parar atrás dela quando o tour rola
        // a página — senão o spotlight de um passo `bottom` (barra de datas,
        // raio-x) vaza por cima do cabeçalho.
        scrollOffset: 120,
        zIndex: 10_000,
        skipBeacon: true,
        buttons: ['back', 'skip', 'primary'],
      }}
    />
  );
}
