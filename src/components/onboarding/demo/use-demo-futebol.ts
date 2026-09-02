import { useMemo } from 'react';
import type {
  FutebolFixtureValueRow,
  FutebolValueBoardRow,
} from '@/services/futebol-data.service';
import { versaoDaJanela, type FutebolScoreVersion } from '@/utils/futebol-score';
import { demoFutebolBoard, demoFixtureValueRows } from './futebol';

/**
 * A escala que o produto está usando, para a demonstração herdar (#333).
 *
 * ⚠️ Recebe **a mesma janela que a tela exibe**, e não o board cru. A legenda de
 * faixas deriva da janela; se a demonstração herdar de outra fonte, o tour volta
 * a anunciar uma régua diferente da que está ao lado dele — que é o defeito
 * inteiro, só que mais difícil de ver.
 *
 * Janela indeterminada — vazia, ou misturando as duas escalas — resolve em
 * `legacy`. Não é chute: pelo contrato do repo, linha sem `score_versao` e com
 * componentes de preço numéricos **é** legacy, e a linha de demonstração tem
 * exatamente essa forma. Declarar outra coisa seria a demonstração contradizer
 * o adapter que o resto do app usa para ler o mesmo dado.
 */
function useEscalaDoProduto(
  janela: readonly { score_versao?: FutebolScoreVersion }[] | null | undefined,
): FutebolScoreVersion {
  const versao = versaoDaJanela(janela ?? []);
  return versao === 'contexto_v1' ? 'contexto_v1' : 'legacy';
}

/** O board de exemplo, na escala que o produto está usando. */
export function useDemoFutebolBoard(
  janela: readonly { score_versao?: FutebolScoreVersion }[] | null | undefined,
): FutebolValueBoardRow[] {
  const escala = useEscalaDoProduto(janela);
  return useMemo(() => demoFutebolBoard(escala), [escala]);
}

/** As saídas de exemplo do detalhe do jogo, na escala que o produto está usando. */
export function useDemoFixtureValueRows(
  janela: readonly { score_versao?: FutebolScoreVersion }[] | null | undefined,
): FutebolFixtureValueRow[] {
  const escala = useEscalaDoProduto(janela);
  return useMemo(() => demoFixtureValueRows(escala), [escala]);
}
