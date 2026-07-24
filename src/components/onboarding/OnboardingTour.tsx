import { useRef } from 'react';
import { Joyride, EVENTS, STATUS, type Step, type EventData } from 'react-joyride';
import { usePostHog } from '@posthog/react';
import OnboardingTooltip from './OnboardingTooltip';

type Props = {
  /** Identificador do tour (vai nos eventos de PostHog e na persistência). */
  tourId: string;
  steps: Step[];
  run: boolean;
  /** Chamado uma vez quando o tour termina (concluído ou pulado). */
  onFinish: () => void;
};

// Wrapper do react-joyride com o tooltip do design system e os eventos de
// PostHog. Mantém o modo não-controlado (o Joyride cuida do avanço); só
// observamos os eventos pra medir adesão e persistir a conclusão.
export default function OnboardingTour({ tourId, steps, run, onFinish }: Props) {
  const posthog = usePostHog();
  const endedRef = useRef(false);

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
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      tooltipComponent={OnboardingTooltip}
      locale={{ back: 'Voltar', close: 'Fechar', last: 'Entendi', next: 'Próximo', skip: 'Pular' }}
      options={{
        arrowColor: '#ffffff',
        overlayColor: 'rgba(10, 31, 24, 0.55)',
        spotlightRadius: 16,
        spotlightPadding: 6,
        zIndex: 10_000,
        skipBeacon: true,
        buttons: ['back', 'skip', 'primary'],
      }}
    />
  );
}
