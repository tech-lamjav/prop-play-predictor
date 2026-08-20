import { useState, useEffect } from 'react';

/**
 * O relógio da tela, que ANDA.
 *
 * `Date.now()` lido no corpo de um componente só avança quando alguma coisa
 * provoca render, e nas telas de futebol quase nada provoca: as queries têm
 * `staleTime` longo e `refetchOnWindowFocus: false`. Numa aba aberta às 15h55,
 * às 16h05 o "agora" ainda seria 15h55.
 *
 * Isso importa porque várias decisões dessas telas são "o kickoff já passou?":
 * a fusão do board com a foto do apito em `futebol-history.ts`, o rótulo "Em
 * andamento" da faixa do jogo, o corte de oportunidade que virou registro. Sem
 * o tique, a lista continua mostrando o preço pré-jogo enquanto a tela de
 * detalhe já mostra a foto do apito.
 *
 * ⚠️ O tique sozinho NÃO resolve: ele move o relógio, não os dados. Quem depende
 * de linha nova vinda do banco precisa ALÉM disso de um `refetchInterval` na
 * query, senão o componente recalcula em cima do mesmo cache. Ver o
 * `useFutebolValueHistory`, onde os dois andam juntos.
 *
 * Um minuto é o passo certo: kickoff tem precisão de minuto, e um render por
 * minuto não custa nada nas listas deste tamanho.
 */
export function useNow(stepMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}
