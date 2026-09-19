import { Suspense, useEffect, useState } from 'react';
import type { Step } from 'react-joyride';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

const OnboardingTourJoyride = lazyWithRetry(() => import('./OnboardingTourJoyride'));

type Props = {
  /** Identificador do tour (vai nos eventos de PostHog e na persistência). */
  tourId: string;
  steps: Step[];
  run: boolean;
  /** Chamado uma vez quando o tour termina (concluído ou pulado). */
  onFinish: () => void;
};

/**
 * A ponte para o tour guiado, que só baixa a biblioteca quando o tour vai rodar.
 *
 * O `react-joyride` são ~120 kB com as dependências dele, e o `import` estático
 * jogava tudo isso no pacote da página — em TODA visita, para uma peça que roda
 * uma vez na vida do usuário e nunca mais. Na home do Futebol, isso era código
 * de tour competindo por rede e processador com a lista de jogos que a pessoa
 * abriu para ver.
 *
 * O `run` já chega falso na quase totalidade das visitas (quem já fez o tour, ou
 * ainda está carregando os dados), então na prática ninguém baixa.
 *
 * ⚠️ Uma vez carregado, fica montado mesmo com `run` falso. Desmontar ao fim do
 * tour tiraria o Joyride do ar no mesmo instante em que ele processa o evento de
 * conclusão — e é esse evento que persiste "já viu" e alimenta o PostHog.
 */
export default function OnboardingTour(props: Props) {
  const [jaPrecisou, setJaPrecisou] = useState(false);

  useEffect(() => {
    if (props.run) setJaPrecisou(true);
  }, [props.run]);

  if (!jaPrecisou) return null;

  return (
    <Suspense fallback={null}>
      <OnboardingTourJoyride {...props} />
    </Suspense>
  );
}
