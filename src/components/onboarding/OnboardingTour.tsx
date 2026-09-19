import { Suspense, useEffect, useState } from 'react';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

// O tipo vem do arquivo de baixo, que é quem define o contrato de verdade.
// Duplicá-lo aqui deixaria o repasse de props escondendo qualquer divergência.
import type { PropsDoTour } from './OnboardingTourJoyride';

const OnboardingTourJoyride = lazyWithRetry(() => import('./OnboardingTourJoyride'));

/**
 * A ponte para o tour guiado, que só baixa a biblioteca quando o tour vai rodar.
 *
 * O `react-joyride` são 118 kB de código-fonte com as dependências (83 dele, 35
 * do @gilbarbara/hooks, medidos por sourcemap no build de produção), e o
 * `import` estático jogava tudo isso no pacote da página — em TODA visita, para
 * uma peça que roda uma vez na vida do usuário e nunca mais. Na home do Futebol,
 * era código de tour competindo por rede e processador com a lista de jogos que
 * a pessoa abriu para ver.
 *
 * O `run` já chega falso na quase totalidade das visitas (quem já fez o tour, ou
 * ainda está carregando os dados), então na prática ninguém baixa.
 *
 * ⚠️ Uma vez carregado, fica montado mesmo com `run` falso. Desmontar ao fim do
 * tour tiraria o Joyride do ar no mesmo instante em que ele processa o evento de
 * conclusão — e é esse evento que persiste "já viu" e alimenta o PostHog.
 */
export default function OnboardingTour(props: PropsDoTour) {
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
